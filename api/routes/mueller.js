import fetch from "node-fetch";
import cache from '../utils/persistentCache.js';
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { deleteStoreById, getStoresByBrand, storeStoresDB } from '../mongo_db/stores.js';
import { getPage } from '../utils/PuppeteerClusterUtil.js';

const CACHE_NAME = 'muellerProductData';

/**
 * Finds the Müller product page by EAN (only if one exact match is found).
 * @param {string} ean
 * @returns {Promise<string|null>} Product URL or null if not found
 */
async function findMuellerProductByEan(ean) {
    const request = await axios.get(`https://www.mueller.de/search/?q=${ean}`);
    const html = request.data;

    if (html.includes(`Ihre Suche nach ${ean} ergab leider keine Treffer`)) {
        return null;
    }

    const $ = cheerio.load(html);
    let text = '';

    $('script').each((i, el) => {
        const content = $(el).html();
        if (content && content.includes("self.__next_f.push([1")) {
            text += content.trim();
        }
    });

    text = text.replaceAll("\"])self.__next_f.push([1,\"", "").replaceAll(/\\"/g, '"');
    text = text.split('"components":').find(item => item.includes('"type":"product-list"'));

    const products = extractProducts(text);
    if (products && products.length > 0) {
        return `https://mueller.de${products[0].path}`;
    }
    return null;
}

/**
 * Extracts product array from the parsed JSON text.
 * @param {string} text
 * @returns {Array|null}
 */
function extractProducts(text) {
    const start = text.indexOf('"products":');
    if (start === -1) return null;

    const arrayStart = text.indexOf('[', start);
    if (arrayStart === -1) return null;

    let bracketCount = 0;
    let inString = false;
    let escape = false;

    for (let i = arrayStart; i < text.length; i++) {
        const char = text[i];

        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') inString = !inString;

        if (!inString) {
            if (char === '[') bracketCount++;
            else if (char === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    const arrayStr = text.slice(arrayStart, i + 1);
                    return JSON.parse(arrayStr);
                }
            }
        }
    }

    return null;
}

/**
 * Extracts detailed product data from the product URL.
 * @param {string} productUrl
 * @returns {Promise<{price:number|null, imageUrl:string|null, articleNumber:string|null}>}
 */
async function extractMuellerProductData(productUrl) {
    try {
        const { data: html } = await axios.get(productUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        const $ = cheerio.load(html);
        let product = null;

        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const json = JSON.parse($(el).contents().text().trim());
                if (json['@type'] === 'Product') {
                    product = json;
                }
            } catch (err) {
                console.warn("Invalid JSON-LD found:", err.message);
            }
        });

        if (!product) throw Error("Product not found!");

        const price = product.offers[0].price;
        const imageUrl = product.image[0];
        const articleNumber = product.sku;

        return { price, imageUrl, articleNumber };
    } catch (err) {
        console.error(`❌ Failed to extract product data from ${productUrl}:`, err.message);
        return { price: null, imageUrl: null, articleNumber: null };
    }
}

/**
 * Converts raw Mueller opening hours to unified format.
 * @param {Array} data
 * @returns {Object} unified opening hours
 */
function convertOpenHours(data) {
    const dayMap = {
        monday: "Monday",
        tuesday: "Tuesday",
        wednesday: "Wednesday",
        thursday: "Thursday",
        friday: "Friday",
        saturday: "Saturday",
        sunday: "Sunday"
    };

    const unified = {
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: []
    };

    data.forEach(entry => {
        const day = dayMap[entry.day.toLowerCase()];
        if (entry.openingTime && entry.closingTime) {
            unified[day].push({
                open: entry.openingTime,
                close: entry.closingTime
            });
        }
    });

    return unified;
}

/**
 * Retrieves a list of Mueller stores based on postal code or location.
 * @param {string} searchParam
 * @returns {Promise<Array>} Array of stores
 */
async function getStoresForPostalCode(searchParam) {
    return await getPage(async (page) => {
        const muellerDataPromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                if (
                    url.startsWith('https://backend.prod.ecom.mueller.de/?operatingChain=B2C_DE_Store&operationName=GetStoresByIds') &&
                    response.request().method() === 'GET'
                ) {
                    try {
                        const data = await response.json();
                        resolve(data);
                    } catch {
                        resolve({ error: 'Failed to parse JSON', url });
                    }
                }
            });
        });

        await page.goto('https://www.mueller.de/storefinder/', {
            waitUntil: 'networkidle2'
        });

        await page.type('input[placeholder="Ort/PLZ"]', searchParam, { delay: 100 });
        await page.keyboard.press('Enter');

        let data = await muellerDataPromise;
        data = data.data.getStoresByIds;

        let stores = data.map(store => ({
            data: {
                storeId: store.code,
                storeNumber: store.code,
                address: {
                    name: store.company.name,
                    street: store.address.street,
                    zip: store.address.zip,
                    city: store.address.town,
                    regionName: null
                },
                phone: store.phone,
                coordinates: [store.geoLocation.lat, store.geoLocation.lng]
            },
            openingHours: convertOpenHours(store.openingHours)
        }));

        const zipMatch = /^\d{5}$/.test(searchParam);
        if (zipMatch) {
            const filtered = stores.filter(store => store.data.address.zip === searchParam);
            if (filtered.length > 0) return filtered;
        }

        return stores;
    });
}

/**
 * Express route: GET /api/mueller/product/:ean
 */
async function muellerProduct(req, res) {
    try {
        const product = await lookupMuellerProduct(req.params.ean);
        if (!product) return res.sendStatus(404);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Lookup a Mueller product by EAN.
 * @param {string} ean
 * @returns {Promise<{ean:string,url:string,price:number,imageUrl:string,articleNumber:string}|null>}
 */
async function lookupMuellerProduct(ean) {
    try {
        const productUrl = await findMuellerProductByEan(ean);
        if (!productUrl) return null;

        const { price, imageUrl, articleNumber } = await extractMuellerProductData(productUrl);
        return { ean, url: productUrl, price, imageUrl, articleNumber };
    } catch (err) {
        console.error('Mueller lookup failed:', err);
        throw new Error('Mueller service error');
    }
}

/**
 * Express route: GET /api/mueller/store-product
 */
async function muellerStoreProduct(req, res) {
    const { url: productUrl } = req.query;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter' });

    try {
        const availability = await getMuellerStoreAvailability(productUrl);
        res.status(200).json(availability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Get Mueller store availability for a given product URL.
 * @param {string} productUrl
 * @returns {Promise<Array|null>}
 */
async function getMuellerStoreAvailability(productUrl) {
    if (!productUrl) return null;

    try {
        let storeData = await getStoresByBrand('mueller');
        storeData = storeData.data;

        const products = await Promise.all(
            storeData.map(async (store) => {
                const result = await checkAvailability(productUrl, store);
                return {
                    storeId: store.storeId,
                    available: result.data.getStoreStockForProductV2,
                    quantity: null
                };
            })
        );

        return products;
    } catch (err) {
        console.error('Error checking Mueller stores:', err);
        throw new Error('Mueller store availability service error');
    }
}

/**
 * Express route: GET /api/mueller/stores/:searchParam
 */
async function muellerStores(req, res) {
    try {
        const searchParam = req.params.searchParam;

        if (/^\d{5}$/.test(searchParam)) {
            const validPLZ = await isValidPLZ(searchParam);
            if (!validPLZ) return res.status(500).send({ error: 'Invalid PLZ' });
        }

        const stores = await getStoresForPostalCode(searchParam);
        if (!stores) return res.sendStatus(404);
        res.send(stores);
    } catch (err) {
        res.status(500).send({ error: err });
    }
}

/**
 * Express route: GET /api/mueller/saved-stores
 */
async function muellerSavedStores(req, res) {
    const result = await getStoresByBrand('mueller');
    if (result.success) {
        const stores = result.data.map(store => ({ data: store, openingHours: store.openingHours }));
        res.status(200).json(stores);
    } else {
        res.status(400).json({ error: 'Missing store store' });
    }
}

/**
 * Express route: POST /api/mueller/save-store
 */
async function muellerSaveStores(req, res) {
    const result = await storeStoresDB(req.body, 'mueller');
    if (result.success) return res.status(201).json({ message: result.message });
    return res.status(400).json({ error: result.message });
}

/**
 * Express route: DELETE /api/mueller/store/:storeId
 */
async function muellerDeleteStores(req, res) {
    const result = await deleteStoreById(req.params.storeId);
    res.status(result.success ? 200 : 404).json(result);
}

/**
 * Express route: GET /api/mueller/product-price
 */
async function muellerProductPrice(req, res) {
    const productUrl = req.query.url;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter.' });

    try {
        const data = await extractMuellerProductData(productUrl);
        res.status(200).json(data);
    } catch {
        res.status(500).json({ error: 'Failed to scrape product data.' });
    }
}

/**
 * Initializes Mueller product cache.
 */
async function initMuellerCache() {
    await cache.loadCache(CACHE_NAME);
}

export {
    muellerProduct,
    muellerProductPrice,
    muellerStores,
    muellerStoreProduct,
    muellerSavedStores,
    muellerSaveStores,
    muellerDeleteStores,
    initMuellerCache,
    lookupMuellerProduct,
    getMuellerStoreAvailability
};