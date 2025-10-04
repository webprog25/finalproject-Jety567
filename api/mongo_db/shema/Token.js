import mongoose from "mongoose";

/**
 * Mongoose schema for storing authentication or access tokens.
 * Supports optional expiration, where expired tokens can be
 * automatically removed by MongoDB via TTL index.
 *
 * @typedef {Object} Token
 * @property {string} name - A descriptive name for the token (e.g., "API key for client X"). Required.
 * @property {string} token - The actual token string. Required and unique.
 * @property {Date} createdAt - The date when the token was created. Defaults to `Date.now`.
 * @property {Date|null} expiredAt - Expiration date of the token. Defaults to `null`.
 * If set, MongoDB automatically deletes the document once expired.
 */
const tokenSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiredAt: {
        type: Date,
        required: false,
        default: null,
    },
});

// TTL index: ensures expired tokens are removed automatically
tokenSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Token", tokenSchema);