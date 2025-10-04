import Store from './shema/Store.js';

const allowedBrands = ['mueller', 'dm', 'rossmann', 'budni'];

/**
 * Inserts a store into the database, enforcing brand limits and deduplication.
 *
 * @param {Object} body - JSON payload containing store data and opening hours.
 * @param {string} brand - Brand name: 'mueller', 'dm', 'rossmann', or 'budni'.
 * @returns {Promise<{ success: boolean, message: string }>}
 *
 * @example
 * await storeStoresDB({ data: { storeId: "123", storeNumber: "001", coordinates: [51.5, 10.0], address: {...} } }, "dm");
 */
async function storeStoresDB(body, brand) {
    try {
        brand = brand.toLowerCase();
        if (!allowedBrands.includes(brand)) return { success: false, message: 'Invalid brand specified' };

        const storeData = body?.data;
        const openingHours = body?.openingHours;

        if (storeData?.coordinates && typeof storeData.coordinates === "object" && !Array.isArray(storeData.coordinates)) {
            const { lat, lon } = storeData.coordinates;
            if (typeof lat === "number" && typeof lon === "number") storeData.coordinates = [lat, lon];
        }

        if (!storeData?.storeId || !Array.isArray(storeData.coordinates)) {
            return { success: false, message: 'Missing or malformed store data' };
        }

        if (await Store.findOne({ storeId: storeData.storeId })) {
            return { success: false, message: 'Store with this ID already exists' };
        }

        const brandCount = await Store.countDocuments({ brand });
        if (brandCount >= 4) return { success: false, message: 'Brand store limit (4) reached' };

        const newStore = new Store({
            storeId: storeData.storeId,
            storeNumber: storeData.storeNumber,
            brand,
            address: storeData.address,
            phone: storeData.phone || null,
            coordinates: storeData.coordinates.map(Number),
            openingHours: openingHours || {}
        });

        await newStore.save();
        return { success: true, message: 'Store added successfully' };
    } catch (err) {
        console.error('storeStoresDB error:', err);
        return { success: false, message: 'Internal server error' };
    }
}

/**
 * Retrieves all stores for a given brand.
 *
 * @param {string} brand
 * @returns {Promise<{ success: boolean, data?: any[], message?: string }>}
 */
async function getStoresByBrand(brand) {
    try {
        brand = brand.toLowerCase();
        if (!allowedBrands.includes(brand)) return { success: false, message: 'Invalid brand specified' };

        const stores = await Store.find({ brand }).lean();
        return { success: true, data: stores };
    } catch (err) {
        console.error('getStoresByBrand error:', err);
        return { success: false, message: 'Internal server error' };
    }
}

/**
 * Deletes a store by its storeId.
 *
 * @param {string} storeId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function deleteStoreById(storeId) {
    try {
        const deleted = await Store.findOneAndDelete({ storeId });
        if (!deleted) return { success: false, message: 'Store not found' };

        return { success: true, message: 'Store deleted successfully' };
    } catch (err) {
        console.error('deleteStoreById error:', err);
        return { success: false, message: 'Internal server error' };
    }
}

/**
 * Express route: Get a store by its storeId.
 *
 * @route GET /api/stores/:id
 * @param {import('express').Request} req - Params: { id: storeId }
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * GET /api/stores/123
 */
async function getStoresById(req, res) {
    try {
        const { id: storeId } = req.params;
        if (!storeId) return res.status(400).json({ error: "Missing store ID" });

        const store = await Store.findOne({ storeId });
        if (!store) return res.status(404).json({ error: "Store not found" });

        res.status(200).json(store);
    } catch (err) {
        console.error("getStoresById error:", err);
        res.status(500).json({ error: err.message || "Server error" });
    }
}

export {
    storeStoresDB,
    getStoresByBrand,
    deleteStoreById,
    getStoresById
};