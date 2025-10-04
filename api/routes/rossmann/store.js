import fetch from 'node-fetch';
import axios from "axios";
import { deleteStoreById, getStoresByBrand, storeStoresDB } from "../../mongo_db/stores.js";
import { chromium } from 'playwright';

/**
 * Get Rossmann stores by ZIP code or search parameter
 * @param {string} searchParam
 * @returns {Promise<Array>} List of store objects
 */
async function getStoresForPostalCode(searchParam) {
    const request = await axios.get(`https://www.rossmann.de/de/filialen/assets/data/locations.json`);
    const locations = request.data;
    const stores = [];

    for (const key of Object.keys(locations)) {
        const store = locations[key];
        if (/^\d{5}$/.test(searchParam) && store.postalCode === searchParam ||
            checkParam(store, ['locality', 'address', 'name', 'city'], searchParam)) {
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
 * Check if searchParam matches any of the store fields
 * @param {Object} store
 * @param {Array<string>} keys
 * @param {string} searchParam
 * @returns {boolean}
 */
function checkParam(store, keys, searchParam) {
    return keys.some(key => store[key]?.toUpperCase() === searchParam.toUpperCase());
}

/**
 * Validate German postal code
 * @param {string} plz
 * @returns {Promise<boolean>}
 */
async function isValidPLZ(plz) {
    const res = await fetch(`https://api.zippopotam.us/de/${plz}`);
    return res.ok;
}

/**
 * Express route: Search Rossmann stores
 *
 * @route GET /api/rossmann/stores/:searchParam
 */
async function rossmannStores(req, res) {
    try {
        const searchParam = req.params.searchParam;

        if (/^\d{5}$/.test(searchParam) && !(await isValidPLZ(searchParam))) {
            return res.status(500).send({ error: 'Invalid PLZ' });
        }

        const stores = await getStoresForPostalCode(searchParam);
        if (!stores) return res.sendStatus(404);
        res.status(200).json(stores);
    } catch (err) {
        console.error('Error during search for stores:', err);
        res.status(500).json({ error: err.message });
    }
}

/**
 * Express route: Get saved Rossmann stores
 *
 * @route GET /api/rossmann/stores/saved
 */
async function rossmannSavedStores(req, res) {
    const result = await getStoresByBrand('rossmann');
    if (result.success) {
        const stores = result.data.map(store => ({
            data: {
                storeId: store.storeId,
                storeNumber: store.storeNumber,
                address: store.address,
                phone: store.phone,
                coordinates: store.coordinates,
            },
            openingHours: store.openingHours,
        }));
        return res.status(200).json(stores);
    }
    res.status(400).json({ error: 'No stores found' });
}

/**
 * Express route: Save Rossmann store
 *
 * @route POST /api/rossmann/stores
 */
async function rossmannSaveStores(req, res) {
    const result = await storeStoresDB(req.body, 'rossmann');
    if (result.success) return res.status(201).json({ message: result.message });
    return res.status(400).json({ error: result.message });
}

/**
 * Express route: Delete Rossmann store by ID
 *
 * @route DELETE /api/rossmann/stores/:storeId
 */
async function rossmannDeleteStores(req, res) {
    const result = await deleteStoreById(req.params.storeId);
    res.status(result.success ? 200 : 404).json(result);
}

/**
 * Convert opening hours object into unified format
 * @param {Object} data
 * @returns {Object} Days mapped to arrays of { open, close }
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
 * Launch Playwright browser instance
 * @returns {Promise<import('playwright').Browser>}
 */
async function startBrowser() {
    try {
        const browser = await chromium.launch({ headless: false });
        console.log('✅ Playwright browser launched');
        return browser;
    } catch (err) {
        console.error('❌ Failed to launch Playwright browser:', err.message);
        throw err;
    }
}

export {
    rossmannStores,
    rossmannSavedStores,
    rossmannSaveStores,
    rossmannDeleteStores
};