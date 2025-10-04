import {javaScriptText} from "../i18n.js";
import {renderTable} from "./tableManager.js";

// uploader.js
export async function uploadEan(btn) {
    combineEan()
    renderTable('ean',true);

    let oldText = btn.innerText;

    btn.innerText = javaScriptText.uploading;
    btn.disabled = true;

    let items = localStorage.getItem(`eanItems`);
    let progressbar = document.getElementById('eanProgress');
    let progressBarContainer = document.getElementById('eanProgressContainer');
    const tableBody = document.getElementById(`eanTable`).querySelector('tbody');
    let rows = tableBody.getElementsByTagName('tr');

    progressBarContainer.hidden = false;
    progressBarContainer.focus();

    items = JSON.parse(items);

    let itemsCount = items.length;

    for (let i = 0; i < itemsCount; i++) {
        let item = items[i];
        let request = await fetch('/api/shelf/item/ean', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: item.name,
                quantity: item.quantity,
                ean: item.code,
                expiry: item.expiry,
                location: item.location,
            })
        });
        if (request.ok) {
            let json = await request.json();

            let button = rows[i].querySelector('button');

            button.innerText = javaScriptText.uploaded;
            button.disabled = true;
            button.classList.remove('btn-outline-danger');
            button.classList.add('btn-outline-success');

            removeItemFromLocalStorage(json.code,json.expiry);

            setPercentageProgressbar(Math.round((i + 1) / itemsCount * 100),progressbar);
        }
    }
    progressBarContainer.hidden = true;
    btn.innerText = oldText;
    btn.disabled = false;


    Swal.fire(javaScriptText.receiptSuccessTitle, javaScriptText.receiptSuccessText, "success").then((result) => {
        renderTable('ean',true);
    })
}

export async function uploadQr(btn) {

    let oldText = btn.innerText;
    btn.innerText = javaScriptText.uploading;
    btn.disabled = true;

    let items = JSON.parse(localStorage.getItem(`qrItems`)) || [];
    const tableBody = document.getElementById(`qrTable`).querySelector('tbody');
    let rows = tableBody.getElementsByTagName('tr');

    let itemsCount = items.length;

    for (let i = 0; i < itemsCount; i++) {
        let item = items[i];

        let request = await fetch('/api/shelf/item/qr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: item.name,
                quantity: item.quantity,
                code: item.code, // QR code field
                expiry: item.expiry,
            })
        });

        if (request.ok) {
            let json = await request.json();

            let button = rows[i].querySelector('button');
            button.innerText = javaScriptText.uploaded;
            button.disabled = true;
            button.classList.remove('btn-outline-danger');
            button.classList.add('btn-outline-success');

            removeItemFromLocalStorage(json.code, json.expiry);
        }
    }

    btn.innerText = oldText;
    btn.disabled = false;

    Swal.fire(
        javaScriptText.receiptSuccessTitle,
        javaScriptText.receiptSuccessText,
        "success"
    ).then(() => {
        renderTable('qr', true);
    });
}

function removeItemFromLocalStorage(ean,expiry) {
    let items = localStorage.getItem(`eanItems`);
    items = JSON.parse(items);

    items = items.filter(item => item.code !== ean && item.expiry === expiry);

    localStorage.setItem(`eanItems`, JSON.stringify(items));
}

function setPercentageProgressbar(percent,bar) {
    console.log(bar,percent);
    bar.style.width = percent + '%';
    bar.innerText = percent + '%';
}


export function combineEan() {
    let items = localStorage.getItem(`eanItems`);
    items = JSON.parse(items);

    items = combineArticles(items);

    localStorage.setItem(`eanItems`, JSON.stringify(items));
}

function combineArticles(items) {
    const combined = [];

    for (const item of items) {
        const existing = combined.find(
            (a) => a.code === item.code && a.expiry === item.expiry
        );

        if (existing) {
            existing.quantity += item.quantity;
        } else {
            combined.push({ ...item }); // clone to avoid mutation
        }
    }

    return combined;
}

export function initReceiptUpload(renderTable) {
    document.getElementById("processReceipt").addEventListener("click", async () => {
        const button = document.getElementById("processReceipt");
        const fileInput = document.getElementById("receiptPdf");
        const selectInput = document.getElementById("storeSelect");
        const file = fileInput.files[0];

        if (!file) {
            Swal.fire(javaScriptText.noFileSelected, javaScriptText.noFileSelectedText, 'warning');
            return;
        }

        button.disabled = true;
        const originalText = button.textContent;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${javaScriptText.processingText}`;

        const formData = new FormData();
        formData.append("pdf", file, file.name);

        let brand = selectInput.value;

        try {
            const response = await fetch(`/api/${brand}/receipt`, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: formData,
            });

            if (!response.ok) throw new Error();

            const json = await response.json();
            const existing = JSON.parse(localStorage.getItem("eanItems") || []);
            localStorage.setItem("eanItems", JSON.stringify([...existing, ...json]));
            renderTable("ean",true);

            Swal.fire(javaScriptText.receiptSuccessTitle, javaScriptText.receiptSuccessText, "success");
        } catch (err) {
            console.error(err);
            Swal.fire(javaScriptText.receiptFailTitle, javaScriptText.receiptFailText, "error");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    document.getElementById('uploadQR').addEventListener('click', async () => {
        await uploadQr(document.getElementById('uploadQR'));
        console.log('upload qr');
    });
    document.getElementById('uploadEAN').addEventListener('click', async () => {
        await uploadEan(document.getElementById('uploadEAN'));
        console.log('upload ean');
    });
    document.getElementById('combineEAN').addEventListener('click', () => {
        combineEan();
        renderTable('ean',true);
    });
}