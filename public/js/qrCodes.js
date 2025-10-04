// =========================
// Imports
// =========================
import { javaScriptText } from "./i18n.js";

// =========================
// DOM Elements
// =========================
const canvas = document.getElementById("qr");
const urlInput = document.getElementById("url");
const qrCodeInput = document.getElementById("qr-code");
const qrForm = document.getElementById("qrForm");

const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtnQrCode = document.getElementById("copyBtnQrCode");
const copyBtnUrl = document.getElementById("copyBtnUrl");

// =========================
// State
// =========================
let qrInstance = null;

// =========================
// Helpers
// =========================
function generateUUID() {
    if (crypto.randomUUID) return crypto.randomUUID();

    // Fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function setButtonStates(enabled) {
    clearBtn.disabled = !enabled;
    downloadBtn.disabled = !enabled;
    copyBtnQrCode.disabled = !enabled;
    copyBtnUrl.disabled = !enabled;
}

function resetCanvas() {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// =========================
// Event Handlers
// =========================
function handleGenerateQRCode(e) {
    e.preventDefault();

    const uuid = generateUUID();
    const { protocol, host } = window.location;
    const urlGenerated = `${protocol}//${host}/api/nfc/${uuid}`;

    // Set values
    qrCodeInput.value = uuid;
    urlInput.value = urlGenerated;

    // Enable buttons
    setButtonStates(true);

    // Generate QR
    qrInstance = new QRious({
        element: canvas,
        value: urlGenerated,
        size: 240,
        level: "M"
    });

    return false;
}

function handleClear() {
    qrForm.reset();
    resetCanvas();
    setButtonStates(false);
    qrInstance = null;
}

function handleDownload() {
    if (!qrInstance) return;

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qrcode.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function handleCopy(textSource, button) {
    if (!textSource.value) return;

    const oldText = button.textContent;
    navigator.clipboard.writeText(textSource.value).then(() => {
        button.textContent = javaScriptText.copied;
        setTimeout(() => (button.textContent = oldText), 1500);
    });
}

// =========================
// Event Listeners
// =========================
qrForm.addEventListener("submit", handleGenerateQRCode);
clearBtn.addEventListener("click", handleClear);
downloadBtn.addEventListener("click", handleDownload);
copyBtnQrCode.addEventListener("click", () => handleCopy(qrCodeInput, copyBtnQrCode));
copyBtnUrl.addEventListener("click", () => handleCopy(urlInput, copyBtnUrl));

// =========================
// Init
// =========================
(function init() {
    setButtonStates(false); // Disable buttons until a QR is generated
})();