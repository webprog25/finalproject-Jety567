import { openInfo, addToList} from "./modules/articleInfo.js";
import { showToast } from "./modules/socket.js";
import {javaScriptText, onLanguageChange} from './i18n.js'

onLanguageChange(() => {
    getTable();
});


/** Fetch articles and populate table */
export async function getTable() {
    try {
        const res = await fetch('/api/articles');
        if (!res.ok) throw new Error("Failed to fetch articles");

        const articles = await res.json();
        const tableBody = document.getElementById('product-list');

        // Destroy existing DataTable (if initialized)
        if ($.fn.DataTable.isDataTable('#productTable')) {
            $('#productTable').DataTable().destroy();
        }

        // Clear table body
        tableBody.innerHTML = '';

        // Insert rows using your existing helper
        for (let article of articles) {
            tableBody.appendChild(createTableRow(article));
        }

        // Re-initialize DataTable on the filled table
        $('#productTable').DataTable({
            order: [[2, 'desc']], // example: sort by "lastUpdate"
            responsive: true,
            language: {
                search: "_INPUT_",
                searchPlaceholder: "Search products..."
            }
        });

    } catch (err) {
        console.error('Error in getTable:', err);
    }
}

/** Update a single article by EAN */
export async function updateArticle(ean, buttonEl) {
    if (!buttonEl) return;

    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = javaScriptText.update + "...";

    const row = buttonEl.closest("tr");

    try {
        const endpoints = [
            `/api/article/prices/${ean}`,
            `/api/article/stores/${ean}`
        ];

        for (const url of endpoints) {
            const res = await fetch(url, { method: "PUT" });
            if (!res.ok) throw new Error(`${javaScriptText.updateError}: ${url}`);
        }

        let request = await fetch('/api/article/' + ean);
        if (!request.ok) throw new Error(`${javaScriptText.updateError}: ${ean}`);

        let article = await request.json();

        row.cells[0].textContent = article.ean;
        row.cells[1].textContent = article.name;
        row.cells[2].textContent = new Date(article.updatedAt).toLocaleString('de-DE');

        // ✅ Replace dropdown inside action buttons group
        const btnGroup = row.querySelector(".store-dropdown");
        btnGroup.replaceWith(createStoreButtons(article.productUrl))

        showToast(javaScriptText.updateSuccess, "success");
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: javaScriptText.updateError,
            text: error.message
        });
    } finally {
        buttonEl.textContent = originalText;
        buttonEl.disabled = false;
    }
}

/** Delete an article by ID */
export async function deleteArticle(id) {
    const result = await Swal.fire({
        title: javaScriptText.confirmTitle,
        text: javaScriptText.confirmText,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: javaScriptText.confirmButton,
        cancelButtonText: javaScriptText.cancelButton
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/api/article/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(javaScriptText.error);

        const row = document.getElementById(id);
        if (row) row.remove();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: javaScriptText.success,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    } catch (err) {
        Swal.fire({ icon: 'error', title: javaScriptText.error, text: err.message });
    }
}

/** Create table row for an article */
function createTableRow(article) {
    const tr = document.createElement("tr");
    tr.id = article._id;

    tr.appendChild(createCell(article.ean));
    tr.appendChild(createCell(article.name));
    tr.appendChild(createCell(new Date(article.updatedAt).toLocaleString('de-DE')));
    tr.appendChild(createCell(createActionButtons(article), true));

    return tr;
}

/** Helper to create a <td> */
function createCell(content, isHTML = false) {
    const td = document.createElement("td");
    if (isHTML) td.appendChild(content);
    else td.textContent = content || javaScriptText.noInfo;
    return td;
}

/** Create action buttons */
function createActionButtons(article) {
    const btnGroup = document.createElement("div");
    btnGroup.classList.add("btn-group");
    btnGroup.setAttribute("role", "group");

    const dropdownGroup = createStoreButtons(article.productUrl);
    dropdownGroup.classList.add("store-dropdown");
    if (dropdownGroup) btnGroup.appendChild(dropdownGroup);

    const infoBtn = createButton(javaScriptText.info, "btn-secondary", () => openInfo(article._id, article.name));
    const updateBtn = createButton(javaScriptText.update, "btn-warning", (e) => updateArticle(article.ean, e.target));
    const deleteBtn = createButton(javaScriptText.delete, "btn-danger", () => deleteArticle(article._id));
    const addBtn = createButton(javaScriptText.add, "btn-success", () => addToList(article.name,article.ean));

    btnGroup.append(infoBtn, updateBtn, deleteBtn, addBtn);

    return btnGroup;
}

/** Generic button creator */
function createButton(text, btnClass, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("btn", btnClass);
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
}

/** Create store dropdown or single button */
function createStoreButtons(productUrl) {
    const stores = {
        "mueller": "Müller",
        "dm": "DM",
        "budni": "Budni",
        "rossmann": "Rossmann",
    }

    const entries = Object.entries(productUrl).filter(([_, url]) => url !== null);

    const dropdownGroup = document.createElement("div");
    dropdownGroup.classList.add("btn-group");
    dropdownGroup.setAttribute("role", "group");

    const dropdownBtn = document.createElement("button");
    dropdownBtn.type = "button";
    dropdownBtn.classList.add("btn", "btn-primary", "dropdown-toggle");
    dropdownBtn.setAttribute("data-bs-toggle", "dropdown");
    dropdownBtn.setAttribute("aria-expanded", "false");
    dropdownBtn.textContent = javaScriptText.stores;

    const dropdownMenu = document.createElement("ul");
    dropdownMenu.classList.add("dropdown-menu");

    if (entries.length === 0) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.classList.add("dropdown-item");
        a.classList.add("disabled");
        a.textContent = javaScriptText.noStoreAvailable;
        li.appendChild(a);
        dropdownMenu.appendChild(li);
    }

    entries.forEach(([store, url]) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.classList.add("dropdown-item");
        a.href = url;
        a.target = "_blank";
        a.textContent = stores[store]
        li.appendChild(a);
        dropdownMenu.appendChild(li);
    });

    dropdownGroup.append(dropdownBtn, dropdownMenu);
    return dropdownGroup;
}