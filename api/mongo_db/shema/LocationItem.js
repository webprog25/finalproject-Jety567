import mongoose from 'mongoose';

/**
 * Mongoose schema for representing a location (e.g., a store,
 * aisle, or place) with multilingual support for its name.
 *
 * @typedef {Object} LocationItem
 * @property {string} name - The unique default name of the location. Required and unique.
 * @property {Map<string, string>} languages - A map of language codes to translated names.
 * For example: `{ "en": "Bakery", "de": "Bäckerei" }`. Required.
 * @property {Date} createdAt - Timestamp of when the location item was created.
 * @property {Date} updatedAt - Timestamp of the last update to the location item.
 */
const LocationItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        languages: {
            type: Map,
            of: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('LocationItem', LocationItemSchema);