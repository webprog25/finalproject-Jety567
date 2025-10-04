import ListItem from "./shema/ListItem.js";

/**
 * Express route: Get all items for a given list type.
 *
 * @route GET /api/list/:type
 * @param {import('express').Request} req - Params: { type }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 *
 * @example
 * GET /api/list/shopping
 * Response: [{ ean: "...", quantity: 2, type: "shopping" }, ...]
 */
async function getListItems(req, res) {
    try {
        const { type } = req.params;
        const items = await ListItem.find({ type });
        res.json(items);
    } catch (err) {
        console.error("Get list items failed:", err);
        res.status(500).json({ error: "Failed to fetch items" });
    }
}

/**
 * Express route: Get a specific list item by type and EAN.
 *
 * @route GET /api/list/:type/:ean
 * @param {import('express').Request} req - Params: { type, ean }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function getListItem(req, res) {
    try {
        const { type, ean } = req.params;
        if (!type || !ean) return res.status(404).json({ error: "Not Found" });

        const items = await ListItem.find({ type, ean });
        res.json(items);
    } catch (err) {
        console.error("Get list item failed:", err);
        res.status(500).json({ error: "Failed to fetch items" });
    }
}

/**
 * Express route: Add a new item to a list or increment quantity if it exists.
 *
 * @route POST /api/list/:type
 * @param {import('express').Request} req - Body: { ean, quantity }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function addListItem(req, res) {
    try {
        const { type } = req.params;
        const { ean, quantity } = req.body;

        let item = await ListItem.findOne({ type, ean });
        if (item) {
            item.quantity += Number(quantity) || 1;
            await item.save();
            return res.json(item);
        }

        item = new ListItem({ type, ean, quantity: Number(quantity) || 1 });
        await item.save();
        res.json(item);
    } catch (err) {
        console.error("Create list item failed:", err);
        res.status(500).json({ error: "Failed to add item" });
    }
}

/**
 * Express route: Delete a list item by type and EAN.
 *
 * @route DELETE /api/list/:type/:ean
 */
async function deleteListItem(req, res) {
    try {
        const { type, ean } = req.params;
        const deleted = await ListItem.findOneAndDelete({ type, ean });
        if (!deleted) return res.status(404).json({ error: "Item not found" });
        res.json(deleted);
    } catch (err) {
        console.error("Delete list item failed:", err);
        res.status(500).json({ error: "Failed to delete item" });
    }
}

/**
 * Express route: Increment quantity of a list item by 1.
 *
 * @route PUT /api/list/:type/:ean/increment
 */
async function incrementListItem(req, res) {
    try {
        const { type, ean } = req.params;
        const item = await ListItem.findOneAndUpdate(
            { type, ean },
            { $inc: { quantity: 1 } },
            { new: true }
        );
        if (!item) return res.status(404).json({ error: "Item not found" });
        res.json(item);
    } catch (err) {
        console.error("Increment failed:", err);
        res.status(500).json({ error: "Failed to increment quantity" });
    }
}

/**
 * Express route: Decrement quantity of a list item by 1, delete if quantity reaches 0.
 *
 * @route PUT /api/list/:type/:ean/decrement
 */
async function decrementListItem(req, res) {
    try {
        const { type, ean } = req.params;
        const item = await ListItem.findOne({ type, ean });
        if (!item) return res.status(404).json({ error: "Item not found" });

        if (item.quantity <= 1) {
            await item.deleteOne();
            return res.json({ message: "Item removed (quantity reached 0)", quantity: 0 });
        }

        item.quantity -= 1;
        await item.save();
        res.json(item);
    } catch (err) {
        console.error("Decrement failed:", err);
        res.status(500).json({ error: "Failed to decrement quantity" });
    }
}

/**
 * Express route: Get list items enriched with Article names.
 *
 * @route GET /api/list/:type/items
 */
async function items(req, res) {
    try {
        const { type } = req.params;
        if (!["shopping", "holiday"].includes(type)) return res.status(400).json({ error: "Invalid list type" });

        const result = await ListItem.aggregate([
            { $match: { type } },
            {
                $lookup: {
                    from: "articles",
                    localField: "ean",
                    foreignField: "ean",
                    as: "article",
                }
            },
            { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    ean: 1,
                    quantity: 1,
                    name: "$article.name",
                    articleId: "$article._id",
                }
            }
        ]);

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
}

export {
    getListItems,
    getListItem,
    addListItem,
    deleteListItem,
    incrementListItem,
    decrementListItem,
    items
};