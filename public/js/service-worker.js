const CACHE_NAME = "shelf-organizer-v1";
const ASSETS = [
    "/",
    "/index.html",
    "/css/scanner.css",
    "/css/loader.css",
    "/js/app.js",
    "/js/modules/loader.js",
    "/js/modules/socket.js",
    "/js/modules/articleInfo.js",
    "/js/modules/Scanner/EANScanner.js",
    "/manifest.json",
    "/icons/icon_192x192.png",
    "/icons/icon_512x512.png"
];

// Install SW & cache files
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate SW & remove old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
        )
    );
});

// Fetch from cache, fallback to network
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});