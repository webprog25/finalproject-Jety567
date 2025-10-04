import mongoose from "mongoose";

/**
 * Mongoose schema for representing an item entry in a list
 * (e.g., shopping list or holiday list).
 *
 * @typedef {Object} ListItem
 * @property {string} ean - The product's unique European Article Number (EAN). Required.
 * @property {number} quantity - Quantity of the product in the list. Defaults to 1, minimum 0.
 * @property {"holiday"|"shopping"} type - The type of list the item belongs to.
 * Can only be either `"holiday"` or `"shopping"`. Required.
 * @property {Date} createdAt - Timestamp of when the list item was created.
 * @property {Date} updatedAt - Timestamp of the last update to the list item.
 */
const ListItemSchema = new mongoose.Schema(
    {
        ean: { type: String, required: true },
        quantity: { type: Number, default: 1, min: 0 },
        type: {
            type: String,
            enum: ["holiday", "shopping"],
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("ListItem", ListItemSchema);