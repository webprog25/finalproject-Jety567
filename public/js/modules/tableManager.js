import {javaScriptText, locationArray} from "../i18n.js";
import {getSocket} from "./socket.js";

const io = getSocket()

// tableManager.js
export function saveToLocalStorage(type, data) {
    const key = type === 'qr' ? 'qrItems' : 'eanItems';
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    items.push(data);
    localStorage.setItem(key, JSON.stringify(items));
}

export function removeFromLocalStorage(type, index) {
    const key = type === 'qr' ? 'qrItems' : 'eanItems';
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    items.splice(index, 1);
    localStorage.setItem(key, JSON.stringify(items));
}

export function renderTable(type, send = false) {
    const tableBody = document.getElementById(`${type}Table`).querySelector('tbody');
    const items = JSON.parse(localStorage.getItem(type === 'qr' ? 'qrItems' : 'eanItems')) || [];

    tableBody.innerHTML = '';

    // Define location options (customize these as needed)
    const locations = locationArray();

    items.forEach((item, index) => {
        const row = document.createElement('tr');

        // Build location dropdown
        const locationSelect = `
            <select class="form-select form-select-sm" data-type="${type}" data-index="${index}">
                ${locations.map(loc => `
                    <option value="${loc.key}" ${item.location === loc.key ? 'selected' : ''}>${loc.name}</option>
                `).join('')}
            </select>
        `;

        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.code}</td>
            ${type === 'ean' ? `<td>${item.quantity}</td>` : ''}
            <td>${locationSelect}</td>
            <td><input type="date" class="form-control form-control-sm" value="${item.expiry}" data-type="${type}" data-index="${index}"></td>
            <td><button class="btn btn-sm btn-outline-danger" data-type="${type}" data-index="${index}">${javaScriptText.deleteButton}</button></td>
        `;
        tableBody.appendChild(row);
    });

    if (send) {
        sendLocalStorage();
    }
}

function sendLocalStorage() {
    io.emit('updateFromClient', {
        eanItems: JSON.parse(localStorage.getItem('eanItems')),
        qrItems: JSON.parse(localStorage.getItem('qrItems')),
    })
}

export function initTableEvents() {
    ['qr', 'ean'].forEach((type) => {
        const table = document.getElementById(`${type}Table`);

        table.addEventListener('change', function (e) {
            // Handle expiry date updates
            if (e.target && e.target.matches('input[type="date"]')) {
                const newDate = e.target.value;
                const index = e.target.dataset.index;
                const products = JSON.parse(localStorage.getItem(type === 'qr' ? 'qrItems' : 'eanItems') || '[]');

                if (products[index]) {
                    products[index].expiry = newDate;
                    localStorage.setItem(type === 'qr' ? 'qrItems' : 'eanItems', JSON.stringify(products));
                    sendLocalStorage();
                    Swal.fire({
                        icon: 'success',
                        title: javaScriptText.expiryUpdateSuccessTitle,
                        text: javaScriptText.expiryUpdateSuccessText,
                        timer: 1500,
                        showConfirmButton: false,
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: javaScriptText.expiryUpdateFailTitle,
                        text: javaScriptText.expiryUpdateFailText,
                    });
                }
            }

            // Handle location dropdown updates
            if (e.target && e.target.matches('select[data-type]')) {
                const newLocation = e.target.value;
                const index = e.target.dataset.index;
                const products = JSON.parse(localStorage.getItem(type === 'qr' ? 'qrItems' : 'eanItems') || '[]');

                if (products[index]) {
                    products[index].location = newLocation;
                    localStorage.setItem(type === 'qr' ? 'qrItems' : 'eanItems', JSON.stringify(products));
                    sendLocalStorage();
                    Swal.fire({
                        icon: 'success',
                        title: javaScriptText.locationUpdateSuccessTitle,
                        text: javaScriptText.locationUpdateSuccessText,
                        timer: 1500,
                        showConfirmButton: false,
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: javaScriptText.locationUpdateFailTitle,
                        text: javaScriptText.locationUpdateFailText,
                    });
                }
            }
        });

        // Handle delete button
        table.addEventListener('click', (e) => {
            if (e.target.matches('button[data-type]')) {
                const type = e.target.dataset.type;
                const index = parseInt(e.target.dataset.index);
                removeFromLocalStorage(type, index);
                renderTable(type, true);
            }
        });
    });
}

export {
    sendLocalStorage,
}