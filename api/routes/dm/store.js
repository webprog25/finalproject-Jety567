import fetch from 'node-fetch';
import { deleteStoreById, getStoresByBrand, storeStoresDB } from "../../mongo_db/stores.js";
import axios from "axios";

/**
 * Determine if input is a ZIP code (numeric string)
 * @param {string} input
 * @returns {boolean}
 */
function isZipCode(input) {
    return /^\d{4,10}$/.test(input.trim());
}

/**
 * Get coordinates (lat/lon) from ZIP code or location name using OpenStreetMap API
 * @param {string} input - ZIP code or location name
 * @returns {Promise<{ lat: number, lon: number }>} coordinates
 */
async function getCoordinates(input) {
    const query = encodeURIComponent(input.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'geo-checker/1.0' } });
        const data = await response.json();

        if (!data.length) throw new Error('Location not found');
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch (err) {
        console.error('Error fetching coordinates:', err.message);
        throw err;
    }
}

/**
 * Get DM stores near a postal code or location name
 * @param {string} searchParam
 * @returns {Promise<Array>} Array of stores with data and opening hours
 */
async function getStoresForPostalCode(searchParam) {
    try {
        const cord = await getCoordinates(searchParam);

        const request = await axios.get(
            `https://store-data-service.services.dmtech.com/stores/nearby/${cord.lat}%2C${cord.lon}/5?fields=storeId,countryCode,storeNumber,storeUrlPath,openingHours,phone,address,location,noPackageDeliveryAllowed,openingDate,extraClosingDates`
        );

        const stores = request.data.stores.map(store => ({
            data: {
                storeId: store.storeId,
                storeNumber: store.storeNumber,
                address: store.address,
                phone: store.phone,
                coordinates: store.location,
            },
            openingHours: openingHours(store.openingHours),
        }));

        return stores;
    } catch (err) {
        console.error('Error getStoresForPostalCode:', err);
        return [];
    }
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
 * Express route: Search DM stores by ZIP code or location
 *
 * @route GET /api/dm/stores/:searchParam
 */
async function dmStores(req, res) {
    try {
        const searchParam = req.params.searchParam;

        if (/^\d{5}$/.test(searchParam)) {
            const validPLZ = await isValidPLZ(searchParam);
            if (!validPLZ) return res.status(500).send({ error: 'Invalid PLZ' });
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
 * Express route: Retrieve all saved DM stores from database
 *
 * @route GET /api/dm/stores/saved
 */
async function dmSavedStores(req, res) {
    const result = await getStoresByBrand('dm');
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
        res.status(200).json(stores);
    } else {
        res.status(400).json({ error: 'No stores found' });
    }
}

/**
 * Express route: Save a new DM store
 *
 * @route POST /api/dm/stores
 */
async function dmSaveStores(req, res) {
    const result = await storeStoresDB(req.body, 'dm');
    if (result.success) return res.status(201).json({ message: result.message });
    return res.status(400).json({ error: result.message });
}

/**
 * Express route: Delete a DM store by storeId
 *
 * @route DELETE /api/dm/stores/:storeId
 */
async function dmDeleteStores(req, res) {
    const result = await deleteStoreById(req.params.storeId);
    res.status(result.success ? 200 : 404).json(result);
}

/**
 * Convert API opening hours to unified day-based format
 * @param {Array} data
 * @returns {Object} Days mapped to array of {open, close} times
 */
function openingHours(data) {
    const dayMap = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
    const unified = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };

    data.forEach(entry => {
        const day = dayMap[entry.weekDay];
        unified[day] = entry.timeRanges.map(r => ({ open: r.opening, close: r.closing }));
    });

    return unified;
}

export {
    dmStores,
    dmSavedStores,
    dmSaveStores,
    dmDeleteStores
};