import axios from "axios";
import * as cheerio from "cheerio";
import { deleteStoreById, getStoresByBrand, storeStoresDB } from "../mongo_db/stores.js";

const BUDNI_COOKIE = "main-market=412131; Sitzung=17B";

/**
 * Get product URL from Budni search by barcode
 * @param {string} barcode
 * @returns {Promise<string|null>}
 */
async function getBudniProductUrl(barcode) {
    const searchUrl = `https://www.budni.de/sortiment/produkte?search=${barcode}`;
    try {
        const response = await axios.get(searchUrl, {
            headers: { "User-Agent": "Mozilla/5.0", "Cookie": BUDNI_COOKIE },
        });

        const $ = cheerio.load(response.data);
        let productLinks = [];

        $("a").each((_, el) => {
            const href = $(el).attr("href");
            if (href && href.startsWith("/sortiment/produkte/")) productLinks.push(href);
        });

        productLinks = [...new Set(productLinks)];
        return productLinks.length === 1 ? `https://www.budni.de${productLinks[0]}` : null;
    } catch (err) {
        console.error("Error fetching Budni search:", err.message);
        return null;
    }
}

/**
 * Extract product details from Budni product page
 * @param {string} productUrl
 */
async function getBudniProductDetails(productUrl) {
    try {
        const response = await axios.get(productUrl, {
            headers: { "User-Agent": "Mozilla/5.0", "Cookie": BUDNI_COOKIE },
        });

        const $ = cheerio.load(response.data);
        const htmlText = $.html();

        const priceMatch = htmlText.match(/(\d{1,3},\d{2}\s*€)/);
        let price = priceMatch ? parseFloat(priceMatch[1].replace(",", ".").replace("€", "").trim()) : null;

        const imageUrl = $("img")
            .map((_, el) => $(el))
            .get()
            .find(img => img.attr("alt") && /product/i.test(img.attr("alt")))?.attr("src") || null;

        return {
            price,
            imageUrl: imageUrl ? `https://budni.de${imageUrl}` : null,
            articleNumber: productUrl.split("/").slice(-1)[0],
        };
    } catch (err) {
        console.error("Error fetching Budni product:", err.message);
        return null;
    }
}

/**
 * Fetch Budni product by barcode
 * @param {string} barcode
 */
async function fetchBudniByBarcode(barcode) {
    const url = await getBudniProductUrl(barcode);
    if (!url) return null;

    const details = await getBudniProductDetails(url);
    return { url, ...details };
}

/**
 * Lookup Budni product by EAN
 */
async function lookupBudniProduct(ean) {
    if (!ean) return null;
    try {
        return await fetchBudniByBarcode(ean);
    } catch (err) {
        console.error('Budni lookup failed:', err);
        throw new Error('Budni service error');
    }
}

/**
 * Express route: Get Budni product by EAN
 */
async function budniProduct(req, res) {
    try {
        const product = await lookupBudniProduct(req.params.ean);
        if (!product) return res.sendStatus(404);
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Express route: Get Budni product price and info by URL
 */
async function budniProductPrice(req, res) {
    const { url } = req.query;
    if (!url) return res.status(404).send("No url");

    const product = await getBudniProductDetails(url);
    if (!product) return res.status(404).send("No such product");

    res.json({ ...product, url });
}

/**
 * Get Budni store availability by product URL
 */
async function getBudniStoreAvailability(productUrl) {
    if (!productUrl) return null;

    try {
        let storeData = await getStoresByBrand('budni');
        storeData = storeData.data;

        const product = await getBudniProductDetails(productUrl);
        if (!product) return null;

        return await Promise.all(
            storeData.map(async store => {
                const request = await axios.get(
                    `https://www.budni.de/api/stocks/api/v1/Stocks/markets/${store.storeId}/article-id/${product.articleNumber}/status`
                );

                const available = request.data.status === 'inStock';
                return { storeId: store.storeId, available, quantity: available ? request.data.quantity : 0 };
            })
        );
    } catch (err) {
        console.error('Error checking Budni stores:', err);
        throw new Error('Budni store availability service error');
    }
}

/**
 * Express route: Get saved Budni stores
 */
async function budniSavedStores(req, res) {
    const result = await getStoresByBrand('budni');
    if (result.success) {
        const stores = result.data.map(store => ({
            data: { ...store.data, coordinates: store.coordinates },
            openingHours: store.openingHours,
        }));
        return res.status(200).json(stores);
    }
    return res.status(200).json([]);
}

/**
 * Express route: Save Budni store
 */
async function budniSaveStores(req, res) {
    const result = await storeStoresDB(req.body, 'budni');
    if (result.success) return res.status(201).json({ message: result.message });
    return res.status(400).json({ error: result.message });
}

/**
 * Express route: Delete Budni store
 */
async function budniDeleteStores(req, res) {
    const result = await deleteStoreById(req.params.storeId);
    res.status(result.success ? 200 : 404).json(result);
}

/**
 * Format Budni store info and opening hours
 */
function formatBudniStore(budniStore) {
    const openingHours = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
    const rules = budniStore.workingDaysSummary.split(",");

    rules.forEach(rule => {
        const [daysPart, hoursPart] = rule.split(": ").map(s => s.trim());
        if (!hoursPart) return;

        const [open, close] = hoursPart.split("-").map(s => s.trim());
        const dayMap = { Mo: "Monday", Di: "Tuesday", Mi: "Wednesday", Do: "Thursday", Fr: "Friday", Sa: "Saturday", So: "Sunday" };

        if (daysPart.includes("-")) {
            const [start, end] = daysPart.split("-").map(s => s.trim());
            const keys = Object.keys(dayMap);
            const startIndex = keys.indexOf(start);
            const endIndex = keys.indexOf(end);
            keys.slice(startIndex, endIndex + 1).forEach(d => openingHours[dayMap[d]].push({ open, close }));
        } else {
            const dayKey = dayMap[daysPart];
            if (dayKey) openingHours[dayKey].push({ open, close });
        }
    });

    return {
        data: {
            storeId: String(budniStore.id),
            storeNumber: String(budniStore.id),
            brand: "budni",
            address: {
                name: budniStore.name,
                street: budniStore.contact.streetAndNumber,
                zip: budniStore.contact.zip,
                city: budniStore.contact.city,
                regionName: null
            },
            phone: null,
            coordinates: [budniStore.contact.latitude, budniStore.contact.longitude],
        },
        openingHours
    };
}

/**
 * Convert location string to coordinates
 */
async function getCoordinates(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    throw new Error("Location not found");
}

/**
 * Compute distance between two coordinates
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Search nearest Budni stores by location
 */
async function searchStoreByParam(location, stores) {
    try {
        const { lat, lon } = await getCoordinates(location);
        const sortedStores = stores
            .map(store => ({ ...formatBudniStore(store), distance: getDistance(lat, lon, store.contact.latitude, store.contact.longitude) }))
            .sort((a, b) => a.distance - b.distance);

        return sortedStores.slice(0, 5);
    } catch (err) {
        console.error(err);
        return [];
    }
}

/**
 * Express route: Search Budni stores by parameter
 */
async function budniStores(req, res) {
    try {
        const { searchParam } = req.params;
        if (!searchParam) return res.status(404).send("No Parameter");

        const stores = await listAllBudniStores();
        const result = await searchStoreByParam(searchParam, stores);
        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
}

/**
 * Express route: Get Budni store availability for a given product URL
 *
 * @route GET /api/budni/store-product?url=...
 */
async function budniStoreProduct(req, res) {
    const { url: productUrl } = req.query;

    if (!productUrl) {
        return res.status(400).json({ error: 'Missing url query parameter' });
    }

    try {
        const availability = await getBudniStoreAvailability(productUrl);
        if (!availability) return res.status(404).json({ error: 'No such product' });

        res.status(200).json(availability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export {
    budniProduct,
    budniProductPrice,
    budniSavedStores,
    budniSaveStores,
    budniDeleteStores,
    budniStores,
    budniStoreProduct,
    lookupBudniProduct,
    getBudniStoreAvailability
};