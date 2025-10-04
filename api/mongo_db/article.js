const PRICE_UPDATE_THRESHOLD_DAYS = parseInt(process.env.PRICE_UPDATE_THRESHOLD_DAYS || '7', 10);
const AVAILABILITY_UPDATE_THRESHOLD_DAYS = parseInt(process.env.AVAILABILITY_UPDATE_THRESHOLD_DAYS || '2', 10);

import Article from "./shema/Article.js";
import Settings from "./shema/Settings.js";
import { getRossmannStoreAvailability, lookupRossmannProduct } from "../routes/rossmann/product.js";
import { dmStores, getDmStoreAvailability, lookupDmProduct } from "../routes/dm/index.js";
import { getMuellerStoreAvailability, lookupMuellerProduct } from "../routes/mueller.js";
import { getBudniStoreAvailability, lookupBudniProduct } from "../routes/budni.js";

/**
 * Creates a new article by fetching product details and store availability
 * from all configured brands and saving it into the database.
 *
 * @async
 * @function createNewArticle
 * @param {Object} body - Article data.
 * @param {string} body.ean - Product EAN code.
 * @param {string} body.name - Product name.
 * @returns {Promise<Article>} The created article document.
 *
 * @example
 * const newArticle = await createNewArticle({ ean: "1234567890123", name: "Shampoo" });
 */
async function createNewArticle(body) {
    try {
        let settings = await Settings.findOne();
        let brands = settings.brands;

        let article = {};
        article.price = {};
        article.productUrl = {};
        article.articleNumber = {};

        article.storeAvailability = {};

        article.ean = body.ean;
        article.name = body.name;

        let requests = [];
        brands.forEach(brand => {
            requests.push(getProductDetails(brand,body.ean));
        })

        let articles = await Promise.all(requests);
        let images = [];

        requests = [];

        articles.forEach((articleItem,index) => {
            article.price[brands[index]] = articleItem.price;
            article.productUrl[brands[index]] = articleItem.url;
            if (brands[index] === "dm")
                requests.push(getStoreAvailability(brands[index],articleItem.articleNumber));
            else
                requests.push(getStoreAvailability(brands[index],articleItem.url));
            article.articleNumber[brands[index]] = articleItem.articleNumber;
            images.push(articleItem.imageUrl);
        })

        article.imageUrl = chooseImage(images);

        let storeAvailability = await Promise.all(requests);
        storeAvailability.forEach((item,index) => {
            article.storeAvailability[brands[index]] = item;
        })

        let dbArticle = new Article(article);

        article = await dbArticle.save();

        return article;
    } catch (e) {
        console.error(e);
    }
}

/**
 * Chooses the first non-null image from an array of images.
 *
 * @function chooseImage
 * @param {string[]} values - Array of possible image URLs.
 * @returns {string|null} First non-null image URL or null.
 */
function chooseImage(values) {
    return values.reduce((result, current) => result ?? current, null);
}


/**
 * Fetches store availability information for a given brand.
 *
 * @async
 * @function getStoreAvailability
 * @param {"dm"|"rossmann"|"mueller"|"budni"} brand - Store brand identifier.
 * @param {string} productUrl - Product URL or article number (for DM).
 * @returns {Promise<Object[]>} Availability JSON array or empty list.
 *
 * @example
 * const availability = await getStoreAvailability("rossmann", "https://rossmann.de/product/123");
 */
async function getStoreAvailability(brand, productUrl) {
    if (productUrl === null || productUrl === undefined)
        return [];
    try {
        let json;

        switch (brand) {
            case "dm":
                json = await getDmStoreAvailability(productUrl);
                break;
            case "mueller":
                json = await getMuellerStoreAvailability(productUrl);
                break;
            case "rossmann":
                json = await getRossmannStoreAvailability(productUrl);
                break;
            case "budni":
                json = await getBudniStoreAvailability(productUrl);
                break;
            default:
                json = [];
                break;
        }

        return json;
    } catch (e) {
        console.error(e);
        return [];
    }
}


/**
 * Fetches product details (price, URL, article number, image) from a specific brand.
 *
 * @async
 * @function getProductDetails
 * @param {"dm"|"rossmann"|"mueller"|"budni"} brand - Store brand identifier.
 * @param {string} ean - Product EAN code.
 * @returns {Promise<Object>} Product details including {ean, url, price, imageUrl, articleNumber}.
 *
 * @example
 * const product = await getProductDetails("dm", "1234567890123");
 */
async function getProductDetails(brand, ean) {
    try {
        let json = null;
        switch (brand) {
            case "rossmann":
                json = await lookupRossmannProduct(ean);
                break;
            case "dm":
                json = await lookupDmProduct(ean);
                break;
            case "mueller":
                json = await lookupMuellerProduct(ean)
                break;
            case "budni":
                json = await lookupBudniProduct(ean);
                break;
            default:
                return {
                    ean: null,
                    url: null,
                    price: null,
                    imageUrl: null,
                    articleNumber: null,
                }
        }
        return json;
    } catch (e) {
        return {
            ean: null,
            url: null,
            price: null,
            imageUrl: null,
            articleNumber: null,
        }
    }
}

/**
 * Updates prices and product URLs for an existing article across all brands.
 *
 * @async
 * @function updateArticlePrices
 * @param {Article} article - Existing article document.
 * @returns {Promise<Article>} Updated article document.
 */
async function updateArticlePrices(article) {
    try {
        let settings = await Settings.findOne();
        let brands = settings.brands;

        let requests = [];
        brands.forEach(brand => {
            requests.push(getProductDetails(brand,article.ean));
        })

        let articles = await Promise.all(requests);

        for (let i = 0; i < articles.length; i++) {
            let item = articles[i];
            article.price[brands[i]] = item.price;
            article.productUrl[brands[i]] = item.url;
        }

        article.price.lastUpdated = new Date();

        return article;
    } catch (e) {
        console.error(e);
        return article;
    }
}

/**
 * Updates store availability for an article across all brands.
 *
 * @async
 * @function updateStoreAvailability
 * @param {Article} article - Existing article document.
 * @returns {Promise<Article>} Updated article document.
 */
async function updateStoreAvailability(article)  {
    try {
        let settings = await Settings.findOne();
        let keys = settings.brands
        let requests = [];

        for (let key of keys) {
            if (key === "dm")
                requests.push(getStoreAvailability(key,article.articleNumber[key]));
            else
                requests.push(getStoreAvailability(key,article.productUrl[key]));
        }

        let storeAvailability = await Promise.all(requests);

        storeAvailability.forEach((item,index) => {
            article.storeAvailability[keys[index]] = item;
        })

        article.storeAvailability.lastUpdated = new Date();

        return article;
    } catch (e) {
        return article;
    }
}


/**
 * Express route: Creates a new article or updates an existing one.
 *
 * @route POST /articles
 * @param {import('express').Request} req - Express request (expects {ean, name} in body).
 * @param {import('express').Response} res - Express response.
 * @returns {JSON} Success message and article object.
 *
 * @example
 * POST /articles
 * Body: { "ean": "1234567890123", "name": "Shampoo" }
 * Response: { "message": "New article created", "article": { ... } }
 */
async function createArticle(req, res) {
    try {
        const { ean, name } = req.body;
        const result = await upsertAndUpdateArticle({ ean, name });
        res.status(200).json(result);
    } catch (error) {
        console.error('createArticle error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}


/**
 * Creates a new article if it doesn't exist, otherwise updates price
 * and availability if thresholds are exceeded.
 *
 * @async
 * @function upsertAndUpdateArticle
 * @param {Object} input - Input parameters.
 * @param {string} input.ean - Product EAN code.
 * @param {string} input.name - Product name.
 * @returns {Promise<{message: string, article: Article}>}
 */
async function upsertAndUpdateArticle({ ean, name }) {
    if (!ean || !name) {
        throw new Error('EAN and Name are required');
    }

    let article = await Article.findOne({ ean });

    if (!article) {
        article = await createNewArticle({ ean, name });
        return { message: 'New article created', article };
    }

    const now = Date.now();
    const priceThresholdMs = PRICE_UPDATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const availabilityThresholdMs = AVAILABILITY_UPDATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    // Price update
    const priceUpdated = article?.price?.lastUpdated;
    if (!priceUpdated || now - new Date(priceUpdated).getTime() > priceThresholdMs) {
        article = await updateArticlePrices(article);
    }

    // Availability update
    const availabilityUpdated = article?.storeAvailability?.lastUpdated;
    if (!availabilityUpdated || now - new Date(availabilityUpdated).getTime() > availabilityThresholdMs) {
        article = await updateStoreAvailability(article);
    }

    await article.save();

    return { message: 'Article retrieved/updated', article };
}


/**
 * Express route: Force update store availability for a specific article.
 *
 * @route PUT /articles/:ean/availability
 * @param {import('express').Request} req - Express request (expects EAN in params).
 * @param {import('express').Response} res - Express response.
 * @returns {JSON} Updated article object.
 *
 * @example
 * PUT /articles/1234567890123/availability
 * Response: { "storeAvailability": { ... }, "storeId": "..." }
 */
async function updateStoresAvailabilityArticle(req, res) {
    try {
        const ean = req.params.ean;

        if (!ean) return res.status(400).json({ message: 'EAN or Name is required' });

        let article = await Article.findOne({ ean: ean });

        if (!article) {
            return res.status(404).json({ message: 'No Article found', error: ean });
        }

        article = await updateStoreAvailability(article);

        let result = await article.save();

        res.status(200).json(result);
    } catch (e) {
        console.error('updateStoresAvailabilityArticle', e);
        return res.status(500).json({ message: 'Server error', error: e });
    }
}

/**
 * Express route: Force update article prices for a specific article.
 *
 * @route PUT /articles/:ean/prices
 * @param {import('express').Request} req - Express request (expects EAN in params).
 * @param {import('express').Response} res - Express response.
 * @returns {JSON} Updated article object.
 *
 * @example
 * PUT /articles/1234567890123/prices
 * Response: { "price": { ... }, "lastUpdated": "2025-10-04T12:00:00Z" }
 */
async function updatePriceArticle(req, res) {
    try {
        const ean = req.params.ean;

        if (!ean) return res.status(400).json({ message: 'EAN or Name is required' });

        let article = await Article.findOne({ ean: ean });

        if (!article) {
            return res.status(404).json({ message: 'No Article found', error: ean });
        }

        article = await updateArticlePrices(article);

        let result = await article.save();

        res.status(200).json(result);
    } catch (e) {
        console.error('updateStoresAvailabilityArticle', e);
        return res.status(500).json({ message: 'Server error', error: e });
    }
}


/**
 * Express route: Fetch all articles.
 *
 * @route GET /articles
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {JSON[]} Array of all articles.
 *
 * @example
 * GET /articles
 * Response: [{ "ean": "...", "name": "...", ... }, ...]
 */
async function allArticles(req, res) {
    try {
        const articles = await Article.find().lean();
        return res.status(200).json(articles);
    } catch (err) {
        console.error("allArticles error:", err.message);
        return res.status(500).json({
            message: "Failed to fetch articles",
            error: err.message || "Server error"
        });
    }
}

/**
 * Express route: Fetch a single article by MongoDB ObjectId or EAN.
 *
 * @route GET /articles/:id
 * @param {import('express').Request} req - Express request (expects `id` param).
 * @param {import('express').Response} res - Express response.
 * @returns {JSON} Article object.
 *
 * @example
 * GET /articles/1234567890123
 * Response: { "ean": "1234567890123", "name": "Shampoo", ... }
 */
async function oneArticle(req, res) {
    try {
        const { id } = req.params;

        if (!id) return res.status(400).json({ error: "Missing value" });

        // Determine if it's a valid ObjectId
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

        const article = isObjectId
            ? await Article.findById(id)
            : await Article.findOne({ ean: id });

        if (!article) return res.status(404).json({ error: "Article not found" });

        return res.status(200).json(article);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Server error" });
    }
}

/**
 * Express route: Delete an article by MongoDB ObjectId.
 *
 * @route DELETE /articles/:id
 * @param {import('express').Request} req - Express request (expects `id` param).
 * @param {import('express').Response} res - Express response.
 * @returns {JSON} Success message and deleted article.
 *
 * @example
 * DELETE /articles/64f3a1b9f5e2a3c7b4567890
 * Response: { "message": "Article deleted successfully", "deletedArticle": { ... } }
 */
async function deleteArticle(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Missing article ID" });
        }

        // Correct usage of findByIdAndDelete
        const result = await Article.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ error: "Article not found" });
        }

        res.status(200).json({ message: "Article deleted successfully", deletedArticle: result });
    } catch (e) {
        console.error("deleteArticle error:", e);
        return res.status(500).json({ error: e.message || e });
    }
}

export {
    createArticle,
    updateStoresAvailabilityArticle,
    updatePriceArticle,
    allArticles,
    oneArticle,
    deleteArticle,
    upsertAndUpdateArticle
}