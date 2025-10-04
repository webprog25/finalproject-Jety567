/**
 * Rossmann Module Index
 *
 * Aggregates and re-exports all Rossmann-related functions for products, stores, and receipts.
 *
 * Exports:
 * - Product functions: rossmannProduct, rossmannProductPrice, rossmannStoreProduct, getRossmannStoreAvailability
 * - Store functions: rossmannStores, rossmannSavedStores, rossmannSaveStores, rossmannDeleteStores
 * - Receipt functions: extraPDFReceipt
 */

import { rossmannProduct, rossmannProductPrice, rossmannStoreProduct, getRossmannStoreAvailability } from "./product.js";
import { rossmannStores, rossmannSavedStores, rossmannSaveStores, rossmannDeleteStores } from "./store.js";
import { extraPDFReceipt } from "./reciepts.js";

export {
    // Product functions
    rossmannProduct,
    rossmannProductPrice,
    rossmannStoreProduct,
    getRossmannStoreAvailability,

    // Store functions
    rossmannStores,
    rossmannSavedStores,
    rossmannSaveStores,
    rossmannDeleteStores,

    // Receipt functions
    extraPDFReceipt
};