import fs from 'fs';
import path from 'path';

/**
 * Reads all JSON language files from `public/locales` and returns
 * an object mapping language keys to their label and flag.
 *
 * @returns {Promise<Object<string, {label: string, flag: string}>>}
 *          Mapping of language code to language info
 */
async function getLanguage() {
    const languages = {};
    try {
        const files = fs.readdirSync('public/locales'); // synchronous read is okay here
        for (const file of files) {
            if (file.endsWith('.json')) {
                const langKey = file.replace('.json', '');
                const filePath = path.join('public/locales', file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                languages[langKey] = {
                    label: content.label,
                    flag: content.flag,
                };
            }
        }
        return languages;
    } catch (err) {
        console.error('Error reading locales folder:', err);
        return null;
    }
}

/**
 * Express route: GET /api/languages
 *
 * Returns all available languages with their labels and flags.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
async function getLanguages(req, res) {
    try {
        const languages = await getLanguage();
        res.status(200).json(languages);
    } catch (err) {
        console.error('Error fetching languages:', err);
        res.status(500).json({ error: err.message || err });
    }
}

/**
 * Returns all available language codes (short keys)
 *
 * Example: ['en', 'de', 'fr']
 *
 * @returns {Promise<string[]>} Array of language codes
 */
async function getLanguagesShort() {
    const languages = await getLanguage();
    return Object.keys(languages || {});
}

export {
    getLanguages,
    getLanguagesShort,
    getLanguage
};