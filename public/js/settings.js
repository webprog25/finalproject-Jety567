// i18n
import { onLanguageChange, javaScriptText } from "/js/i18n.js";

// =========================
// DOM ELEMENTS
// =========================
const addLocationBtn = document.getElementById("addLocation");
const locationInput = document.getElementById("newLocation");
const saveModeBtn = document.getElementById("saveModeBtn");
const locationsTable = document.querySelector("#locationsTable tbody");
const defaultLanguageSelect = document.getElementById("defaultLanguage");
const darkModeToggle = document.getElementById("darkModeToggleSettings");
const selectPinEnabled = document.getElementById("pinEnabled");
const pinInput = document.getElementById('pinCode');
const confirmPinInput = document.getElementById('confirmPinCode');
const pinInputs = document.getElementById('pinInputs');

// =========================
// API HELPERS
// =========================
async function apiRequest(url, method = "GET", body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    return response.ok ? response.json() : Promise.reject(await response.json().catch(() => ({})));
}

// =========================
// UI HELPERS
// =========================
function addRow(location, language) {
    const row = document.createElement("tr");
    row.classList.add("new_added");
    row.innerHTML = `
        <td>${location.languages[language]}</td>
        <td>
            <button class="btn btn-danger btn-sm remove-row" id="${location._id}" data-i18n="delete">
                ${javaScriptText.delete}
            </button>
        </td>
    `;
    locationsTable.appendChild(row);
}

function clearNewRows() {
    document.querySelectorAll("table .new_added").forEach(row => row.remove());
}

// =========================
// EVENT HANDLERS
// =========================
async function handleAddLocation() {
    const location = locationInput.value.trim();
    if (!location) return;

    const oldText = addLocationBtn.textContent;
    addLocationBtn.disabled = true;
    addLocationBtn.textContent = javaScriptText.adding;

    try {
        const json = await apiRequest("/api/location", "POST", { name: location });
        const lng = localStorage.getItem("language");

        locationInput.value = "";
        addRow(json, lng);

        Swal.fire({
            icon: "success",
            title: javaScriptText.successTitle,
            text: javaScriptText.locationAdded,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        Swal.fire({
            icon: "error",
            title: javaScriptText.errorTitle,
            text: err.error || javaScriptText.errorOccurred
        });
    } finally {
        addLocationBtn.disabled = false;
        addLocationBtn.textContent = oldText;
    }
}

async function handleDeleteRow(target, id) {
    try {
        const confirmation = await Swal.fire({
            title: javaScriptText.areYouSure,
            text: javaScriptText.areYouSureText,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: javaScriptText.yesDelete
        });

        if (!confirmation.isConfirmed) return;

        await apiRequest(`/api/location/${id}`, "DELETE");

        Swal.fire({
            icon: "success",
            title: javaScriptText.deletedTitle,
            text: javaScriptText.deletedText,
            timer: 1500,
            showConfirmButton: false
        });

        target.closest("tr").remove();
    } catch (err) {
        Swal.fire({
            icon: "error",
            title: javaScriptText.errorTitle,
            text: err.error || javaScriptText.errorDelete
        });
    }
}

async function handleSaveSettings() {
    const isDarkMode = darkModeToggle.checked;
    const selectedLanguage = defaultLanguageSelect.value;

    // Get PIN values
    const isPinEnabled = document.getElementById('pinEnabled').checked;
    const isTokenEnabled = document.getElementById('tokenEnabled').checked;
    const pin = document.getElementById('pinCode').value.trim();
    const confirmPin = document.getElementById('confirmPinCode').value.trim();

    let pinToSave = null;
    if (isPinEnabled && pin) {
        if (pin !== confirmPin) {
            Swal.fire({ icon: 'error', title: 'PIN Error', text: 'The PINs do not match!' });
            return;
        }
        pinToSave = pin; // hash this on the server before saving
    }

    try {
        await apiRequest("/api/settings", "POST", {
            darkMode: isDarkMode,
            defaultLanguage: selectedLanguage,
            stores: getSelectedStores(),
            pin: pinToSave, // save pin or null
            pinEnabled: isPinEnabled,
            tokenEnabled: isTokenEnabled,
        });

        Swal.fire({
            icon: "success",
            title: javaScriptText.successTitle,
            text: javaScriptText.modeSaved
        });
    } catch (err) {
        Swal.fire({
            icon: "error",
            title: javaScriptText.errorTitle,
            text: err.error || javaScriptText.errorSavingMode
        });
    }
}

function getSelectedStores() {
    return  Array.from(document.querySelectorAll('input[name="stores"]:checked'))
        .map(el => el.id);
}

// =========================
// INIT FUNCTIONS
// =========================
async function loadLanguages() {
    try {
        const json = await apiRequest("/api/languages");
        defaultLanguageSelect.innerHTML = "";

        Object.keys(json).forEach(key => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = json[key].label;
            defaultLanguageSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error loading languages:", err);
    }
}

async function loadSetting() {
    let settings = await apiRequest("/api/settings");
    defaultLanguageSelect.value = settings.defaultLanguage;
    darkModeToggle.checked = settings.darkMode;
    settings.brands.forEach((brand) => {
        document.getElementById(brand).checked = true;
    })
    selectPinEnabled.checked = settings.pinEnabled;
    let checked = settings.pinEnabled;

    pinInputs.hidden = !checked;

    let tokenEnabled = settings.tokenEnabled;
    document.getElementById("tokenEnabled").checked = tokenEnabled;
    let div = document.getElementById('tokenTableDiv');
    if (tokenEnabled) {
        div.classList.remove('d-none');
    } else {
        div.classList.add('d-none');
    }

    if (!checked) {
        pinInput.value = '';
        confirmPinInput.value = '';
    }
}

async function loadLocations() {
    try {
        clearNewRows();
        const json = await apiRequest("/api/location");
        const lng = localStorage.getItem("language");

        json.forEach(location => addRow(location, lng));
    } catch (err) {
        console.error("Error loading locations:", err);
    }
}

// =========================
// EVENT LISTENERS
// =========================
addLocationBtn.addEventListener("click", handleAddLocation);

document.addEventListener("click", e => {
    if (e.target && e.target.classList.contains("remove-row")) {
        handleDeleteRow(e.target, e.target.id);
    }
});

saveModeBtn.addEventListener("click", handleSaveSettings);

onLanguageChange(() => loadLocations());

// =========================
// INIT APP
// =========================
(async function init() {
    await loadLanguages();
    await loadLocations();
    await loadSetting();
})();