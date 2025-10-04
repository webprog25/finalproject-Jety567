import fetch from 'node-fetch';
import axios from "axios";
import { deleteStoreById, getStoresByBrand, storeStoresDB } from "../mongo_db/stores.js";
import { chromium } from 'playwright';

let browser = null;

// ------------------------
// Helper Functions
// ------------------------

/**
 * Search Rossmann for a product by EAN.
 * @param {string} ean
 * @returns {Promise<{url: string|null, page: object|null}>}
 */
async function findRossmannProductByEan(ean) {
    const searchUrl = `https://www.rossmann.de/de/search?text=${ean}`;
    const productUrlPattern = new RegExp(`/de/.+/p/${ean}`);
    let page = null;

    try {
        browser = await startBrowser();
        page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForSelector('a', { timeout: 5000 });

        const links = await page.$$eval('a', anchors => anchors.map(a => a.href));
        const matchingLink = links.find(link => productUrlPattern.test(link)) || null;

        if (!matchingLink) return { url: null, page };

        try {
            const res = await fetch(matchingLink, { method: 'HEAD' });
            return { url: res.ok ? matchingLink : null, page };
        } catch {
            return { url: null, page };
        }

    } catch (err) {
        console.error('Error finding product:', err.message);
        return { url: null, page };
    }
}

/**
 * Extract product data from Rossmann product page.
 * @param {string} productUrl
 * @param {object} page - Playwright page object
 * @returns {Promise<{price: number, imageUrl: string, articleNumber: string}>}
 */
async function extractRossmannProductData(productUrl, page) {
    try {
        await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 25000 });

        return await page.evaluate(() => {
            const priceContainer = document.querySelector('.rm-price__current');
            const integer = priceContainer?.querySelector('.rm-price__integer')?.textContent?.trim() || '';
            const fraction = priceContainer?.querySelector('.rm-price__float')?.textContent?.trim() || '';
            const price = parseFloat(`${integer}.${fraction}`);

            const imgElement = Array.from(document.querySelectorAll('img.rm-product__image'))
                .find(img => img.classList.length === 1 && img.classList.contains('rm-product__image'));
            const imageUrl = imgElement?.getAttribute('data-src') || imgElement?.src || null;

            let articleNumber = null;
            const allElements = Array.from(document.querySelectorAll('body *'));
            for (const el of allElements) {
                const text = el.textContent?.trim();
                if (text?.startsWith('Artikelnummer:')) {
                    articleNumber = text.replace('Artikelnummer:', '').trim();
                    break;
                }
            }

            return { price, imageUrl, articleNumber };
        });

    } catch (err) {
        console.error('Error extracting product data:', err.message);
        return null;
    }
}

/**
 * Check store availability for a product URL.
 * @param {string} productUrl
 * @param {object} store
 * @returns {Promise<Object|null>}
 */
async function checkAvailability(productUrl, store) {
    let storeResponseJson = null;
    let page = null;

    try {
        browser = await startBrowser();
        page = await browser.newPage();
        const apiUrlPrefix = 'https://www.rossmann.de/storefinder/.rest/store/';

        const waitForStoreApi = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                if (url.startsWith(apiUrlPrefix)) {
                    try { storeResponseJson = await response.json(); } catch {}
                    resolve();
                }
            });
        });

        await page.goto('https://www.rossmann.de/de/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(storeJson => localStorage.setItem('store', storeJson), JSON.stringify({ id: parseInt(store.storeId) }));
        await page.goto(productUrl, { waitUntil: 'networkidle' });

        await Promise.race([waitForStoreApi, new Promise(res => setTimeout(res, 10000))]);

    } catch (err) {
        console.error('Error checking availability:', err.message);
    } finally {
        if (page) await page.close();
    }

    return storeResponseJson;
}

/**
 * Get Rossmann stores filtered by postal code or location name.
 * @param {string} searchParam
 */
async function getStoresForPostalCode(searchParam) {
    let stores = [];
    const request = await axios.get(`https://www.rossmann.de/de/filialen/assets/data/locations.json`);
    const locations = request.data;

    for (const key of Object.keys(locations)) {
        const store = locations[key];
        if (/^\d{5}$/.test(searchParam) && store.postalCode === searchParam ||
            checkParam(store, ['locality','address','name','city'], searchParam)) {
            stores.push({
                data: {
                    storeId: store.storeCode,
                    storeNumber: store.storeCode,
                    address: {
                        name: "Rossmann",
                        street: store.address,
                        zip: store.postalCode,
                        city: store.locality,
                        regionName: store.region,
                    },
                    phone: null,
                    coordinates: [store.lat, store.lng]
                },
                openingHours: openingHours(store.openingHours),
            });
        }
    }
    return stores;
}

/**
 * Check if search param matches any store field.
 * @param {object} store
 * @param {Array<string>} keys
 * @param {string} searchParam
 */
function checkParam(store, keys, searchParam) {
    return keys.some(key => (store[key] || '').toUpperCase() === searchParam.toUpperCase());
}

/**
 * Check if postal code is valid using API.
 */
async function isValidPLZ(plz) {
    const res = await fetch(`https://api.zippopotam.us/de/${plz}`);
    return res.ok;
}

/**
 * Convert store opening hours to unified format.
 */
function openingHours(data) {
    const dayMap = { Mo: "Monday", Di: "Tuesday", Mi: "Wednesday", Do: "Thursday", Fr: "Friday", Sa: "Saturday", So: "Sunday" };
    const unified = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };

    Object.entries(data).forEach(([key, ranges]) => {
        const day = dayMap[key];
        unified[day] = ranges.map(r => ({ open: r.openTime, close: r.closeTime }));
    });

    return unified;
}

/**
 * Launch Playwright browser instance.
 */
async function startBrowser() {
    if (!browser) {
        browser = await chromium.launch({ headless: false });
        console.log('✅ Playwright browser launched');
    }
    return browser;
}

// ------------------------
// API Routes
// ------------------------

/**
 * GET /api/rossmann/product/:ean
 * Returns product info by EAN.
 */
async function rossmannProduct(req, res) {
    try {
        const { url, page } = await findRossmannProductByEan(req.params.ean);
        if (!url) return res.sendStatus(404);

        const { imageUrl, price, articleNumber } = await extractRossmannProductData(url, page);
        res.json({ ean: req.params.ean, url, imageUrl, price, articleNumber });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
}

/**
 * GET /api/rossmann/product-price
 * Returns price info for product URL.
 */
async function rossmannProductPrice(req, res) {
    const productUrl = req.query.url;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter.' });

    try {
        await startBrowser();
        const page = await browser.newPage();
        const data = await extractRossmannProductData(productUrl, page);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to scrape product data.' });
    }
}

/**
 * GET /api/rossmann/stores/:searchParam
 * Returns stores filtered by PLZ or location name.
 */
async function rossmannStores(req, res) {
    try {
        const searchParam = req.params.searchParam;
        if (/^\d{5}$/.test(searchParam) && !(await isValidPLZ(searchParam))) {
            return res.status(500).json({ error: 'Invalid PLZ' });
        }

        const stores = await getStoresForPostalCode(searchParam);
        res.json(stores.length ? stores : null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
}

/**
 * GET /api/rossmann/store-product
 * Returns availability of a product across all stores.
 */
async function rossmannStoreProduct(req, res) {
    const productUrl = req.query.url;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter' });

    try {
        const stores = await getStoresByBrand('rossmann');
        const results = await Promise.all(stores.data.map(async store => {
            const result = await checkAvailability(productUrl, store);
            const productInfo = result.store.productInfo[0];
            return {
                storeId: store.storeId,
                available: productInfo.stock !== "0",
                quantity: productInfo.stock === "+5" ? 5 : parseInt(productInfo.stock)
            };
        }));
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /api/rossmann/saved-stores
 * Returns saved Rossmann stores from DB.
 */
async function rossmannSavedStores(req, res) {
    const result = await getStoresByBrand('rossmann');
    if (!result.success) return res.status(400).json({ error: 'No stores found' });

    const stores = result.data.map(store => ({
        data: {
            storeId: store.storeId,
            storeNumber: store.storeNumber,
            address: store.address,
            phone: store.phone,
            coordinates: store.coordinates
        },
        openingHours: store.openingHours
    }));

    res.json(stores);
}

/**
 * POST /api/rossmann/save-store
 * Save a Rossmann store into DB.
 */
async function rossmannSaveStores(req, res) {
    const result = await storeStoresDB(req.body, 'rossmann');
    if (!result.success) return res.status(400).json({ error: result.message });
    res.status(201).json({ message: result.message });
}

/**
 * DELETE /api/rossmann/delete-store/:storeId
 * Delete a Rossmann store from DB.
 */
async function rossmannDeleteStores(req, res) {
    const result = await deleteStoreById(req.params.storeId);
    res.status(result.success ? 200 : 404).json(result);
}

// ------------------------
// Exports
// ------------------------

export {
    rossmannProduct,
    rossmannProductPrice,
    rossmannStores,
    rossmannStoreProduct,
    rossmannSavedStores,
    rossmannSaveStores,
    rossmannDeleteStores
};