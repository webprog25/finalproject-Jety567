import mongoose from 'mongoose';

/**
 * Mongoose schema for representing nutritional information of a product,
 * identified by its EAN code.
 *
 * @typedef {Object} Nutriments
 * @property {string} ean - The unique European Article Number (EAN) identifying the product. Required and unique.
 * @property {number} energy_kj - Energy content of the product in kilojoules.
 * @property {number} energy_kcal - Energy content of the product in kilocalories.
 * @property {number} fat - Total fat content in grams.
 * @property {number} saturated_fat - Saturated fat content in grams.
 * @property {number} carbohydrates - Total carbohydrate content in grams.
 * @property {number} sugars - Sugar content in grams.
 * @property {number} fiber - Fiber content in grams.
 * @property {number} proteins - Protein content in grams.
 * @property {number} salt - Salt content in grams.
 * @property {Date} createdAt - Timestamp when the nutriment entry was created.
 * @property {Date} updatedAt - Timestamp when the nutriment entry was last updated.
 */
const nutriSchema = new mongoose.Schema(
    {
        ean: { type: String, unique: true, required: true },
        energy_kj: Number,
        energy_kcal: Number,
        fat: Number,
        saturated_fat: Number,
        carbohydrates: Number,
        sugars: Number,
        fiber: Number,
        proteins: Number,
        salt: Number,
    },
    { timestamps: true }
);

export default mongoose.model("Nutriments", nutriSchema);