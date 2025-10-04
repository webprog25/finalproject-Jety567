import Settings from './shema/Settings.js';
import bcrypt from 'bcryptjs';

/**
 * Express route: Get the singleton settings document.
 *
 * @route GET /api/settings
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * GET /api/settings
 * Response: { defaultLanguage: "en", darkMode: false, brands: [], pinEnabled: false, tokenEnabled: false, ... }
 */
async function getSettings(req, res) {
    try {
        const settings = await Settings.getSingleton();
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
}

/**
 * Express route: Create or update the singleton settings document.
 *
 * @route POST /api/settings
 * @param {import('express').Request} req - Body: { defaultLanguage, darkMode, stores, pin, pinEnabled, tokenEnabled }
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * POST /api/settings
 * Body: { "defaultLanguage": "en", "darkMode": true, "stores": ["dm","rossmann"], "pin": "123456", "pinEnabled": true, "tokenEnabled": false }
 */
async function createSettings(req, res) {
    try {
        const { defaultLanguage, darkMode, stores, pin, pinEnabled, tokenEnabled } = req.body;

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({
                defaultLanguage,
                darkMode,
                brands: stores,
                pinEnabled,
                tokenEnabled
            });
        } else {
            settings.defaultLanguage = defaultLanguage ?? settings.defaultLanguage;
            settings.darkMode = darkMode ?? settings.darkMode;
            settings.brands = stores ?? settings.brands;
            settings.pinEnabled = pinEnabled ?? settings.pinEnabled;
            settings.tokenEnabled = tokenEnabled ?? settings.tokenEnabled;
        }

        // Handle PIN
        if (pin) {
            const salt = await bcrypt.genSalt(10);
            settings.pin = await bcrypt.hash(pin, salt);
        } else {
            settings.pin = null;
        }

        settings.updatedAt = Date.now();
        await settings.save();

        res.json({ success: true, settings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save settings" });
    }
}

/**
 * Verify a plain PIN against the stored hashed PIN in settings.
 *
 * @param {string} plainPin - The PIN to verify.
 * @returns {Promise<boolean>} True if the PIN matches, false otherwise.
 *
 * @example
 * const isValid = await verifyPin("123456");
 */
async function verifyPin(plainPin) {
    try {
        const settingsDoc = await Settings.findOne();
        if (!settingsDoc || !settingsDoc.pin) return false; // no PIN set

        return await bcrypt.compare(plainPin, settingsDoc.pin);
    } catch (err) {
        console.error('Error verifying PIN:', err);
        return false;
    }
}

export {
    getSettings,
    createSettings,
    verifyPin,
};