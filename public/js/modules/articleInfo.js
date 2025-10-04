import { showToast } from "./socket.js";
import {getLocationName, javaScriptText, locationArray} from "../i18n.js";

let mapInstance = null; // Leaflet map instance
const storesNames = {
    "mueller": "Müller",
    "dm": "DM",
    "budni": "Budni",
    "rossmann": "Rossmann",
}

// ----------------------------
// Main
// ----------------------------
export async function openInfo(id) {
    try {
        const response = await fetch(`/api/article/${id}`);
        if (!response.ok) throw new Error("Failed to fetch article");
        const product = await response.json();

        const responseSettings = await fetch(`/api/settings/`);
        if (!responseSettings.ok) throw new Error("Failed to fetch article");
        const {brands} = await responseSettings.json();

        showToast(javaScriptText.productLoaded, "success");

        const modal = createModal(product.ean);
        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        modal.addEventListener("hidden.bs.modal", () => {
            if (mapInstance) {
                mapInstance.remove();
                mapInstance = null;
            }
            modal.remove();
        });

        fillInfoTab(modal, product, brands);

        const storesTabLink = modal.querySelector("#tab-stores-tab");
        storesTabLink.addEventListener("shown.bs.tab", async () => {
            await fillStoresTab(modal, product.storeAvailability, brands);
            if (mapInstance) mapInstance.invalidateSize();
        });

        const nutriResp = await fetch(`/api/nutrients/${product.ean}`);
        if (nutriResp.ok) {
            const nutriData = await nutriResp.json();
            fillNutriTab(modal, nutriData);
        } else {
            removeNutriTab(modal);
        }

    } catch (err) {
        console.error(err);
        showToast(err.message || javaScriptText.errorLoading, "error");
    }
}

// ----------------------------
// Modal Creation
// ----------------------------
function createModal(ean) {
    const modal = document.createElement("div");
    modal.classList.add("modal", "fade");
    modal.tabIndex = -1;
    modal.id = "productModal";
    modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${javaScriptText.modalTitle}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <ul class="nav nav-tabs" id="productTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="tab-info-tab" data-bs-toggle="tab" data-bs-target="#tab-info">${javaScriptText.tabs_info}</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-stores-tab" data-bs-toggle="tab" data-bs-target="#tab-stores">${javaScriptText.tabs_stores}</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-nutri-tab" data-bs-toggle="tab" data-bs-target="#tab-nutri">${javaScriptText.tabs_nutri}</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-lists-tab" data-bs-toggle="tab" data-bs-target="#tab-lists">Vacation & Shopping</button>
                        </li>
                    </ul>
                    <div class="tab-content mt-3">
                        <div class="tab-pane fade show active" id="tab-info"></div>
                        <div class="tab-pane fade" id="tab-stores"></div>
                        <div class="tab-pane fade" id="tab-nutri"></div>
                        <div class="tab-pane fade" id="tab-lists">
                            ${createListTabHTML()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener("shown.bs.modal", () => {
        initVacationList(modal,ean);
        initShoppingList(modal,ean);
    });

    return modal;
}

// ----------------------------
// Vacation & Shopping HTML
// ----------------------------
function createListTabHTML() {
    return `
        <h5 class="mt-3">Vacation List</h5>
        <table class="table table-bordered table-sm" id="vacation-list-table">
            <thead><tr><th>EAN</th><th>Quantity</th><th></th></tr></thead>
            <tbody><tr><td colspan="3">No items yet</td></tr></tbody>
        </table>
        <div class="d-flex gap-2 mb-4">
            <input id="vacation-quantity" type="number" class="form-control w-25" placeholder="Quantity" value="1" min="1">
            <button id="vacation-add" class="btn btn-primary">Add</button>
        </div>

        <h5 class="mt-3">Shopping List</h5>
        <table class="table table-bordered table-sm" id="shopping-list-table">
            <thead><tr><th>EAN</th><th>Quantity</th><th></th></tr></thead>
            <tbody><tr><td colspan="3">No items yet</td></tr></tbody>
        </table>
        <div class="d-flex gap-2 mb-4">
            <input id="shopping-quantity" type="number" class="form-control w-25" placeholder="Quantity" value="1" min="1">
            <button id="shopping-add" class="btn btn-success">Add</button>
        </div>
    `;
}

// ----------------------------
// Vacation List
// ----------------------------
async function initVacationList(modal,ean) {
    const addBtn = modal.querySelector("#vacation-add");
    const tableBody = modal.querySelector("#vacation-list-table tbody");

    // Fetch existing vacation items
    await fetchListItems(`/api/list/item/holiday/${ean}`, tableBody);

    addBtn.addEventListener("click", async () => {
        const quantity = parseInt(modal.querySelector("#vacation-quantity").value);

        if (!ean || quantity <= 0) return showToast("Enter valid EAN and quantity", "error");

        await postToVacation({ ean, quantity });
        addRowToTable(tableBody, ean, quantity,'holiday');
    });
}

// ----------------------------
// Shopping List
// ----------------------------
async function initShoppingList(modal,ean) {
    const addBtn = modal.querySelector("#shopping-add");
    const tableBody = modal.querySelector("#shopping-list-table tbody");

    // Fetch existing shopping items
    await fetchListItems(`/api/list/item/shopping/${ean}`, tableBody);

    addBtn.addEventListener("click", async () => {
        const quantity = parseInt(modal.querySelector("#shopping-quantity").value);

        if (!ean || quantity <= 0) return showToast("Enter valid EAN and quantity", "error");

        await postToShopping({ ean, quantity });
        addRowToTable(tableBody, ean, quantity,'shopping');
    });
}

// ----------------------------
// Helper: Fetch existing list items
// ----------------------------
async function fetchListItems(apiUrl, tableBody) {
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch list items");
        const items = await res.json();

        if (!items.length) return;

        tableBody.innerHTML = ""; // clear placeholder row
        items.forEach(item => addRowToTable(tableBody, item.ean, item.quantity,apiUrl.split('/')[4]));
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-danger">Error loading list</td></tr>`;
    }
}

// ----------------------------
// Helper: Add row with + / - buttons
// ----------------------------
function addRowToTable(tableBody, ean, quantity, type) {
    const tr = document.createElement("tr");
    tableBody.innerHTML = ''

    if (type === 'holiday') {
        const addBtn = document.querySelector("#vacation-add");
        const input = document.querySelector("#vacation-quantity");

        addBtn.disabled = true;
        input.disabled = true;
    } else {
        const addBtn = document.querySelector("#shopping-add");
        const input = document.querySelector("#shopping-quantity");

        addBtn.disabled = true;
        input.disabled = true;
    }

    tr.innerHTML = `
        <td>${ean}</td>
        <td class="quantity-cell">${quantity}</td>
        <td>
            <button class="btn btn-sm btn-success btn-increment">+</button>
            <button class="btn btn-sm btn-danger btn-decrement">–</button>
            <button class="btn btn-sm btn-danger btn-delete">Delete</button>
        </td>
    `;

    tr.querySelector(".btn-increment").addEventListener("click", async () => {
        const updatedItem = await updateListItem(ean, "increment", type);
        if (updatedItem) {
            const newQty = updatedItem.quantity ?? quantity;
            if (newQty <= 0) {
                tr.remove();
            } else {
                tr.querySelector(".quantity-cell").textContent = newQty;
            }
        }
    });

    tr.querySelector(".btn-decrement").addEventListener("click", async () => {
        const updatedItem = await updateListItem(ean, "decrement", type);
        if (updatedItem) {
            const newQty = updatedItem.quantity ?? quantity;
            if (newQty <= 0) {
                tr.innerHTML = '<tr><td colspan="3">No items yet</td></tr>'
                if (type === 'holiday') {
                    const addBtn = document.querySelector("#vacation-add");
                    const input = document.querySelector("#vacation-quantity");

                    addBtn.disabled = false;
                    input.disabled = false;
                } else {
                    const addBtn = document.querySelector("#shopping-add");
                    const input = document.querySelector("#shopping-quantity");

                    addBtn.disabled = false;
                    input.disabled = false;
                }
            } else {
                tr.querySelector(".quantity-cell").textContent = newQty;
            }
        }
    });

    tr.querySelector(".btn-delete").addEventListener("click", async () => {
        const updatedItem = await deleteListItem(ean, type);
        tr.innerHTML = '<tr><td colspan="3">No items yet</td></tr>'
        if (type === 'holiday') {
            const addBtn = document.querySelector("#vacation-add");
            const input = document.querySelector("#vacation-quantity");

            addBtn.disabled = false;
            input.disabled = false;
        } else {
            const addBtn = document.querySelector("#shopping-add");
            const input = document.querySelector("#shopping-quantity");

            addBtn.disabled = false;
            input.disabled = false;
        }
    });

    tableBody.appendChild(tr);
}

// ----------------------------
// Update list item quantity (increment/decrement)
// ----------------------------
async function updateListItem(ean, action, type) {
    try {
        const apiUrl = type === "holiday"
            ? `/api/list/item/holiday/${ean}/${action}`
            : `/api/list/item/shopping/${ean}/${action}`;

        const res = await fetch(apiUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ean })
        });

        if (!res.ok) throw new Error(`Failed to ${action} item`);

        const updatedItem = await res.json();
        showToast(`Quantity ${action}ed`, "success");
        return updatedItem;
    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
        return null;
    }
}

async function deleteListItem(ean, type) {
    try {
        const apiUrl = type === "holiday"
            ? `/api/list/item/holiday/${ean}`
            : `/api/list/item/shopping/${ean}`;

        const res = await fetch(apiUrl, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ean })
        });

        if (!res.ok) throw new Error(`Failed to delete item`);

        const updatedItem = await res.json();
        showToast(`Deleted`, "success");
        return updatedItem;
    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
        return null;
    }
}

// ----------------------------
// Info tab
// ----------------------------
function fillInfoTab(modal, product, brands) {
    const infoDiv = modal.querySelector("#tab-info");
    infoDiv.innerHTML = `
        <div class="text-center">
            <img src="${product.imageUrl}" style="max-width:300px; width:100%; height:auto;" />
            <h5 class="mt-3">${product.name}</h5>
            <p>${javaScriptText.info_ean}: ${product.ean}</p>
            <table class="table table-bordered w-100">
                <thead><tr><th>${javaScriptText.info_store}</th><th>${javaScriptText.info_price}</th><th></th></tr></thead>
                <tbody>
                    ${brands.map(key => {
        if(product.price[key] != null) {
            return `<tr><td>${storesNames[key]}</td><td>${product.price[key]} €</td><td class="w-25"><a class="btn btn-secondary btn-sm" href="${product.productUrl[key]}" target="_blank">Show Product Page</a></td></tr>`;
        } else {
            return '';
        }
    }).join('')}
                </tbody>
            </table>
            <!-- Accordion -->
<div class="accordion" id="itemAccordion">
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingDetails">
      <button class="accordion-button collapsed" type="button"
              data-bs-toggle="collapse" data-bs-target="#collapseDetails"
              aria-expanded="false" aria-controls="collapseDetails">
        Zum Regal hinzufügen
      </button>
    </h2>

    <div id="collapseDetails" class="accordion-collapse collapse"
         aria-labelledby="headingDetails" data-bs-parent="#itemAccordion">
      <div class="accordion-body">
        <form id="addToShelfForm" class="row g-3 needs-validation" novalidate>
          <div class="col-sm-4">
            <label for="qty" class="form-label">Quantity</label>
            <input id="qty" name="qty" type="number" class="form-control" min="1" step="1" required>
            <div class="invalid-feedback">Please enter a quantity (≥ 1).</div>
          </div>

          <div class="col-sm-4">
            <label for="location" class="form-label">Location</label>
            <select id="location" name="location" class="form-select" required>
              ${locationArray().map(loc => `<option value="${loc.key}">${loc.name}</option>`).join('')}
            </select>
            <div class="invalid-feedback">Please choose a location.</div>
          </div>

          <div class="col-sm-4">
            <label for="expiry" class="form-label">Expiry Date</label>
            <input id="expiry" name="expiry" type="date" class="form-control" required>
          </div>

          <div class="col-12 d-flex gap-2">
            <button type="submit" id="saveBtn" class="btn btn-primary">Hinzufügen</button>
            <button type="reset" class="btn btn-outline-secondary">Zurücksetzen</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
            <div id="shelfTableInfo" class="mt-3"></div>
        </div>
    `;
    fillShelfTableInfo(product.ean);
    const form = document.getElementById('addToShelfForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        // Access form data
        const formData = new FormData(form);

        await postToLocation({
            articleName: product.name,
            quantity: formData.get('qty'),
            expiry: formData.get('expiry'),
            location: formData.get('location'),
        },product.ean);
        setTimeout(() => {
            fillShelfTableInfo(product.ean);
        }, 3000);
    })
}

// ----------------------------
// Shelf table
// ----------------------------
async function fillShelfTableInfo(ean, data = null) {
    try {
        const container = document.getElementById("shelfTableInfo");
        container.innerHTML = "";

        let items = null

        if (!data) {
            const response = await fetch(`/api/shelf/item/ean/${ean}`);
            if (!response.ok) throw new Error("Failed to fetch shelf data");

            items = await response.json();
        } else {
            items = data.items;
        }

        if (!items.length) {
            container.innerHTML = `<p>${javaScriptText.shelf_noStock}</p>`;
            return;
        }

        const table = document.createElement("table");
        table.classList.add("table","table-bordered","table-sm","w-100");
        table.innerHTML = `
            <thead>
                <tr><th>${javaScriptText.shelf_location}</th><th>${javaScriptText.shelf_expiresAt}</th><th>${javaScriptText.shelf_quantity}</th><th></th></tr>
            </thead>
            <tbody>
                ${items.map(item => {
            const expiresDate = new Date(item.expires_at);
            const formattedDate = `${expiresDate.getDate().toString().padStart(2,'0')}.${(expiresDate.getMonth()+1).toString().padStart(2,'0')}.${expiresDate.getFullYear()}`;
            return `<tr>
                                <td>${getLocationName(item.location)}</td>
                                <td>${formattedDate}</td>
                                <td>${item.quantity}</td>
                                <td><button class="btn btn-warning btn-sm btn-eaten" id="${item._id}">Verbraucht</button></td>
                            </tr>`;
        }).join('')}
            </tbody>
        `;
        container.appendChild(table);

        document.querySelectorAll(".btn-eaten").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                eaten(e.target.id)
                console.log(e.target.q)
            })
        })
    } catch (err) {
        console.error(err);
        document.getElementById("shelfTableInfo").innerHTML = `<p class="text-danger">${javaScriptText.shelf_error}</p>`;
    }
}

// ----------------------------
// Stores tab
// ----------------------------
async function fillStoresTab(modal, storeAvailability, brands) {
    const container = modal.querySelector("#tab-stores");
    container.innerHTML = "";

    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }

    const mapDiv = document.createElement("div");
    mapDiv.id = "storesMap";
    mapDiv.style.height = "40vh";
    mapDiv.style.width = "100%";
    mapDiv.classList.add("mb-3");
    container.appendChild(mapDiv);

    mapInstance = L.map("storesMap").setView([47.8, 12.38], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    for (const key of brands) {
        const stores = storeAvailability[key];
        if (!stores || stores.length === 0) continue;

        const wrapper = document.createElement("div");
        wrapper.classList.add("mb-3");

        const title = document.createElement("h6");
        title.textContent = storesNames[key]
        wrapper.appendChild(title);

        const table = document.createElement("table");
        table.classList.add("table","table-bordered","table-sm");
        table.style.width = "100%";
        table.innerHTML = `<thead><tr><th>${javaScriptText.stores_address}</th><th>${javaScriptText.stores_available}</th><th>${javaScriptText.stores_quantity}</th></tr></thead>`;
        const tbody = document.createElement("tbody");

        for (const storeItem of stores) {
            try {
                const storeResp = await fetch(`/api/store/${storeItem.storeId}`);
                if (!storeResp.ok) throw new Error("Store fetch failed");
                const store = await storeResp.json();

                const addr = store.address
                    ? `${store.address.name}, ${store.address.street}, ${store.address.zip} ${store.address.city}`
                    : "Unknown";

                const tr = document.createElement("tr");
                tr.innerHTML = `<td>${addr}</td><td>${storeItem.available ? javaScriptText.stores_available : javaScriptText.stores_notAvailable}</td><td>${storeItem.quantity ? storeItem.quantity : javaScriptText.noInfo}</td>`;
                tbody.appendChild(tr);

                if (store.coordinates?.length === 2) {
                    const [lat, lng] = store.coordinates;
                    const marker = L.marker([lat, lng], {
                        icon: L.icon({
                            iconUrl: storeItem.available
                                ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                                : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                            iconSize: [32, 32],
                            iconAnchor: [16, 32]
                        })
                    }).addTo(mapInstance);
                    marker.bindPopup(`<strong>${addr}</strong><br>${storeItem.available ? javaScriptText.stores_available : javaScriptText.stores_notAvailable}`);
                }
            } catch (e) {
                console.error(`Failed to fetch store ${storeItem.storeId}:`, e);
            }
        }

        table.appendChild(tbody);
        wrapper.appendChild(table);
        container.appendChild(wrapper);
    }

    const group = new L.featureGroup();
    mapInstance.eachLayer(layer => {
        if (layer instanceof L.Marker) group.addLayer(layer);
    });
    if (group.getLayers().length) mapInstance.fitBounds(group.getBounds().pad(0.2));
}

// ----------------------------
// Nutri tab
// ----------------------------
function fillNutriTab(modal, data) {
    const nutriDiv = modal.querySelector("#tab-nutri");
    let table = `
        <table class="table table-bordered">
            <thead>
                <tr><th>${javaScriptText.nutri_title}</th><th>${javaScriptText.nutri_per100}</th></tr>
            </thead>
            <tbody>
                <tr><td>${javaScriptText.nutri_energy}</td><td>{energy_kj} kj / {energy_kcal} kcal</td></tr>
                <tr><td>${javaScriptText.nutri_fat}</td><td>{fat} g</td></tr>
                <tr><td>${javaScriptText.nutri_satFat}</td><td>{saturated_fat} g</td></tr>
                <tr><td>${javaScriptText.nutri_carbs}</td><td>{carbohydrates} g</td></tr>
                <tr><td>${javaScriptText.nutri_sugars}</td><td>{sugars} g</td></tr>
                <tr><td>${javaScriptText.nutri_fiber}</td><td>{fiber} g</td></tr>
                <tr><td>${javaScriptText.nutri_proteins}</td><td>{proteins} g</td></tr>
                <tr><td>${javaScriptText.nutri_salt}</td><td>{salt} g</td></tr>
            </tbody>
        </table>
    `;

    Object.keys(data).forEach(key => {
        let item = data[key];
        if (!item) item = javaScriptText.nutri_unknown;
        table = table.replaceAll(`{${key}}`, item);
    });

    nutriDiv.innerHTML = table;
}

function removeNutriTab(modal) {
    const tabEl = modal.querySelector("#tab-nutri-tab");
    const contentEl = modal.querySelector("#tab-nutri");
    if(tabEl) tabEl.remove();
    if(contentEl) contentEl.remove();
}

/**
 * Ask user where to add the item and get input details.
 * @param {string} articleName
 * @param {String} ean
 * @returns {Promise<Object|null>} Returns an object with details or null if cancelled
 */

// --- MAIN FUNCTION ---
export async function addToList(articleName, ean) {
    // Step 1: Choose type
    const choice = await Swal.fire({
        title: `Add "${articleName}" to:`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Location',
        denyButtonText: 'Vacation / Shopping List',
        cancelButtonText: 'Cancel',
        icon: 'question'
    });

    if (choice.isDismissed) return;

    if (choice.isConfirmed) {
        const locationData = await swalLocationInput(articleName);
        if (locationData) await postToLocation(locationData,ean);
    } else if (choice.isDenied) {
        const listData = await swalListInput(articleName);
        if (!listData) return;

        // Check checkbox value to decide vacation or shopping
        if (listData.listType === 'vacation') await postToVacation({
            ean: ean,
            quantity: listData.quantity,
        });
        else await postToShopping({
            ean: ean,
            quantity: listData.quantity,
        });
    }
}

// --- SWEETALERT FUNCTIONS ---

export async function swalLocationInput(articleName, locations = []) {
    const options = locationArray().map(loc => `<option value="${loc.key}">${loc.name}</option>`).join('');
    const { value } = await Swal.fire({
        title: `Add "${articleName}" to Location`,
        html:
            `<input id="swal-quantity" class="swal2-input w-75" placeholder="Quantity" type="number">` +
            `<select id="swal-location" class="swal2-select w-75" style="
                    padding: 0.5rem 0.75rem;
                    font-size: 1rem;
                    border-radius: 0.375rem;
                    border: 1px solid #ced4da;
                    background-color: #fff;
                    color: #495057;
                    margin-bottom: 0.75rem;
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                ">${options}</select>` +
            `<input id="swal-expiry" class="swal2-input w-75" placeholder="Expiry Date" type="date">`,
        focusConfirm: false,
        preConfirm: () => {
            const quantity = document.getElementById('swal-quantity').value;
            const location = document.getElementById('swal-location').value;
            const expiry = document.getElementById('swal-expiry').value;
            if (!quantity || !location || !expiry) Swal.showValidationMessage('Please fill all fields');
            return { quantity, location, expiry };
        }
    });
    return value ? { articleName, ...value } : null;
}

async function swalListInput(articleName) {
    const { value } = await Swal.fire({
        title: `Add "${articleName}" to List`,
        html:
            `<input id="swal-quantity" class="swal2-input w-75" placeholder="Quantity" type="number">` +
            `<div style="
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin: 0.5rem auto 0 auto;
        width: 75%;
    ">
        <label class="h4" style="display:flex; align-items:center; gap:0.5rem;">
            <input type="radio" name="listType" value="vacation" checked style="transform: scale(1.5); cursor: pointer;">
            Vacation
        </label>
        <label class="h4" style="display:flex; align-items:center; gap:0.5rem;">
            <input type="radio" name="listType" value="shopping" style="transform: scale(1.5); cursor: pointer;">
            Shopping
        </label>
    </div>`,
        focusConfirm: false,
        preConfirm: () => {
            const quantity = document.getElementById('swal-quantity').value;
            const listType = document.querySelector('input[name="listType"]:checked')?.value;
            if (!quantity || quantity <= 0) Swal.showValidationMessage('Please enter a valid quantity');
            return { articleName, quantity, listType };
        }
    });
    return value || null;
}

// --- FETCH FUNCTIONS ---

export async function postToLocation(data,ean) {
    try {
        const res = await fetch('/api/shelf/item/ean', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.articleName,
                ean: ean,
                quantity: data.quantity,
                expiry: data.expiry,
                location: data.location,
            })
        });
        if (!res.ok) throw new Error('Failed to add to location');
        showToast('Added to Location successfully', 'success');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function postToVacation({quantity,ean}) {
    try {
        const res = await fetch('/api/list/item/holiday', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ean: ean,
                quantity: quantity,
            })
        });
        if (!res.ok) throw new Error('Failed to add to vacation list');
        showToast('Added to Vacation List successfully', 'success');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

export async function eaten(id) {
    try {
        const res = await fetch(`/api/shelf/item/use/ean/${id}`, {
            method: 'PUT',
        });

        if (!res.ok) throw new Error('Failed to mark item as eaten');

        const data = await res.json();

        // Show success toast
        showToast('Item updated successfully', 'success');

        // Call the callback with JSON data
        fillShelfTableInfo(null,data)

    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message || 'Something went wrong'
        });
    }
}

async function postToShopping({quantity, ean}) {
    try {
        const res = await fetch('/api/list/item/shopping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ean: ean,
                quantity: quantity,
            })
        });
        if (!res.ok) throw new Error('Failed to add to shopping list');
        showToast('Added to Shopping List successfully', 'success');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}