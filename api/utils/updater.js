// utils/socketWatcher.js
import chokidar from "chokidar";
import { Server } from "socket.io";
import cache from '../utils/persistentCache.js';

const CACHE_NAME = "addProducts";

/**
 * Initializes a Socket.IO server for real-time product updates
 * and sets up file watchers for automatic reloads.
 *
 * @param {import('http').Server} server - The HTTP server instance
 * @param {string} publicPath - Path to the public folder to watch
 */
export default async function initSocketWatcher(server, publicPath) {
    const io = new Server(server);

    // Load cache for shared product data
    await cache.loadCache(CACHE_NAME);

    // Socket.IO connection handling
    io.on("connection", (socket) => {
        // Send current shared data on new connection
        socket.emit('updateData', getSharedData());

        // Listen for updates from clients
        socket.on('updateFromClient', async (data) => {
            const eanItems = data.eanItems || [];
            const qrItems = data.qrItems || [];

            cache.set(CACHE_NAME, 'eanItems', eanItems, cache.FOREVER_TTL);
            cache.set(CACHE_NAME, 'qrItems', qrItems, cache.FOREVER_TTL);

            // Broadcast updated data to all connected clients
            io.emit('updateData', getSharedData());

            // Persist changes to disk
            await cache.saveCache(CACHE_NAME);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    /**
     * Get the shared product data from cache.
     * @returns {{eanItems: any[], qrItems: any[]}}
     */
    function getSharedData() {
        const eanItems = cache.get(CACHE_NAME, 'eanItems') || [];
        const qrItems = cache.get(CACHE_NAME, 'qrItems') || [];

        return { eanItems, qrItems };
    }

    // Watch the public folder for changes
    chokidar.watch(publicPath, { cwd: publicPath, ignoreInitial: true })
        .on("all", (eventType, filePath) => {
            if (eventType.endsWith("Dir")) return;

            if (filePath.endsWith(".css")) {
                io.emit("cssChange", filePath);
            } else {
                io.emit("reload");
            }
        });
}