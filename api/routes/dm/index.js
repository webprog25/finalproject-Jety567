/**
 * DM Module Index
 *
 * Aggregates and re-exports all DM-related functions for products, stores, and receipts.
 *
 * Exports:
 * - Product functions: dmProduct, dmProductPrice, dmStoreProduct, lookupDmProduct, getDmStoreAvailability
 * - Store functions: dmStores, dmSavedStores, dmSaveStores, dmDeleteStores
 * - Receipt functions: extraPDFReceipt
 */

import { dmProduct, dmStoreProduct, dmProductPrice, lookupDmProduct, getDmStoreAvailability } from './product.js';
import { dmStores, dmSavedStores, dmSaveStores, dmDeleteStores } from './store.js';
import { extraPDFReceipt } from './reciepts.js';

export {
    // Product functions
    dmProduct,
    dmProductPrice,
    dmStoreProduct,
    lookupDmProduct,
    getDmStoreAvailability,

    // Store functions
    dmStores,
    dmSavedStores,
    dmSaveStores,
    dmDeleteStores,

    // Receipt functions
    extraPDFReceipt
};