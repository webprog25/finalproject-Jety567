import mongoose from 'mongoose'

/**
 * Mongoose schema for storing product articles and their details
 * across different retail stores.
 *
 * @typedef {Object} Article
 * @property {string} ean - The unique European Article Number (EAN) for the product. Required and unique.
 * @property {string} name - The name of the product.
 * @property {Object} price - Price information from different stores.
 * @property {number} price.dm - Price of the product in DM stores.
 * @property {number} price.rossmann - Price of the product in Rossmann stores.
 * @property {number} price.mueller - Price of the product in Müller stores.
 * @property {number} price.budni - Price of the product in Budni stores.
 * @property {Date} price.lastUpdated - The last date/time the price information was updated.
 *
 * @property {string} imageUrl - URL to the product’s image.
 *
 * @property {Object} productUrl - Direct product page URLs in different stores.
 * @property {string} productUrl.dm - Product URL in DM store.
 * @property {string} productUrl.rossmann - Product URL in Rossmann store.
 * @property {string} productUrl.mueller - Product URL in Müller store.
 * @property {string} productUrl.budni - Product URL in Budni store.
 *
 * @property {Object} articleNumber - Store-specific product identifiers.
 * @property {string} articleNumber.dm - Article number in DM store.
 * @property {string} articleNumber.rossmann - Article number in Rossmann store.
 * @property {string} articleNumber.mueller - Article number in Müller store.
 * @property {string} articleNumber.budni - Article number in Budni store.
 *
 * @property {Object} storeAvailability - Availability information across different stores.
 * @property {Array<{storeId: string, quantity: number, available: boolean}>} storeAvailability.dm - Availability in DM stores.
 * @property {Array<{storeId: string, quantity: number, available: boolean}>} storeAvailability.rossmann - Availability in Rossmann stores.
 * @property {Array<{storeId: string, quantity: number, available: boolean}>} storeAvailability.mueller - Availability in Müller stores.
 * @property {Array<{storeId: string, quantity: number, available: boolean}>} storeAvailability.budni - Availability in Budni stores.
 * @property {Date} storeAvailability.lastUpdated - The last date/time the availability information was updated.
 *
 * @property {Date} createdAt - The date/time when the product was created in the database.
 * @property {Date} updatedAt - The date/time when the product was last updated in the database.
 */
const articleSchema = new mongoose.Schema(
    {
        ean: { type: String, required: true, unique: true },
        name: String,
        price: {
            dm: Number,
            rossmann: Number,
            mueller: Number,
            budni: Number,
            lastUpdated: {
                type: Date,
                default: Date.now,
            },
        },
        imageUrl: String,
        productUrl: {
            dm: String,
            rossmann: String,
            mueller: String,
            budni: String,
        },
        articleNumber: {
            dm: String,
            rossmann: String,
            mueller: String,
            budni: String,
        },
        storeAvailability: {
            dm: [{ storeId: String, quantity: Number, available: Boolean }],
            rossmann: [{ storeId: String, quantity: Number, available: Boolean }],
            mueller: [{ storeId: String, quantity: Number, available: Boolean }],
            budni: [{ storeId: String, quantity: Number, available: Boolean }],
            lastUpdated: {
                type: Date,
                default: Date.now,
            },
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('Article', articleSchema);