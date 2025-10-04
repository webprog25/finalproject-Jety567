import { getStoresByBrand } from "../../mongo_db/stores.js";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import cache from '../../utils/persistentCache.js';

const CacheName = "RossmannCookies";
await cache.loadCache(CacheName);

/**
 * Check availability of a product at a specific Rossmann store.
 *
 * @param {string} articleNr
 * @param {string} store
 * @param {string|null} cookies
 * @returns {Promise<Object|null>}
 */
async function checkAvailability(articleNr, store, cookies = null) {
    let url = `https://www.rossmann.de/storefinder/.rest/store/${store}?dan=${articleNr}`;

    if (!cookies) {
        cookies = await getCookiesForAxios(url);
        await cache.set(CacheName, 'cookies', cookies, cache.FOREVER_TTL);
        await cache.saveCache(CacheName);
    }

    try {
        const request = await axios.get(url, { headers: { cookie: cookies } });
        const data = request.data;
        return request.headers['content-type'].includes('application/json') ? data : checkAvailability(articleNr, store);
    } catch {
        return null;
    }
}

/**
 * Find Rossmann product by EAN.
 *
 * @param {string} ean
 * @param {string|null} cookies
 * @param {boolean} retry
 * @returns {Promise<Object|null>}
 */
async function findProduct(ean, cookies = null, retry = false) {
    const url = `https://www.rossmann.de/de/p/${ean}`;

    if (!cookies) {
        cookies = await getCookiesForAxios(url);
        await cache.set(CacheName, 'cookies', cookies, cache.FOREVER_TTL);
        await cache.saveCache(CacheName);
    }

    try {
        const request = await axios.get(url, { headers: { 'Accept': 'text/html', Cookie: cookies } });
        const html = request.data;

        if (html.includes('Nur in der Filiale verfügbar')) return null;

        const finalUrl = request.request.res.responseUrl || url;
        const $ = cheerio.load(html);
        const button = $('button[data-cart-add]');
        if (button.length === 0 && !retry) return findProduct(ean, null, true);
        if (button.length === 0) return null;

        const productData = {};
        Object.keys(button[0].attribs).forEach(attr => { if (attr.startsWith('data-')) productData[attr.replace(/^data-/, '')] = button.attr(attr); });

        const name = `${productData['product-brand']} ${productData['product-name']}`;
        const img = $(`img[alt="${name}"]`);

        return {
            ean,
            url: finalUrl,
            image: img[0]?.attribs['data-src'] || null,
            price: parseFloat(productData['product-price']),
            articleNumber: productData['product-id'],
        };
    } catch {
        return null;
    }
}

/**
 * Launch headless browser to retrieve cookies for Rossmann website.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function getCookiesForAxios(url) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    await browser.close();
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Express route: Get Rossmann product by EAN
 *
 * @route GET /api/rossmann/product/:ean
 */
async function rossmannProduct(req, res) {
    try {
        const product = await lookupRossmannProduct(req.params.ean);
        if (!product) return res.sendStatus(404);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Lookup Rossmann product by EAN.
 *
 * @param {string} ean
 * @returns {Promise<Object|null>}
 */
async function lookupRossmannProduct(ean) {
    try {
        const cookies = await cache.get(CacheName, 'cookies');
        return await findProduct(ean, cookies);
    } catch (err) {
        console.error('Rossmann lookup failed:', err);
        throw new Error('Rossmann service error');
    }
}

/**
 * Express route: Get product availability for Rossmann stores.
 *
 * @route GET /api/rossmann/store
 */
async function rossmannStoreProduct(req, res) {
    const productUrl = req.query.url;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter' });

    try {
        const availability = await getRossmannStoreAvailability(productUrl);
        res.status(200).json(availability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Get Rossmann store availability for a product URL.
 *
 * @param {string} productUrl
 * @returns {Promise<Array>}
 */
async function getRossmannStoreAvailability(productUrl) {
    if (!productUrl) return null;

    try {
        const stores = await getStoresByBrand('rossmann');
        const cookies = await cache.get(CacheName, 'cookies');
        const product = await extractProductPrice(productUrl, cookies);

        const results = await Promise.all(
            stores.data.map(async store => {
                const result = await checkAvailability(product.articleNumber, store.storeId, cookies);
                const productInfo = result.store.productInfo[0];
                return {
                    storeId: store.storeId,
                    available: productInfo.stock !== "0",
                    quantity: productInfo.stock === "+5" ? 5 : parseInt(productInfo.stock),
                };
            })
        );

        return results;
    } catch (err) {
        console.error('Error checking Rossmann stores:', err);
        throw new Error('Rossmann store availability service error');
    }
}

/**
 * Express route: Get Rossmann product price by URL
 *
 * @route GET /api/rossmann/product/price
 */
async function rossmannProductPrice(req, res) {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url query parameter' });

    try {
        const product = await extractProductPrice(url, await cache.get(CacheName, 'cookies'));
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Extract Rossmann product price and info from HTML page
 *
 * @param {string} url
 * @param {string|null} cookies
 * @param {boolean} retry
 * @returns {Promise<Object|null>}
 */
async function extractProductPrice(url, cookies = null, retry = false) {
    if (!cookies) {
        cookies = await getCookiesForAxios(url);
        await cache.set(CacheName, 'cookies', cookies, cache.FOREVER_TTL);
        await cache.saveCache(CacheName);
    }

    try {
        const request = await axios.get(url, { headers: { 'Accept': 'text/html', Cookie: cookies } });
        const html = request.data;
        const finalUrl = request.request.res.responseUrl || url;

        const $ = cheerio.load(html);
        const button = $('button[data-cart-add]');
        if (button.length === 0 && !retry) return extractProductPrice(url, null, true);
        if (button.length === 0) return null;

        const productData = {};
        Object.keys(button[0].attribs).forEach(attr => { if (attr.startsWith('data-')) productData[attr.replace(/^data-/, '')] = button.attr(attr); });

        const name = `${productData['product-brand']} ${productData['product-name']}`;
        const ean = productData['data-product-id2'];
        const img = $(`img[alt="${name}"]`);

        return {
            ean,
            url: finalUrl,
            image: img[0]?.attribs['data-src'] || null,
            price: parseFloat(productData['product-price']),
            articleNumber: productData['product-id'],
        };
    } catch {
        return null;
    }
}

export {
    rossmannProduct,
    rossmannProductPrice,
    rossmannStoreProduct,
    lookupRossmannProduct,
    getRossmannStoreAvailability
};