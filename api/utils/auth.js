import jwt from 'jsonwebtoken';
import { verifyToken } from "../mongo_db/tokens.js";
import Settings from "../mongo_db/shema/Settings.js";
import { verifyPin } from "../mongo_db/settings.js";

const SECRET = process.env.SECRET;

// ------------------------
// Middleware: requireAuthFiles
// ------------------------

/**
 * Middleware to protect routes by checking:
 * - PIN authentication if enabled
 * - JWT stored in HttpOnly cookie
 * - Optional one-time token in URL (if tokenEnabled)
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Next middleware
 */
async function requireAuthFiles(req, res, next) {
    let settings = null;

    try {
        settings = await Settings.findOne();

        // Skip auth if PIN is disabled
        if (!settings?.pinEnabled) return next();
    } catch (err) {
        console.error("Error fetching settings:", err);
    }

    let token = req.cookies.auth;

    // Check URL token if cookie missing and tokenEnabled
    if (!token && req.query.token && settings?.tokenEnabled) {
        token = req.query.token;
        try {
            const verified = await verifyToken(token);
            if (verified) {
                const jwtToken = jwt.sign({ authenticated: true }, SECRET, { expiresIn: "180d" });

                res.cookie("auth", jwtToken, {
                    maxAge: 180 * 24 * 60 * 60 * 1000, // 6 months
                    httpOnly: true
                });

                // Remove token from URL to clean redirect
                const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
                url.searchParams.delete('token');
                return res.redirect(url.pathname + url.search);
            }
        } catch {
            // Ignore invalid URL token
        }
    }

    // Normal cookie-based JWT check
    if (!token) {
        if (req.originalUrl.startsWith('/api') || req.get('Accept')?.includes('application/json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }

    try {
        const payload = jwt.verify(token, SECRET);
        if (payload.authenticated) return next();

        if (req.originalUrl.startsWith('/api') || req.get('Accept')?.includes('application/json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');

    } catch {
        if (req.originalUrl.startsWith('/api') || req.get('Accept')?.includes('application/json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }
}

// ------------------------
// Controller: login
// ------------------------

/**
 * POST /login
 * Authenticate user via PIN
 * Stores JWT in HttpOnly cookie for 6 months.
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function login(req, res) {
    const { pin } = req.body;

    if (!pin) return res.status(500).send("No PIN provided");

    const verified = await verifyPin(pin);

    if (verified) {
        const jwtToken = jwt.sign({ authenticated: true }, SECRET, { expiresIn: "180d" });

        res.cookie("auth", jwtToken, {
            maxAge: 180 * 24 * 60 * 60 * 1000, // 6 months
            httpOnly: true
        });

        return res.redirect("/");
    }

    res.status(401).send("Invalid PIN or token");
}

// ------------------------
// Exports
// ------------------------

export {
    requireAuthFiles,
    login
};