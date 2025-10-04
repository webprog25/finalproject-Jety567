// shelfTable.js
import { openInfo } from "./articleInfo.js";
import { showToast } from "./socket.js";

const boughtTableBody = document.querySelector("#eanTable tbody");
const selfmadeTableBody = document.querySelector("#qrTable tbody");
let endpoint = null
let boughtTable = null;
let selfmadeTable = null;
/**
 * Fetch shelf items from API
 */
export async function fetchShelfItems(name) {
    try {
        endpoint = `/api/shelf/item/location/${name}`;

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch shelf data");
        const { eanItems, qrItems } = await res.json();

        renderBoughtProducts(eanItems);
        renderSelfmadeProducts(qrItems);
    } catch (err) {
        console.error("Error fetching shelf data:", err);
        Swal.fire({
            icon: "error",
            title: "Error",
            text: err.message || "Failed to load shelf data",
        });
    }
}

/**
 * Render bought products (EAN) with DataTable
 */
export function renderBoughtProducts(eanItems) {
    const tbody = boughtTableBody;

    // Destroy previous DataTable instance if exists
    if ($.fn.DataTable.isDataTable("#eanTable")) {
        $("#eanTable").DataTable().destroy();
    }

    // Clear tbody
    tbody.innerHTML = "";

    // Insert rows
    eanItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.name || "-"}</td>
            <td>${item.ean || "-"}</td>
            <td>${item.quantity || 0}</td>
            <td>${item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "-"}</td>
            <td>${getDaysStatus(item.expires_at)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-primary">Info</button>
                    <button type="button" class="btn btn-secondary">Used</button>
                    <button type="button" class="btn btn-danger">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        const [infoBtn, usedBtn, deleteBtn] = tr.querySelectorAll("button");
        infoBtn.addEventListener("click", () => openInfo(item.ean));
        usedBtn.addEventListener("click", () => markUsed(item, tr));
        deleteBtn.addEventListener("click", () => deleteItem(item, tr));
    });

    // Initialize DataTable
    boughtTable = $("#eanTable").DataTable({
        order: [[3, "asc"]], // sort by Expires On
        responsive: true,
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search bought products..."
        }
    });
}

/**
 * Render selfmade products (QR) with DataTable
 */
export function renderSelfmadeProducts(qrItems) {
    const tbody = selfmadeTableBody;

    // Destroy previous DataTable instance if exists
    if ($.fn.DataTable.isDataTable("#qrTable")) {
        $("#qrTable").DataTable().destroy();
    }

    // Clear tbody
    tbody.innerHTML = "";

    qrItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.name || "-"}</td>
            <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}</td>
            <td>${item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "-"}</td>
            <td>${getDaysStatus(item.expires_at)}</td>
            <td><button class="btn btn-warning btn-sm">Used</button></td>
        `;
        tbody.appendChild(tr);

        const usedBtn = tr.querySelector("button");
        usedBtn.addEventListener("click", () => markUsedQrCode(item, tr));
    });

    // Initialize DataTable
    selfmadeTable = $("#qrTable").DataTable({
        order: [[2, "asc"]], // sort by Expires On
        responsive: true,
        language: {
            search: "_INPUT_",
            searchPlaceholder: "Search selfmade products..."
        }
    });
}

/**
 * Calculate days until expiry
 */
export function getDaysStatus(dateStr) {
    if (!dateStr) return "-";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diff > 0) return diff;
    if (diff === 0) return 0;
    return "expired";
}

/**
 * Mark an item as used
 */
export async function markUsed(item, row) {
    if (!item._id) return;
    try {
        const res = await fetch(`/api/shelf/item/use/ean/${item._id}`, { method: "PUT" });
        if (!res.ok) throw new Error("Failed to mark as used");

        const data = await res.json();
        const updatedItem = data.items.find(it => it._id === item._id);

        if (!updatedItem || updatedItem.quantity <= 0) {
            row.remove();
        } else {
            row.querySelector("td:nth-child(3)").textContent = updatedItem.quantity;
        }

        showToast(`"${item.name}" marked as used`);
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: "error",
            title: "Error",
            text: err.message || "Something went wrong",
        });
    }
}

/**
 * Mark an item as used
 */
export async function markUsedQrCode(item, row) {
    if (!item._id) return;
    try {
        const res = await fetch(`/api/shelf/item/use/ean/${item._id}`, { method: "PUT" });
        if (!res.ok) throw new Error("Failed to mark as used");
        row.remove();

        showToast(`"${item.name}" marked as used`);
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: "error",
            title: "Error",
            text: err.message || "Something went wrong",
        });
    }
}

/**
 * Delete an item
 */
export async function deleteItem(item, row) {
    if (!item._id) return;
    try {
        const res = await fetch(`/api/shelf/item/${item._id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete item");

        row.remove();
        showToast(`"${item.name}" deleted`);
    } catch (err) {
        Swal.fire({
            icon: "error",
            title: "Error",
            text: err.message || "Something went wrong",
        });
    }
}