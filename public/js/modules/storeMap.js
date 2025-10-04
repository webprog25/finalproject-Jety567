
const markerPositions = []; // Track all marker coordinates
let map

function initMap() {
    // Leaflet Map
    map = L.map('map', {
        scrollWheelZoom: false
    }).setView([51.1657, 10.4515], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Enable scroll zoom only with Ctrl or Cmd
    const mapContainer = map.getContainer();

    mapContainer.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
            // Enable map scroll zoom
            map.scrollWheelZoom.enable();

            // Prevent window from scrolling
            e.preventDefault();
        } else {
            // Disable map scroll zoom
            map.scrollWheelZoom.disable();
        }
    }, { passive: false }); // passive: false is required to use e.preventDefault()
}

// Custom SVG Marker Icon
function createStoreIcon(color) {
    return L.divIcon({
        className: '',
        html: `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="${color}" viewBox="0 0 24 24">
                    <path d="M4 4h16v2H4zm1 4h14v12H5z"/>
                </svg>
            `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    });
}

function addStoreMarker(coords, color, popupContent) {
    const marker = L.marker(coords, {
        icon: createStoreIcon(color)
    }).addTo(map);

    marker.bindPopup(popupContent);
    markerPositions.push(coords); // Save position
    fitMapToMarkers()
}

// After all markers are added (e.g., after calling loadStores for all brands)
function fitMapToMarkers() {
    if (markerPositions.length > 0) {
        const bounds = L.latLngBounds(markerPositions);
        map.fitBounds(bounds, { padding: [30, 30] }); // Optional padding
    }
    map.invalidateSize();
}

export {
    initMap,
    createStoreIcon,
    addStoreMarker,
    fitMapToMarkers,
    map
}