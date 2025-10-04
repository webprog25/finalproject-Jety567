// formHandler.js
import {javaScriptText} from "../i18n.js";

export function initFormHandlers(renderTable, saveToLocalStorage) {
    const eanInput = document.getElementById('eanCode');
    const qrInput = document.getElementById('qr');
    const quantity = document.getElementById('quantity');

    function toggleDisableInputs() {
        if (qrInput.value.trim() !== '') {
            quantity.value = 1;
            quantity.disabled = true;
        }
        if (eanInput.value.trim() !== '') {
            quantity.value = '';
            quantity.disabled = false;
        }
        qrInput.disabled = eanInput.value.trim() !== '';
        eanInput.disabled = qrInput.value.trim() !== '';
    }

    eanInput.addEventListener('input', toggleDisableInputs);
    qrInput.addEventListener('input', toggleDisableInputs);

    document.getElementById('addProductForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('productName').value.trim();
        const quantity = parseInt(document.getElementById('quantity').value);
        const expiry = document.getElementById('expiryDate').value;
        const qr = qrInput.value.trim();
        const ean = eanInput.value.trim();
        const location = document.getElementById('location').value;

        if (!location || !name || !quantity || !expiry || (!qr && !ean)) {
            Swal.fire(javaScriptText.missingDataTitle, javaScriptText.missingDataText, 'warning');
            return;
        }

        const item = {location, name, quantity, expiry, code: qr || ean};
        const type = qr ? 'qr' : 'ean';
        saveToLocalStorage(type, item);
        renderTable(type, true);
        e.target.reset();
        toggleDisableInputs();
    });

    document.getElementById('search-ean').addEventListener('click', async () => {
        await lookup(eanInput.value,true)
    });
}

export async function lookup(eanInput, showLoader = false) {
    try {
        if (showLoader) {
            Swal.fire({
                title: javaScriptText.loadingTitle || "Loading...",
                text: javaScriptText.loadingText || "Please wait",
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
        }

        const response = await fetch(`/api/lookup/${eanInput}`);

        if (!response.ok) throw new Error();

        const data = await response.json();
        document.getElementById('productName').value = `${data.product.brand} ${data.product.name}`;

        if (showLoader) {
            Swal.close(); // close loader before success
        }

        Swal.fire({
            icon: 'success',
            title: javaScriptText.fetchSuccessTitle,
            timer: 1500,
            showConfirmButton: false
        });
    } catch {
        if (showLoader) {
            Swal.close(); // close loader if still open
        }

        Swal.fire({
            icon: 'error',
            title: javaScriptText.fetchFailTitle
        });
    }
}