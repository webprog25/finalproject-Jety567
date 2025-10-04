import { getStoresByBrand } from '../../mongo_db/stores.js';
import axios from "axios";

/**
 * Search dm.de for a product by EAN.
 *
 * @param {string} ean
 * @returns {Promise<Object|null>} Product JSON or null if not found.
 */
export async function findDmProductByEan(ean) {
    try {
        const request = await axios.get(`https://products.dm.de/product/DE/products/detail/gtin/${ean}`);
        if (request.status !== 200) return null;
        return request.data;
    } catch (err) {
        console.error('Error during dm lookup:', err.message);
        return null;
    }
}

/**
 * Extract product data from DM JSON.
 *
 * @param {Object} json
 * @returns {Promise<{ price: number, imageUrl: string, articleNumber: string, gtin: string, url: string }>}
 */
async function extractDmProductData(json) {
    return {
        price: json.metadata.price,
        imageUrl: json.images[0].src,
        articleNumber: json.dan,
        gtin: json.gtin,
        url: `https://www.dm.de${json.self}`
    };
}

/**
 * Check availability of a product at a single store.
 *
 * @param {string} productId
 * @param {Object} store - Store object with storeId
 * @returns {Promise<{ available: boolean|null, quantity: number }>}
 */
async function checkAvailability(productId, store) {
    const request = await axios.get(
        `https://products.dm.de/availability/api/v1/detail/DE/${productId}?pickupStoreId=${store.storeId}`,
        {
            headers: {
                'sec-ch-ua-platform': '"macOS"',
                'referer': 'https://www.dm.de/',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/139.0.7258.5 Safari/537.36'
            }
        }
    );

    if (request.status !== 200) return { available: null, quantity: 0 };

    const json = request.data;
    let quantity = 0;

    if (json.rows[1]) {
        const row = json.rows[1];
        let quantityMatch = row.text?.match(/Verfügbar\s+\((\d+)\s+Stück\)/);
        if (!quantityMatch && row.hasOwnProperty('subText')) {
            quantityMatch = row.subText?.match(/Verfügbar\s+\((\d+)\s+Stück\)/);
        }
        if (quantityMatch) quantity = parseInt(quantityMatch[1], 10);
    }

    return { available: json.rows[1]?.icon === "GREEN", quantity };
}

/**
 * Express route: Get DM store availability for a product by article number.
 *
 * @route GET /api/dm/store/:articleNr
 */
async function dmStoreProduct(req, res) {
    const { articleNr } = req.params;
    if (!articleNr) return res.status(400).json({ error: 'Missing articleNr parameter' });

    try {
        const availability = await getDmStoreAvailability(articleNr);
        res.status(200).json(availability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Get DM store availability for all DM stores for a given product.
 *
 * @param {string} articleNr
 * @returns {Promise<Array<{storeId: string, available: boolean|null, quantity: number}>>}
 */
async function getDmStoreAvailability(articleNr) {
    if (!articleNr) return null;

    try {
        const stores = await getStoresByBrand('dm');
        const storeData = stores.data;

        return await Promise.all(
            storeData.map(async store => {
                const result = await checkAvailability(articleNr, store);
                return { storeId: store.storeId, available: result.available, quantity: result.quantity };
            })
        );
    } catch (err) {
        console.error('Error checking DM stores:', err);
        throw new Error('DM store availability service error');
    }
}

/**
 * Express route: Get DM product info by EAN.
 *
 * @route GET /api/dm/product/:ean
 */
async function dmProduct(req, res) {
    try {
        const product = await lookupDmProduct(req.params.ean);
        if (!product) return res.sendStatus(404);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Lookup DM product by EAN and extract relevant info.
 *
 * @param {string} ean
 * @returns {Promise<{ ean: string, url: string, price: number, imageUrl: string, articleNumber: string }|null>}
 */
async function lookupDmProduct(ean) {
    try {
        const productJson = await findDmProductByEan(ean);
        if (!productJson) return null;

        const { price, imageUrl, articleNumber, url } = await extractDmProductData(productJson);
        return { ean, url, price, imageUrl, articleNumber };
    } catch (err) {
        console.error('DM lookup failed:', err);
        throw new Error('DM service error');
    }
}

/**
 * Express route: Get product price data for a DM product via URL query.
 *
 * @route GET /api/dm/product/price?url=...
 */
async function dmProductPrice(req, res) {
    const productUrl = req.query.url;
    if (!productUrl) return res.status(400).json({ error: 'Missing url query parameter.' });

    try {
        const data = await extractDmProductData(productUrl);
        res.status(200).json(data);
    } catch (err) {
        console.error('Scraping failed:', err.message);
        res.status(500).json({ error: 'Failed to scrape product data.' });
    }
}

export {
    dmProduct,
    dmStoreProduct,
    dmProductPrice,
    lookupDmProduct,
    getDmStoreAvailability
};