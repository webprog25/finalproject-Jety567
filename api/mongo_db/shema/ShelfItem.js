import mongoose from "mongoose";

/**
 * Mongoose schema for representing an item stored on a shelf.
 * Items can be identified by EAN or QR code, and may optionally
 * include location and expiration data.
 *
 * @typedef {Object} ShelfItem
 * @property {string} [ean] - The product's European Article Number (EAN). Optional.
 * @property {string} [qr_code] - The QR code associated with the item. Optional.
 * @property {number} quantity - The quantity of the item. Required, defaults to `1`, must be ≥ 1.
 * @property {Date} [expires_at] - The expiration date of the item, if applicable.
 * @property {string|null} location - The location where the item is stored (e.g., shelf ID). Defaults to `null`.
 * @property {Date} createdAt - Timestamp when the shelf item entry was created.
 * @property {Date} updatedAt - Timestamp when the shelf item entry was last updated.
 */
const shelfItemSchema = new mongoose.Schema(
    {
        ean: {
            type: String,
            required: false,
        },
        qr_code: {
            type: String,
            required: false,
        },
        quantity: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
        },
        expires_at: {
            type: Date,
            required: false,
        },
        location: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true, // adds createdAt and updatedAt
    }
);

export default mongoose.model("ShelfItem", shelfItemSchema);