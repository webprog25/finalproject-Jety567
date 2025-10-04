import PDFParser from 'pdf2json';
import fs from 'fs';
import { lookupProductByEan } from "../ean.js";

/**
 * Express route: Extract products from uploaded PDF receipt and return structured items.
 *
 * @route POST /api/receipt/pdf
 * @param {import('express').Request} req - Expect `req.file` with uploaded PDF.
 * @param {import('express').Response} res
 */
async function extraPDFReceipt(req, res) {
    if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

    const pdfPath = req.file.path;

    try {
        const products = await extractAndMatchProductsFromPDF(pdfPath);
        fs.unlink(pdfPath, () => {}); // delete temp file

        const items = products.map(product => ({
            name: `${product.brandName} ${product.title}`,
            quantity: product.quantity,
            expiry: "2025-08-03",
            location: "shelf",
            code: product.code,
            type: "article"
        }));

        res.json(items);
    } catch (err) {
        fs.unlink(pdfPath, () => {});
        res.status(500).json({ error: err.message });
    }
}

/**
 * Parse PDF file and extract product lines, then match them via EAN lookup.
 *
 * @param {string} pdfPath
 * @returns {Promise<Array>} List of products with quantity and code
 */
function extractAndMatchProductsFromPDF(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on('pdfParser_dataError', err => reject(err.parserError));
        pdfParser.on('pdfParser_dataReady', async pdfData => {
            const pages = pdfData.Pages;
            let fullText = '';

            pages.forEach(page => {
                page.Texts.forEach(text => {
                    text.R.forEach(r => {
                        fullText += decodeURIComponent(r.T) + '\n';
                    });
                });
                fullText += '\n';
            });

            let articles = fullText.split('--------------------------------------------------------')[1]
                .split('--------------------------------------------------------')[0]
                .split('\n');

            const products = [];

            for (const line of articles) {
                if (!line) continue;
                const info = parseReceiptLine(line);
                if (!info) continue;
                const product = await getProduct(info);
                if (product) products.push(product);
            }

            resolve(products);
        });

        pdfParser.loadPDF(pdfPath);
    });
}

/**
 * Lookup product details by EAN.
 *
 * @param {{ ean: string, quantity: number, name: string, price: number }} productInfo
 * @returns {Promise<{ brandName: string, title: string, quantity: number, code: string } | null>}
 */
async function getProduct({ ean, quantity }) {
    try {
        const request = await lookupProductByEan(ean);
        if (request.status !== 200) return null;

        const { product } = request.data;

        return {
            brandName: product.brand,
            title: product.name,
            quantity,
            code: ean,
        };
    } catch {
        return null;
    }
}

/**
 * Parse a single receipt line using regex.
 *
 * @param {string} line
 * @returns {{ ean: string, quantity: number, name: string, price: number } | null}
 */
function parseReceiptLine(line) {
    const regex = /^(?:'?)♥(?:(?<qty>\d+)X)?♥+(?<ean>\d+)♥+(?<name>.+?)♥+€(?<price1>\d+,\d{2})(?:♥+€(?<price2>\d+,\d{2}))?/u;
    const match = line.match(regex);
    if (!match) return null;

    const { qty, ean, name, price1, price2 } = match.groups;

    return {
        ean,
        quantity: qty ? parseInt(qty, 10) : 1,
        name: name.replace(/♥+/g, ' ').trim(),
        price: parseFloat((price2 || price1).replace(',', '.')),
    };
}

export { extraPDFReceipt };