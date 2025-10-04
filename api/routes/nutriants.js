import axios from "axios";
import Nutriments from "../mongo_db/shema/Nutriments.js";

// ------------------------
// Helper Functions
// ------------------------

/**
 * Fetch nutriments from local MongoDB by EAN.
 * @param {string} ean
 * @returns {Promise<Object|null>}
 */
async function fetchFromDB(ean) {
    return Nutriments.findOne({ ean });
}

/**
 * Fetch nutriments from OpenFoodFacts API by EAN.
 * @param {string} ean
 * @returns {Promise<Object|null>}
 */
async function fetchFromOpenFoodFacts(ean) {
    try {
        const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);

        if (response.status === 404) return null;
        if (response.status !== 200) throw new Error("OpenFoodFacts request failed");

        const data = response.data;
        if (data.status === 0) return null;

        const nutriments = data.product.nutriments || {};

        return {
            ean,
            energy_kj: nutriments["energy-kj_100g"] ?? null,
            energy_kcal: nutriments["energy-kcal_100g"] ?? null,
            fat: nutriments["fat_100g"] ?? null,
            saturated_fat: nutriments["saturated-fat_100g"] ?? null,
            carbohydrates: nutriments["carbohydrates_100g"] ?? null,
            sugars: nutriments["sugars_100g"] ?? null,
            fiber: nutriments["fiber_100g"] ?? null,
            proteins: nutriments["proteins_100g"] ?? null,
            salt: nutriments["salt_100g"] ?? null,
        };
    } catch (err) {
        if (err.response && err.response.status === 404) return null;
        throw err;
    }
}

/**
 * Determines if fallback source is required.
 * @param {Object|null} result
 * @returns {boolean}
 */
function needsFallback(result) {
    if (!result) return true;
    const nullCount = Object.values(result).filter(v => v === null).length;
    return nullCount >= 2;
}

/**
 * Fetch nutriments from fallback source (e.g., DM product page)
 * @param {string} url
 * @returns {Promise<Array|null>}
 */
async function fetchFromFallback(url) {
    try {
        const response = await axios.get(url);
        if (response.status === 404) return null;
        if (response.status !== 200) throw new Error("Fallback request failed");

        let nutris = null;
        for (let header of response.data.descriptionGroups) {
            if (header.header === "Nährwerte") {
                nutris = header.contentBlock;
                break;
            }
        }

        return nutris?.[0]?.table || [];
    } catch (err) {
        if (err.response && err.response.status === 404) return null;
        throw err;
    }
}

/**
 * Map fallback table data into standard nutriments format
 * @param {Array} table
 * @param {Object} result
 * @returns {Object}
 */
function mapFallbackTable(table, result) {
    table.forEach(([key, value]) => {
        if (!value) return;

        const cleanValue = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes("brennwert")) {
            const match = value.match(/(\d+)\s*kJ\s*\/\s*(\d+)\s*kcal/);
            if (match) {
                result.energy_kj = parseFloat(match[1]);
                result.energy_kcal = parseFloat(match[2]);
            }
        } else if (lowerKey.includes("fett") && !lowerKey.includes("gesättigt")) {
            result.fat = cleanValue;
        } else if (lowerKey.includes("gesättigte")) {
            result.saturated_fat = cleanValue;
        } else if (lowerKey.includes("kohlenhydrate")) {
            result.carbohydrates = cleanValue;
        } else if (lowerKey.includes("zucker")) {
            result.sugars = cleanValue;
        } else if (lowerKey.includes("eiweiß")) {
            result.proteins = cleanValue;
        } else if (lowerKey.includes("salz")) {
            result.salt = cleanValue;
        }
    });

    return result;
}

/**
 * Save nutriments object into MongoDB.
 * @param {Object} result
 * @returns {Promise<Object>}
 */
async function saveToDB(result) {
    return Nutriments.create(result);
}

// ------------------------
// Main Controller
// ------------------------

/**
 * GET /api/nutri/:ean
 * Retrieves nutriments info for a product by EAN.
 * Workflow:
 * 1. Check MongoDB cache
 * 2. Query OpenFoodFacts
 * 3. Fallback to DM page if necessary
 * 4. Save & return the data
 */
async function getNutriByEAN(req, res) {
    try {
        const ean = req.params.ean;
        if (!ean) return res.status(400).send("No EAN provided");

        const fallbackUrl = `https://products.dm.de/product/DE/products/detail/gtin/${ean}`;

        // 1️⃣ Check DB
        const cached = await fetchFromDB(ean);
        if (cached) return res.json(cached);

        // 2️⃣ Try OpenFoodFacts
        let result = await fetchFromOpenFoodFacts(ean);

        // 3️⃣ Fallback if needed
        if (!result || needsFallback(result)) {
            const table = await fetchFromFallback(fallbackUrl);

            if (!table) {
                return res.status(404).json({ error: "Product not found" });
            }

            result = mapFallbackTable(table, result || { ean });
        }

        // 4️⃣ Save & return
        const saved = await saveToDB(result);
        return res.json(saved);

    } catch (err) {
        console.error("Nutri endpoint error:", err);
        return res.status(500).json({ error: err.message || "Server error" });
    }
}

export { getNutriByEAN };