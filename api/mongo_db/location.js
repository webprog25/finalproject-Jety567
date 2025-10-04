import LocationItem from './shema/LocationItem.js';
import { getLanguages, getLanguagesShort } from "../routes/language.js";
import { translate } from '@vitalets/google-translate-api';
import mongoose from 'mongoose';

/**
 * Sanitize a name string to a standard format for storage.
 *
 * @param {string} name
 * @returns {string} Sanitized name
 */
function sanitizeName(name) {
    return name.replaceAll(" ", "_")
        .replaceAll('ü', 'ue')
        .replaceAll('ö', 'oe')
        .replaceAll('ä', 'ae')
        .toLowerCase();
}

/**
 * Express route: Create a new location with translations for all supported languages.
 *
 * @route POST /api/location
 * @param {import('express').Request} req - Body: { name }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * POST /api/location
 * Body: { "name": "Bakery" }
 * Response: { "_id": "...", "name": "bakery", "languages": { "en": "Bakery", "de": "Bäckerei", ... } }
 */
async function createLocation(req, res) {
    try {
        const { name } = req.body;
        if (!name) return res.status(401).send({ error: "Missing name" });

        const translations = {};
        const languages = await getLanguagesShort();

        for (const lang of languages) {
            try {
                const result = await translate(name, { to: lang });
                translations[lang] = result.text;
            } catch (err) {
                console.error(`Translation to ${lang} failed:`, err);
                translations[lang] = name; // fallback to original
            }
        }

        const location = new LocationItem({
            name: sanitizeName(name),
            languages: translations
        });

        await location.save();
        res.status(201).json(location);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

/**
 * Express route: Get all locations, sorted alphabetically by name.
 *
 * @route GET /api/location
 */
async function getLocations(req, res) {
    try {
        const locations = await LocationItem.find().sort({ name: 1 });
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Express route: Get a single location by ID or return sanitized name if not ObjectId.
 *
 * @route GET /api/location/:id
 */
async function getLocation(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(401).send({ error: "Missing id" });

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.json({ name: id });
        }

        const location = await LocationItem.findById(id);
        res.json(location);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/**
 * Express route: Delete a location by ID.
 *
 * @route DELETE /api/location/:id
 */
async function deleteLocation(req, res) {
    try {
        const deleted = await LocationItem.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Location not found' });

        res.json({ message: 'Location deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export {
    createLocation,
    getLocations,
    getLocation,
    deleteLocation
};