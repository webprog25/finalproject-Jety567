import {createStoreIcon,map,addStoreMarker,fitMapToMarkers} from "./storeMap.js";
import {javaScriptText} from "../i18n.js";

function loadStores(brand) {
    fetch(`/api/${brand}/store`)
        .then(res => res.json())
        .then(storesArray => {
            const tbody = document.getElementById(`${brand}TableBody`);
            tbody.innerHTML = "";

            storesArray.forEach(storeObj => {
                const store = storeObj.data;
                const hours = storeObj.openingHours;

                // Create marker with color by brand
                const marker = L.marker(store.coordinates, {
                    icon: createStoreIcon(
                        brand === "mueller" ? "orange" :
                            brand === "rossmann" ? "crimson" :
                            brand === "budni" ? "blue" :
                                "#9d0dfd" // dm
                    )
                }).addTo(map);

                const popupContent = `
                    <strong>${store.address.name}</strong><br>
                    ${store.address.street}, ${store.address.zip} ${store.address.city}<br>
                    ${store.phone ? `<a href="tel:${store.phone}">${store.phone}</a>` : ""}
                `;
                addStoreMarker(store.coordinates, brandColour(brand), popupContent);

                saveStoreToTable(brand, storeObj);
            });

            fitMapToMarkers();
        })
        .catch(err => {
            const tbody = document.getElementById(`${brand}TableBody`);
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${javaScriptText.failedToLoad.replace('{brand}',brand)}</td></tr>`;
            console.error(err);
        });
}
// === Format Opening Hours for Modal ===
function formatOpeningHours(hours) {
    const daysText = javaScriptText.weekdays;
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return `
        <ul class="list-group">
            ${days.map((day,index) => {
        const entries = hours[day];
        if (!entries || entries.length === 0) {
            return `<li class="list-group-item"><strong>${daysText[index]}:</strong> ${javaScriptText.closed}</li>`;
        }
        const range = entries.map(e => `${e.open} - ${e.close}`).join(", ");
        return `<li class="list-group-item"><strong>${daysText[index]}:</strong> ${range}</li>`;
    }).join("")}
        </ul>
    `;
}
function checkIfStoreIsOpenNow(openingHours) {
    const now = new Date();
    const berlinOffset = -now.getTimezoneOffset() + 120; // CET/CEST handling
    const berlinNow = new Date(now.getTime() + berlinOffset * 60000);

    const weekday = berlinNow.toLocaleDateString("en-US", { weekday: "long", timeZone: "Europe/Berlin" });
    const todayHours = openingHours[weekday];

    if (!todayHours || todayHours.length === 0) {
        return { isOpen: false, closeTime: null };
    }

    const [hour, minute] = [berlinNow.getHours(), berlinNow.getMinutes()];
    const currentMinutes = hour * 60 + minute;

    for (const period of todayHours) {
        const [openH, openM] = period.open.split(":").map(Number);
        const [closeH, closeM] = period.close.split(":").map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
            return { isOpen: true, closeTime: period.close };
        }
    }

    return { isOpen: false, closeTime: null };
}

function brandColour(brand) {
    if (brand === "mueller") {
        return "green";
    }
    if (brand === "rossmann") {
        return "crimson";
    }
    if (brand === "budni") {
        return "blue";
    }
    return "#a50dfd";
}

// Track which brand triggered modal
// Modal: Set brand and update modal title
const storeModal = document.getElementById("storeModal");

storeModal.addEventListener("show.bs.modal", function (event) {
    const button = event.relatedTarget;
    const brand = button.getAttribute("data-brand");
    document.getElementById("storeBrand").value = brand;

    const titleMap = {
        mueller: "Müller",
        dm: "DM",
        rossmann: "Rossmann",
        budni: "Budni",
    };

    const colorMap = {
        mueller: "bg-warning",
        dm: "bg-primary",
        rossmann: "bg-danger",
        budni: "bg-secondary",
    };

    const modalHeader = document.getElementById("storeModalHeader");
    const modalLabel = document.getElementById("storeModalLabel");

    // Clear any previous brand color classes
    modalHeader.className = "modal-header";
    modalHeader.classList.add(colorMap[brand] || "bg-secondary", "text-white");

    modalLabel.textContent = `Search ${titleMap[brand] || "Store"}`;

    // Reset input and result state
    document.getElementById("resultList").innerHTML = "";
    document.getElementById("resultList").classList.remove("d-none");
    document.getElementById("searchLoading").classList.add("d-none");
    document.getElementById("searchInput").value = "";
});

// Handle form search
document.getElementById("searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const brand = document.getElementById("storeBrand").value;
    const input = document.getElementById("searchInput").value;
    const resultList = document.getElementById("resultList");
    const loadingTbody = document.getElementById("searchLoading");

    // Reset both bodies
    resultList.innerHTML = "";
    resultList.classList.add("d-none");
    loadingTbody.classList.remove("d-none");

    const apiUrl = `/api/${brand}/store/location/${encodeURIComponent(input)}`;

    fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
            loadingTbody.classList.add("d-none");
            resultList.classList.remove("d-none");

            if (!Array.isArray(data) || data.length === 0) {
                resultList.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-muted text-center">${javaScriptText.noResults}</td>
                    </tr>
                `;
                return;
            }

            data.forEach(storeObj => {
                const store = storeObj.data;
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${store.address.name}</td>
                    <td>${store.address.street}, ${store.address.zip} ${store.address.city}</td>
                    <td><button class="btn btn-sm btn-success">${javaScriptText.add}</button></td>
                `;
                tr.querySelector("button").addEventListener("click", () => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById("storeModal"));

                    // Optional: disable button to prevent double click
                    const btn = tr.querySelector("button");
                    btn.disabled = true;
                    btn.innerText = javaScriptText.saving;

                    // Fake REST request with delay
                    fetch(`/api/${brand}/store`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(storeObj)
                    })
                        .then(res => {
                            if (!res.ok) throw new Error("Request failed");
                            return res.json();
                        })
                        .then(() => {
                            Swal.fire({
                                icon: "success",
                                title: javaScriptText.storeAdded,
                                text: `${storeObj.data.address.name} ${javaScriptText.storeAddedSuccess}.`,
                                timer: 2000,
                                showConfirmButton: false,
                            });
                            modal.hide();
                            saveStoreToTable(brand, storeObj);
                        })
                        .catch(() => {
                            Swal.fire({
                                icon: "error",
                                title: "Oops!",
                                text: javaScriptText.addFailed,
                            });
                            btn.disabled = false;
                            btn.innerText = "Add";
                        });
                });
                resultList.appendChild(tr);
            });
        })
        .catch(err => {
            console.error(err);
            loadingTbody.classList.add("d-none");
            resultList.classList.remove("d-none");
            resultList.innerHTML = `
                <tr><td colspan="4" class="text-danger text-center">${javaScriptText.fetchFailed}</td></tr>
            `;
        });
});

function saveStoreToTable(brand, storeObj) {
    // Get open status and closing time

    const hours = storeObj.openingHours;
    const store = storeObj.data;
    const tbody = document.getElementById(`${brand}TableBody`);

    const { isOpen, closeTime } = checkIfStoreIsOpenNow(hours);

    // Table row
    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td>${store.storeNumber}</td>
    <td>${store.address.name}</td>
    <td>${store.address.street}, ${store.address.zip} ${store.address.city}</td>
    <td>
        ${
        isOpen
            ? `<span class="text-success">🟢 ${javaScriptText.openUntil} ${closeTime}</span>`
            : `<span class="text-danger">🔴 ${javaScriptText.closed}</span>`
    }
    </td>
    <td>
        <button class="btn btn-sm btn-outline-primary me-1">View</button>
    </td>
    <td>
    <button class="btn btn-sm btn-outline-danger">${javaScriptText.delete}</button>
</td>

`;

    const viewBtn = tr.querySelector(".btn-outline-primary");
    const deleteBtn = tr.querySelector(".btn-outline-danger");

// View Opening Hours
    viewBtn.addEventListener("click", () => {
        const modalBody = document.getElementById("hoursModalBody");
        modalBody.innerHTML = formatOpeningHours(hours);
        const modal = new bootstrap.Modal(document.getElementById("hoursModal"));
        modal.show();
    });

// Delete Confirmation & API Call
    deleteBtn.addEventListener("click", () => {
        Swal.fire({
            title: "Are you sure?",
            text: javaScriptText.removeStoreFrom.replace('{store}',store.address.city).replace('{brand}',brand),
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: javaScriptText.yesDelete,
            cancelButtonText: javaScriptText.cancel
        }).then(result => {
            if (result.isConfirmed) {
                fetch(`/api/${brand}/store/${store.storeId}`, {
                    method: "DELETE"
                })
                    .then(res => {
                        if (!res.ok) throw new Error("Delete failed");
                        Swal.fire(javaScriptText.deleted, javaScriptText.storeRemoved, "success");
                        tr.remove(); // Remove row from table
                    })
                    .catch(() => {
                        Swal.fire("Error", javaScriptText.deleteFailed, "error");
                    });
            }
        });
    });

    tbody.appendChild(tr);
}

export {
    loadStores
}