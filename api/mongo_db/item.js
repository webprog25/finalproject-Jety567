import Item from './shema/Item.js';
import ListItem from "./shema/ListItem.js";
import ShelfItem from "./shema/ShelfItem.js";
import Article from "./shema/Article.js";
import { upsertAndUpdateArticle } from "./article.js";

/**
 * Express route: Create a new item with optional QR code and place it on the shelf.
 *
 * @route POST /api/items/qrcode
 * @param {import('express').Request} req - Body: { name, quantity, expiry, code }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function createQrCodeItem(req, res) {
    try {
        const { name, quantity, expiry, code } = req.body;

        // Create the item
        const newItem = new Item({ name, qr_code: code || null });
        const savedItem = await newItem.save();

        // Create the shelf entry
        try {
            const shelfItem = new ShelfItem({
                qr_code: savedItem.qr_code,
                quantity: quantity ?? 1,
                expires_at: expiry ? new Date(expiry) : null,
                location: 'freezer',
            });
            const savedShelfItem = await shelfItem.save();

            return res.status(201).json({
                message: "Item created and placed on shelf successfully",
                item: savedItem,
                shelfItem: savedShelfItem
            });
        } catch (shelfError) {
            // Rollback if ShelfItem creation fails
            await Item.findByIdAndDelete(savedItem._id);
            console.error("Shelf creation failed, rolled back Item:", shelfError);
            return res.status(500).json({ error: "Failed to place item on shelf" });
        }

    } catch (itemError) {
        console.error("Item creation failed:", itemError);
        return res.status(500).json({ error: "Failed to create item" });
    }
}

/**
 * Express route: Create a shelf item using an EAN, ensures article exists.
 *
 * @route POST /api/shelf/ean
 * @param {import('express').Request} req - Body: { name, ean, quantity, expiry, location }.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function createShelfItemEan(req, res) {
    try {
        const { name, ean, quantity, expiry, location } = req.body;

        await upsertAndUpdateArticle({ ean, name });

        let existingItem = await ShelfItem.findOne({ ean, expires_at: expiry });
        if (existingItem) {
            existingItem.quantity += Number(quantity);
            await existingItem.save();
            return res.json(existingItem);
        }

        const newShelfItem = new ShelfItem({
            name,
            ean,
            quantity,
            qr_code: null,
            expires_at: expiry,
            location
        });

        await newShelfItem.save();
        res.json(newShelfItem);
    } catch (error) {
        console.error("Error creating shelf item:", error);
        res.status(400).send({ error: error.message || error });
    }
}

/**
 * Express route: Get all shelf items by EAN.
 *
 * @route GET /api/shelf/:ean
 */
async function shelfEanItem(req, res) {
    try {
        const { ean } = req.params;
        if (!ean) return res.status(400).json({ error: "EAN is required" });

        const items = await ShelfItem.find({ ean });
        res.status(200).json(items);
    } catch (err) {
        console.error("Shelf fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch shelf items" });
    }
}

/**
 * Express route: Search shelf items by query string (EAN, QR code, location, or Article name).
 *
 * @route GET /api/shelf/search?q=...
 */
async function searchItem(req, res) {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const regex = new RegExp(q, "i");

        const items = await ShelfItem.aggregate([
            {
                $lookup: {
                    from: "articles",
                    localField: "ean",
                    foreignField: "ean",
                    as: "article"
                }
            },
            { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
            { $match: { $or: [
                        { ean: { $regex: regex } },
                        { qr_code: { $regex: regex } },
                        { location: { $regex: regex } },
                        { "article.name": { $regex: regex } }
                    ] }},
            { $limit: 50 }
        ]);

        const results = items.map(item => ({
            id: item._id.toString(),
            article_id: item.article?._id,
            ean: item.ean,
            qr_code: item.qr_code,
            name: item.article?.name ?? null,
            price: item.article?.price?.dm ?? null,
            location: item.location,
            quantity: item.quantity,
            expires_at: item.expires_at,
        }));

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }
}

/**
 * Express route: Get shelf items by location.
 *
 * @route GET /api/shelf/location/:location
 */
async function shelfLocationItem(req, res) {
    try {
        const { location } = req.params;
        if (!location) return res.status(400).json({ error: "Location is required" });

        const items = await ShelfItem.aggregate([
            { $match: { location, $or: [{ ean: null }, { qr_code: null }] } },
            {
                $lookup: {
                    from: "articles",
                    localField: "ean",
                    foreignField: "ean",
                    as: "article"
                }
            },
            {
                $lookup: {
                    from: "items",
                    localField: "qr_code",
                    foreignField: "qr_code",
                    as: "qrItem"
                }
            },
            { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$qrItem", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    shelfId: "$_id",
                    ean: 1,
                    qr_code: 1,
                    quantity: 1,
                    updatedAt: 1,
                    expires_at: 1,
                    name: { $ifNull: ["$article.name", "$qrItem.name"] },
                    articleId: { $ifNull: ["$article._id", "$qrItem._id"] }
                }
            },
            { $group: { _id: "$shelfId", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } }
        ]);

        const qrItems = items.filter(i => i.qr_code !== null);
        const eanItems = items.filter(i => i.qr_code === null);

        res.json({ eanItems, qrItems });
    } catch (err) {
        console.error("Shelf fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch shelf items" });
    }
}

/**
 * Express route: Consume one unit of a shelf item by ID.
 *
 * @route PUT /api/shelf/use/:id
 */
async function useShelfEanItem(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "ID is required" });

        const item = await ShelfItem.findById(id);
        if (!item) return res.status(404).json({ error: "Shelf item not found" });

        if (item.quantity > 1) {
            item.quantity -= 1;
            await item.save();
        } else {
            await ShelfItem.findByIdAndDelete(id);
        }

        const remainingItems = await ShelfItem.find({ ean: item.ean });
        res.status(200).json({ message: "Shelf updated", items: remainingItems });
    } catch (err) {
        console.error("Shelf update failed:", err);
        res.status(500).json({ error: "Failed to update shelf item" });
    }
}

/**
 * Express route: Delete a shelf item by ID.
 *
 * @route DELETE /api/shelf/:id
 */
async function deleteShelfItem(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "ID is required" });

        const result = await ShelfItem.deleteOne({ _id: id });
        if (result.deletedCount === 0) return res.status(404).json({ error: "Shelf item not found" });

        res.status(200).json({ message: "Shelf item deleted successfully" });
    } catch (err) {
        console.error("Shelf delete failed:", err);
        res.status(500).json({ error: "Failed to delete shelf item" });
    }
}

/**
 * Express route: Overview of shelf and list items.
 *
 * @route GET /api/shelf/overview
 */
async function shelfItemOverview(req, res) {
    try {
        const totalResult = await ShelfItem.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);
        const totalShelfItems = totalResult[0]?.total || 0;

        const listResult = await ListItem.aggregate([{ $group: { _id: "$type", total: { $sum: "$quantity" } } }]);
        const listOverview = { shopping: 0, holiday: 0 };
        listResult.forEach(i => { if (i._id === "shopping") listOverview.shopping = i.total; else if (i._id === "holiday") listOverview.holiday = i.total; });

        res.json({ totalShelfItems, ...listOverview });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

/**
 * Express route: Get shelf items that are expiring soon (next 5 days) or already expired.
 *
 * @route GET /api/shelf/expiry-soon
 */
async function expirySoon(req, res) {
    try {
        const now = new Date();
        const fiveDaysLater = new Date(); fiveDaysLater.setDate(now.getDate() + 5);

        let expiringItems = await ShelfItem.find({ expires_at: { $lte: fiveDaysLater } })
            .sort({ expires_at: 1 })
            .limit(15)
            .lean();

        const hasMoreExpiring = expiringItems.length === 15 &&
            (await ShelfItem.countDocuments({ expires_at: { $lte: fiveDaysLater } })) > 15;

        expiringItems = await Promise.all(expiringItems.map(async (item) => {
            let name = null;
            if (item.ean) name = (await Article.findOne({ ean: item.ean }).lean())?.name ?? null;
            else if (item.qr_code) name = (await Item.findOne({ qr_code: item.qr_code }).lean())?.name ?? null;

            let daysLeft = item.expires_at ? Math.ceil((item.expires_at - now) / (1000 * 60 * 60 * 24)) : null;
            if (daysLeft < 0) daysLeft = "expired";

            return { ...item, name, daysLeft };
        }));

        res.json({ expiringSoon: expiringItems, hasMoreExpiring });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

export {
    createQrCodeItem,
    createShelfItemEan,
    shelfEanItem,
    useShelfEanItem,
    shelfLocationItem,
    deleteShelfItem,
    shelfItemOverview,
    expirySoon,
    searchItem
};