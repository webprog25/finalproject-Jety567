import mongoose from 'mongoose';

/**
 * Subschema for representing opening hours for a single day.
 *
 * @typedef {Object} OpeningHour
 * @property {string} open - Opening time in HH:mm format (e.g., "08:00").
 * @property {string} close - Closing time in HH:mm format (e.g., "20:00").
 */
const OpeningHourSchema = new mongoose.Schema(
    {
        open: { type: String, required: true },   // e.g. "08:00"
        close: { type: String, required: true },  // e.g. "20:00"
    },
    { _id: false }
);

/**
 * Subschema for representing a store's address.
 *
 * @typedef {Object} Address
 * @property {string} name - Name of the store branch or location.
 * @property {string} street - Street name and number.
 * @property {string|null} streetAdditional - Additional address information (e.g., suite number). Defaults to null.
 * @property {string} zip - Postal/ZIP code.
 * @property {string} city - City name.
 * @property {string|null} regionName - Region or state name. Defaults to null.
 */
const AddressSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        street: { type: String, required: true },
        streetAdditional: { type: String, default: null },
        zip: { type: String, required: true },
        city: { type: String, required: true },
        regionName: { type: String, default: null },
    },
    { _id: false }
);

/**
 * Mongoose schema for representing a store, including its
 * brand, location, contact details, and weekly opening hours.
 *
 * @typedef {Object} Store
 * @property {string} storeId - Unique identifier for the store. Required and unique.
 * @property {string} storeNumber - Store number (as used by the brand). Required.
 * @property {"mueller"|"dm"|"rossmann"|"budni"} brand - The retail brand of the store. Required.
 * @property {Address} address - The store’s physical address. Required.
 * @property {string|null} phone - Store phone number. Defaults to null.
 * @property {[number, number]} coordinates - Store location coordinates in `[latitude, longitude]` format. Required.
 * @property {Object} openingHours - Weekly opening hours for the store.
 * @property {OpeningHour[]} openingHours.Monday - Opening hours for Monday.
 * @property {OpeningHour[]} openingHours.Tuesday - Opening hours for Tuesday.
 * @property {OpeningHour[]} openingHours.Wednesday - Opening hours for Wednesday.
 * @property {OpeningHour[]} openingHours.Thursday - Opening hours for Thursday.
 * @property {OpeningHour[]} openingHours.Friday - Opening hours for Friday.
 * @property {OpeningHour[]} openingHours.Saturday - Opening hours for Saturday.
 * @property {OpeningHour[]} openingHours.Sunday - Opening hours for Sunday.
 */
const StoreSchema = new mongoose.Schema({
    storeId: { type: String, required: true, unique: true },
    storeNumber: { type: String, required: true },
    brand: {
        type: String,
        required: true,
        enum: ['mueller', 'dm', 'rossmann', 'budni'],
    },
    address: { type: AddressSchema, required: true },
    phone: { type: String, default: null },
    coordinates: {
        type: [Number], // [lat, lng]
        validate: {
            validator: (arr) => arr.length === 2,
            message: 'Coordinates must be [latitude, longitude]',
        },
        required: true,
    },
    openingHours: {
        Monday: { type: [OpeningHourSchema], default: [] },
        Tuesday: { type: [OpeningHourSchema], default: [] },
        Wednesday: { type: [OpeningHourSchema], default: [] },
        Thursday: { type: [OpeningHourSchema], default: [] },
        Friday: { type: [OpeningHourSchema], default: [] },
        Saturday: { type: [OpeningHourSchema], default: [] },
        Sunday: { type: [OpeningHourSchema], default: [] },
    },
});

export default mongoose.model('Store', StoreSchema);