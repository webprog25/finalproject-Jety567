import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const defaultPin = "000000";
const salt = bcrypt.genSaltSync(10);
const hashedDefaultPin = bcrypt.hashSync(defaultPin, salt);

/**
 * Mongoose schema for application-wide settings.
 * This model is designed as a singleton: only one document
 * should exist in the database at any time.
 *
 * @typedef {Object} Settings
 * @property {string} defaultLanguage - The default language of the application. Defaults to `"en"`.
 * @property {boolean} darkMode - Whether dark mode is enabled. Defaults to `false`.
 * @property {string[]} brands - A list of preferred brands stored as strings. Defaults to an empty array.
 * @property {string} pin - A hashed security PIN. Defaults to the hash of `"000000"`.
 * @property {boolean} pinEnabled - Whether the PIN protection is enabled. Defaults to `false`.
 * @property {boolean} tokenEnabled - Whether token-based authentication is enabled. Defaults to `false`.
 * @property {Date} updatedAt - Timestamp of the last update to the settings.
 */
const SettingsSchema = new mongoose.Schema({
    defaultLanguage: {
        type: String,
        default: "en",
    },
    darkMode: {
        type: Boolean,
        default: false,
    },
    brands: {
        type: Array,
        default: [],
    },
    pin: {
        type: String,
        default: hashedDefaultPin, // hashed "000000"
    },
    pinEnabled: {
        type: Boolean,
        default: false, // false by default, can be switched on/off
    },
    tokenEnabled: {
        type: Boolean,
        default: false,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

/**
 * Retrieves the singleton `Settings` document.
 * If no settings document exists, it creates one with default values.
 *
 * @function getSingleton
 * @memberof SettingsSchema.statics
 * @returns {Promise<Settings>} The singleton settings document.
 *
 * @example
 * const settings = await Settings.getSingleton();
 * console.log(settings.defaultLanguage); // "en" (if not modified)
 */
SettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

export default mongoose.model("Settings", SettingsSchema);