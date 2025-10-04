// listManager.js
import {openInfo, swalLocationInput,postToLocation} from "./articleInfo.js";
import { showToast } from "./socket.js";

let listType = "holiday";
let tableBody = null;
let form = null;

export function initListManager({ type = "holiday", tableSelector, formSelector, selectSelector }) {
    listType = type;
    tableBody = document.querySelector(tableSelector);
    form = document.querySelector(formSelector);

    if (!tableBody || !form) throw new Error("Table or form not found");

    fetchAndRenderList();
    fetchSelectList(selectSelector);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        try {
            const res = await fetch(`/api/list/item/${listType}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ean: formData.get("ean"),
                    quantity: parseInt(formData.get("quantity")),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to add item");
            }

            showToast("Added Successfully", "success");
            fetchAndRenderList();
        } catch (err) {
            showToast(err.message, "error");
        }
    });
}

// ----------------------------
// Fetch and render list items
// ----------------------------
async function fetchAndRenderList() {
    try {
        const res = await fetch(`/api/list/item/article/${listType}`);
        if (!res.ok) throw new Error("Failed to fetch list");

        const items = await res.json();
        tableBody.innerHTML = "";

        if (!items.length) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center">No items yet</td></tr>`;
            return;
        }

        items.forEach((item) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.ean}</td>
                <td>${item.name || "-"}</td>
                <td class="quantity-cell">${item.quantity}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-primary btn-info" id="${item.articleId}">Info</button>
                        ${listType === "shopping" ? `<button type="button" id="${item.name}///${item.ean}" class="btn btn-success btn-bought">Gekauft</button>` : ""}
                        <button type="button" class="btn btn-secondary btn-increment">+</button>
                        <button type="button" class="btn btn-secondary btn-decrement">-</button>
                        <button type="button" class="btn btn-danger btn-delete">Delete</button>
                    </div>
                </td>
            `;

            tr.querySelector(".btn-info").addEventListener("click", () => openInfo(item.articleId));

            tr.querySelector(".btn-increment").addEventListener("click", async () => {
                const updatedItem = await updateListItem(item.ean, "increment");
                if (updatedItem) tr.querySelector(".quantity-cell").textContent = updatedItem.quantity;
            });

            tr.querySelector(".btn-decrement").addEventListener("click", async () => {
                const updatedItem = await updateListItem(item.ean, "decrement");
                if (updatedItem) {
                    if (updatedItem.quantity <= 0) tr.innerHTML = `<tr><td colspan="4" class="text-center">No items yet</td></tr>`;
                    else tr.querySelector(".quantity-cell").textContent = updatedItem.quantity;
                }
            });

            tr.querySelector(".btn-delete").addEventListener("click", async () => {
                await deleteListItem(item.ean);
                await fetchAndRenderList();
            });

            if (listType === "shopping") {
                tr.querySelector(".btn-bought").addEventListener("click", async (e) => {
                    let infos = e.target.id.split("///");

                    const locationData = await swalLocationInput(infos[0]);
                    if (locationData) {
                        // Show loading swal
                        Swal.fire({
                            title: 'Saving...',
                            text: 'Please wait while we update the location.',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });

                        // Run your async task
                        await postToLocation(locationData, infos[1]);
                        await deleteListItem(item.ean);
                        await fetchAndRenderList();

                        await Swal.fire({
                            icon: 'success',
                            title: 'Successfully added!',
                            text: `Item was added to ${locationData.location}`,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    }
                });
            }

            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-danger">Error loading list</td></tr>`;
    }
}

// ----------------------------
// Fetch article select options with search
// ----------------------------
export async function fetchSelectList(selectSelector) {
    try {
        const res = await fetch(`/api/articles`);
        if (!res.ok) throw new Error("Failed to fetch articles");

        const items = await res.json();
        const select = document.querySelector(selectSelector);
        if (!select) return;

        // Fill select with options
        select.innerHTML = "";
        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.ean;
            option.textContent = `${item.name} (${item.ean})`;
            select.appendChild(option);
        });

        // Keep a copy of the original options for filtering
        const originalOptions = Array.from(select.options).map(opt => ({
            value: opt.value,
            text: opt.textContent
        }));

        // Select the corresponding search input
        const search = document.querySelector("#articleSearchInput");
        if (!search) return;

        // Filter logic
        search.addEventListener("input", () => {
            const query = search.value.toLowerCase();
            select.innerHTML = "";

            if (!query) {
                // Restore all options if input is cleared
                originalOptions.forEach(opt => {
                    const option = document.createElement("option");
                    option.value = opt.value;
                    option.textContent = opt.text;
                    select.appendChild(option);
                });
                return;
            }

            const filtered = originalOptions.filter(opt => opt.text.toLowerCase().includes(query));

            if (filtered.length > 0) {
                filtered.forEach(opt => {
                    const option = document.createElement("option");
                    option.value = opt.value;
                    option.textContent = opt.text;
                    select.appendChild(option);
                });
                select.selectedIndex = 0; // auto-select first match
            } else {
                const emptyOpt = document.createElement("option");
                emptyOpt.disabled = true;
                emptyOpt.textContent = "No matches found";
                select.appendChild(emptyOpt);
            }
        });

    } catch (err) {
        showToast(err.message, "error");
    }
}

// ----------------------------
// Update item quantity
// ----------------------------
async function updateListItem(ean, action) {
    const res = await fetch(`/api/list/item/${listType}/${ean}/${action}`, { method: "PUT" });
    return res.ok ? await res.json() : null;
}

// ----------------------------
// Delete item
// ----------------------------
async function deleteListItem(ean) {
    await fetch(`/api/list/item/${listType}/${ean}`, { method: "DELETE" });
}