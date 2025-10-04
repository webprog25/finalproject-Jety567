import * as crypto from "node:crypto";
import Token from "./shema/Token.js";

/**
 * Express route: Delete a token by its ID.
 *
 * @route DELETE /api/tokens/:id
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * DELETE /api/tokens/64f3a1b9f5e2a3c7b4567890
 * Response: { message: 'Token deleted successfully', id: '...' }
 */
async function deleteToken(req, res) {
    try {
        const { id } = req.params;
        const deleted = await Token.findByIdAndDelete(id);

        if (!deleted) return res.status(404).json({ error: 'Token not found' });

        res.json({ message: 'Token deleted successfully', id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Verify a token string against the database and expiration date.
 *
 * @param {string} tokenString - The token to verify.
 * @returns {Promise<boolean>} True if valid, false otherwise.
 *
 * @example
 * const isValid = await verifyToken("abcd1234...");
 */
async function verifyToken(tokenString) {
    if (!tokenString) return false;

    try {
        const tokenDoc = await Token.findOne({ token: tokenString });
        if (!tokenDoc) return false;

        const now = new Date();
        return !(tokenDoc.expiredAt && tokenDoc.expiredAt < now);
    } catch (err) {
        console.error(err);
        return false;
    }
}

/**
 * Express route: Create a new token with optional expiration.
 *
 * @route POST /api/tokens
 * @param {import('express').Request} req - Body: { name, expiration }
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * POST /api/tokens
 * Body: { "name": "API Client 1", "expiration": "30" }
 * Response: { id: "...", token: "...", name: "...", createdAt: "...", expiredAt: "YYYY-MM-DD" }
 */
async function createToken(req, res) {
    try {
        const { name, expiration } = req.body;
        if (!name || !expiration) return res.status(400).json({ error: 'Name and expiration are required' });

        const tokenString = crypto.randomBytes(16).toString('hex');

        let expiredAt = null;
        if (expiration !== 'forever') {
            const days = parseInt(expiration);
            const date = new Date();
            date.setDate(date.getDate() + days);
            expiredAt = date;
        }

        const token = new Token({ name, token: tokenString, expiredAt });
        await token.save();

        res.json({
            id: token._id,
            token: tokenString,
            name: token.name,
            createdAt: token.createdAt,
            expiredAt: expiredAt || 'Never'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

/**
 * Express route: List all tokens, formatted with creation and expiration dates.
 *
 * @route GET /api/tokens
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function tokens(req, res) {
    try {
        const tokens = await Token.find().sort({ createdAt: -1 }).lean();
        const formattedTokens = tokens.map(t => ({
            id: t._id,
            name: t.name,
            createdAt: t.createdAt.toISOString().split('T')[0], // YYYY-MM-DD
            expiredAt: t.expiredAt ? t.expiredAt.toISOString().split('T')[0] : 'Never'
        }));
        res.json(formattedTokens);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

export {
    tokens,
    createToken,
    deleteToken,
    verifyToken,
};