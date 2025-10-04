import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.resolve('./cache');
const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const FOREVER_TTL = 0; // special TTL = 0 means never expire

// In-memory cache store
const caches = new Map();

/**
 * Ensure the cache directory exists
 */
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (_) {
        // Ignore errors
    }
}

/**
 * Returns the cache file path for a given cache name
 * @param {string} name
 * @returns {string}
 */
function getCachePath(name) {
    return path.join(CACHE_DIR, `${name}.json`);
}

/**
 * Load cache from disk into memory
 * @param {string} name - cache namespace
 */
async function loadCache(name) {
    await ensureCacheDir();
    const filePath = getCachePath(name);
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const map = new Map(Object.entries(parsed));
        caches.set(name, map);
    } catch {
        caches.set(name, new Map());
    }
}

/**
 * Save in-memory cache to disk
 * @param {string} name - cache namespace
 */
async function saveCache(name) {
    const cache = caches.get(name);
    if (!cache) return;
    const json = JSON.stringify(Object.fromEntries(cache), null, 2);
    const filePath = getCachePath(name);
    await fs.writeFile(filePath, json);
}

/**
 * Get a value from cache
 * @param {string} name - cache namespace
 * @param {string} key - cache key
 * @returns {any|null} cached value or null if missing/expired
 */
function get(name, key) {
    const cache = caches.get(name);
    const entry = cache?.get(key);
    if (!entry) return null;

    if (entry.ttl !== FOREVER_TTL && (Date.now() - entry.timestamp > entry.ttl)) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Set a value in cache
 * @param {string} name - cache namespace
 * @param {string} key - cache key
 * @param {any} value - value to store
 * @param {number} ttl - optional time-to-live in ms
 */
function set(name, key, value, ttl = DEFAULT_TTL) {
    const cache = caches.get(name) || new Map();
    caches.set(name, cache);
    cache.set(key, { value, timestamp: Date.now(), ttl });
}

/**
 * Check if a cache key exists and is valid
 * @param {string} name - cache namespace
 * @param {string} key - cache key
 * @returns {boolean}
 */
function has(name, key) {
    return !!get(name, key);
}

/**
 * Delete a cache key
 * @param {string} name - cache namespace
 * @param {string} key - cache key
 */
function del(name, key) {
    const cache = caches.get(name);
    cache?.delete(key);
}

/**
 * Clear all keys in a cache namespace
 * @param {string} name - cache namespace
 */
function clear(name) {
    caches.set(name, new Map());
}

/**
 * Remove expired entries in a cache namespace
 * @param {string} name - cache namespace
 */
function prune(name) {
    const cache = caches.get(name);
    if (!cache) return;
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.ttl !== FOREVER_TTL && (now - entry.timestamp > entry.ttl)) {
            cache.delete(key);
        }
    }
}

export default {
    loadCache,
    saveCache,
    get,
    set,
    has,
    del,
    clear,
    prune,
    FOREVER_TTL, // expose constant for infinite TTL usage
};