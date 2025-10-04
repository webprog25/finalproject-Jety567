import { initFormHandlers, lookup } from './modules/formHandler.js';
import { saveToLocalStorage, renderTable, initTableEvents } from './modules/tableManager.js';
import { initReceiptUpload } from './modules/uploader.js';
import { onLanguageChange} from "./i18n.js";
import {getSocket, showToast} from "./modules/socket.js";
import {javaScriptText} from "./i18n.js";
import EANScanner from "./modules/Scanner/EANScanner.js";
import QRCodeScanner from "./modules/Scanner/QRCodeScanner.js";

let language = false;

const io = getSocket();

document.addEventListener('DOMContentLoaded', async () => {
    initFormHandlers(renderTable, saveToLocalStorage);
    initTableEvents();
    initReceiptUpload(renderTable);
    // Init EAN Scanner
    new EANScanner({
        buttonId: "scan-ean",
        containerId: "scanner-container",
        wrapperId: "scanner-wrapper",
        onDetect: async (code) => {
            document.getElementById("eanCode").value = code;
            console.log("EAN detected:", code);
            await lookup(code,true)
        }
    });

    new QRCodeScanner({
        buttonId: "scan-qr",
        containerId: "qr-scanner-container",
        wrapperId: "qr-scanner-wrapper",
        onDetect: (code) => {
            document.getElementById("qrCode").value = code;
            console.log("QR detected:", code);
        }
    });
});

onLanguageChange(() => {
    renderTable('qr');
    renderTable('ean');

    language = true;
})

io.on("updateData", ({eanItems,qrItems}) => {
    updateLocalStorage(eanItems, qrItems);

    if (!language)
        return;

    renderTable('qr');
    renderTable('ean');
})

function updateLocalStorage(eanItems, qrItems) {
    try {
        const storedEanItems = JSON.parse(localStorage.getItem("eanItems")) || [];
        const storedQrItems = JSON.parse(localStorage.getItem("qrItems")) || [];

        // Only update if new values are not null/undefined
        let eanChanged = false;
        if (Array.isArray(eanItems)) {
            eanChanged = JSON.stringify(storedEanItems) !== JSON.stringify(eanItems);
            if (eanChanged) {
                localStorage.setItem("eanItems", JSON.stringify(eanItems));
            }
        }

        let qrChanged = false;
        if (Array.isArray(qrItems)) {
            qrChanged = JSON.stringify(storedQrItems) !== JSON.stringify(qrItems);
            if (qrChanged) {
                localStorage.setItem("qrItems", JSON.stringify(qrItems));
            }
        }

        if (eanChanged || qrChanged) {
            showToast(javaScriptText.newDataUpdated);
        }

    } catch (error) {
        console.error("Error updating localStorage:", error);
    }
}

// 🔁 Full Page Reload
io.on("reload", () => {
    window.location.reload();
});