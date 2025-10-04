// initApi.js
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import multer from 'multer';
import morgan from "morgan";
import dotenv from "dotenv";

import { lookup } from "./routes/ean.js";
import { connectToDatabase } from "./mongo_db/index.js";

import {
    rossmannProduct,
    rossmannProductPrice,
    rossmannStores,
    rossmannStoreProduct,
    rossmannSavedStores,
    rossmannSaveStores,
    rossmannDeleteStores,
    extraPDFReceipt as extraPDFReceiptRossmann
} from "./routes/rossmann/index.js";

import {
    dmProduct,
    dmProductPrice,
    dmStores,
    dmStoreProduct,
    dmSavedStores,
    dmSaveStores,
    dmDeleteStores,
    extraPDFReceipt
} from "./routes/dm/index.js";

import {
    muellerProduct,
    muellerProductPrice,
    muellerStores,
    muellerStoreProduct,
    initMuellerCache,
    muellerSavedStores,
    muellerSaveStores,
    muellerDeleteStores
} from "./routes/mueller.js";

import {
    budniDeleteStores, budniProduct, budniProductPrice, budniSavedStores, budniSaveStores,
    budniStoreProduct, budniStores
} from './routes/budni.js'

import {
    createArticle,
    updateStoresAvailabilityArticle,
    updatePriceArticle,
    allArticles,
    oneArticle,
    deleteArticle
} from "./mongo_db/article.js";

import {
    createShelfItemEan,
    createQrCodeItem,
    shelfEanItem,
    useShelfEanItem,
    shelfLocationItem,
    deleteShelfItem,
    shelfItemOverview,
    expirySoon,
    searchItem
} from "./mongo_db/item.js";

import { initCluster } from "./utils/PuppeteerClusterUtil.js";
import { createLocation, deleteLocation, getLocations, getLocation } from "./mongo_db/location.js";
import { getLanguages } from "./routes/language.js";
import { createSettings, getSettings } from "./mongo_db/settings.js";
import { getStoresById } from "./mongo_db/stores.js";
import { getNutriByEAN } from "./routes/nutriants.js";
import {
    getListItems,
    addListItem,
    deleteListItem,
    incrementListItem,
    decrementListItem,
    items,
    getListItem
} from "./mongo_db/listItem.js";
import { tokens, createToken, deleteToken } from "./mongo_db/tokens.js";

const upload = multer({ dest: 'uploads/' });

/**
 * Initialize API routes
 * @param {express.Application} app - Express app instance
 */
const initApi = async (app) => {
    await connectToDatabase(process.env.DATABASE_URL);
    await initMuellerCache();
    await initCluster();

    app.set('json spaces', 2);
    app.use(cors());
    app.use(bodyParser.json());
    app.use(morgan("dev"));

    const api = express.Router();
    app.use('/api', api);

    /** ----------------- Language API ----------------- */
    api.get('/languages', getLanguages);

    /** ----------------- Nutrients API ----------------- */
    api.get('/nutrients/:ean', getNutriByEAN);

    /** ----------------- Shelf Item API ----------------- */
    api.post('/shelf/item/ean', createShelfItemEan);
    api.post('/shelf/item/qr', createQrCodeItem);
    api.get('/shelf/item/search', searchItem);
    api.get('/shelf/item/ean/:ean', shelfEanItem);
    api.get('/shelf/item/overview', shelfItemOverview);
    api.get('/shelf/item/expiry/soon', expirySoon);
    api.delete('/shelf/item/:id', deleteShelfItem);
    api.get('/shelf/item/location/:location', shelfLocationItem);
    api.put('/shelf/item/use/ean/:id', useShelfEanItem);

    /** ----------------- Article API ----------------- */
    api.post('/article', createArticle);
    api.get('/article/:id', oneArticle);
    api.delete('/article/:id', deleteArticle);
    api.get('/articles', allArticles);
    api.put('/article/stores/:ean', updateStoresAvailabilityArticle);
    api.put('/article/prices/:ean', updatePriceArticle);

    /** ----------------- List Item API ----------------- */
    api.get("/list/item/article/:type", items);
    api.get("/list/item/:type/:ean", getListItem);
    api.get("/list/item/:type", getListItems);
    api.post("/list/item/:type", addListItem);
    api.delete("/list/item/:type/:ean", deleteListItem);
    api.put("/list/item/:type/:ean/increment", incrementListItem);
    api.put("/list/item/:type/:ean/decrement", decrementListItem);

    /** ----------------- Token API ----------------- */
    api.get('/tokens', tokens);
    api.post('/tokens', createToken);
    api.delete('/tokens/:id', deleteToken);

    /** ----------------- Stores API ----------------- */
    api.get('/store/:id', getStoresById);

    /** ----------------- Locations API ----------------- */
    api.get('/location', getLocations);
    api.get('/location/:id', getLocation);
    api.post('/location', createLocation);
    api.delete('/location/:id', deleteLocation);

    /** ----------------- Settings API ----------------- */
    api.get('/settings', getSettings);
    api.post('/settings', createSettings);

    /** ----------------- EAN Lookup API ----------------- */
    api.get('/lookup/:ean', lookup);

    /** ----------------- Rossmann API ----------------- */
    api.post('/rossmann/receipt', upload.single('pdf'), extraPDFReceiptRossmann);
    api.get('/rossmann/store', rossmannSavedStores);
    api.post('/rossmann/store', rossmannSaveStores);
    api.delete('/rossmann/store/:storeId', rossmannDeleteStores);
    api.get('/rossmann/store/product', rossmannStoreProduct);
    api.get('/rossmann/store/location/:searchParam', rossmannStores);
    api.get('/rossmann/ean/:ean', rossmannProduct);
    api.get('/rossmann/product', rossmannProductPrice);

    /** ----------------- Budni API ----------------- */
    api.get('/budni/store', budniSavedStores);
    api.post('/budni/store', budniSaveStores);
    api.delete('/budni/store/:storeId', budniDeleteStores);
    api.get('/budni/store/product', budniStoreProduct);
    api.get('/budni/store/location/:searchParam', budniStores);
    api.get('/budni/ean/:ean', budniProduct);
    api.get('/budni/product', budniProductPrice);

    /** ----------------- DM API ----------------- */
    api.post('/dm/receipt', upload.single('pdf'), extraPDFReceipt);
    api.get('/dm/store', dmSavedStores);
    api.post('/dm/store', dmSaveStores);
    api.delete('/dm/store/:storeId', dmDeleteStores);
    api.get('/dm/store/product/:articleNr', dmStoreProduct);
    api.get('/dm/store/location/:searchParam', dmStores);
    api.get('/dm/ean/:ean', dmProduct);
    api.get('/dm/product', dmProductPrice);

    /** ----------------- Müller API ----------------- */
    api.get('/mueller/store', muellerSavedStores);
    api.post('/mueller/store', muellerSaveStores);
    api.delete('/mueller/store/:storeId', muellerDeleteStores);
    api.get('/mueller/store/product', muellerStoreProduct);
    api.get('/mueller/store/location/:searchParam', muellerStores);
    api.get('/mueller/ean/:ean', muellerProduct);
    api.get('/mueller/product', muellerProductPrice);

    /** ----------------- Default Routes ----------------- */
    api.get("/", (req, res) => {
        res.json({ message: "Hello, world!" });
    });

    api.all("/*", (req, res) => {
        res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.url}` });
    });
};

export default initApi;