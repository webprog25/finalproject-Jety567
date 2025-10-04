import mongoose from "mongoose";

/**
 * Mongoose schema for representing an individual item
 * that can be identified by a QR code and a name.
 *
 * @typedef {Object} Item
 * @property {string|null} qr_code - QR code string assigned to the item. Can be null if not set.
 * @property {string} name - The name of the item. Required.
 * @property {Date} createdAt - Timestamp indicating when the item was created.
 * @property {Date} updatedAt - Timestamp indicating when the item was last updated.
 */
const itemSchema = new mongoose.Schema(
    {
        qr_code: { type: String, default: null },
        name: { type: String, required: true },
    },
    { timestamps: true }
);

export default mongoose.model("Item", itemSchema);