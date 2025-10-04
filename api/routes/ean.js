import axios from "axios";
import { findDmProductByEan } from "./dm/product.js";
import Article from "../mongo_db/shema/Article.js";

/**
 * Express route: Lookup a product by EAN
 *
 * @route GET /api/lookup/:ean
 */
const lookup = async (req, res) => {
    try {
        const result = await lookupProductByEan(req.params.ean);
        if (!result) return res.sendStatus(404);

        res.json(result);
    } catch (err) {
        console.error('Lookup error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Lookup a product by EAN, checking local DB, OpenFoodFacts, then DM
 * @param {string} ean
 * @returns {Promise<{source: string, product: {name: string, brand: string}} | null>}
 */
async function lookupProductByEan(ean) {
    // 1️⃣ Check local database
    const article = await Article.findOne({ ean });
    if (article) {
        return {
            source: "Database",
            product: {
                brand: "",
                name: article.name,
            },
        };
    }

    // Helper to format product response
    const formatProduct = (source, product, nameKey, brandKey) => ({
        source,
        product: {
            name: product?.[nameKey] || 'Unknown',
            brand: product?.[brandKey] || 'Unknown',
        },
    });

    // 2️⃣ Try Open Food Facts
    try {
        const offResponse = await axios.get(
            `https://world.openfoodfacts.org/api/v0/product/${ean}.json`
        );
        const offData = offResponse.data;

        if (offData.status === 1 && offData.product.product_name) {
            return formatProduct(
                'OpenFoodFacts',
                offData.product,
                'product_name',
                'brands'
            );
        }

        console.log('Open Food Facts: Product not found, falling back...');
    } catch (err) {
        console.warn('Open Food Facts error:', err.message);
    }

    // 3️⃣ Fallback to DM
    try {
        const product = await findDmProductByEan(ean);
        if (!product) return null;

        return formatProduct('DM', product.title, 'headline', 'brand');
    } catch (err) {
        console.warn('DM error:', err.message);
        throw new Error('Failed to retrieve product data from any source.');
    }
}

export { lookup, lookupProductByEan };