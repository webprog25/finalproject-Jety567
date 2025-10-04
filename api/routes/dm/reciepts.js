import PDFParser from 'pdf2json';
import fs from 'fs';
import { chromium } from "playwright";
import axios from "axios";
import cache from '../../utils/persistentCache.js';
import Fuse from 'fuse.js';

let browserInstance = null;
const CACHE_NAME = 'dmReceiptsData';

await cache.loadCache(CACHE_NAME);

// Load dictionary and initialize Fuse.js for fuzzy matching
const dictionary = JSON.parse(fs.readFileSync('api/routes/dm/dictionary.json', 'utf8'));
const fuse = new Fuse(dictionary, { includeScore: true, threshold: 0.7 });

/**
 * Express route: Extract products from uploaded DM PDF receipt and return structured items.
 *
 * @route POST /api/dm/receipt
 * @param {import('express').Request} req - Expect `req.file` with uploaded PDF.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
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
            code: product.gtin,
            type: "article"
        }));

        res.json(items);
    } catch (err) {
        fs.unlink(pdfPath, () => {});
        res.status(500).json({ error: err.message });
    }
}

/**
 * Parse PDF and match products against dictionary and DM API.
 *
 * @param {string} pdfPath
 * @returns {Promise<Array>} List of matched products
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
                    text.R.forEach(r => { fullText += decodeURIComponent(r.T) + '\n'; });
                });
                fullText += '\n';
            });

            const above = fullText.split("SUMME EUR")[0];
            const lines = above.split('\n').slice(3, -1);
            const results = [];

            for (const line of lines) {
                const parsed = parseProductLine(line);
                if (!parsed) continue;

                const { productName, price, quantity } = parsed;
                try {
                    const matched = await getProduct(productName, price, quantity);
                    if (matched) results.push(matched);
                } catch (err) {
                    console.error(err);
                }
            }

            resolve(results);
        });

        pdfParser.loadPDF(pdfPath);
    });
}

/**
 * Parse a single line of product text from PDF.
 *
 * @param {string} line
 * @returns {{ productName: string, price: number, quantity: number }|null}
 */
function parseProductLine(line) {
    const quantityMatch = line.match(/^(\d+)x\s+/);
    let quantity = 1;
    let restLine = line;

    if (quantityMatch) {
        quantity = parseInt(quantityMatch[1], 10);
        restLine = line.slice(quantityMatch[0].length);
    }

    const regex = /^(.+?)\s+(\d+,\d{2})\s+(\d+)$/;
    const match = restLine.match(regex);
    if (!match) return null;

    let productName = match[1].trim();
    let price = parseFloat(match[2].replace(',', '.'));

    if (quantity !== 1) {
        price = price / quantity;
        productName = productName.replace(`${price}`.replace('.', ','), '').trim();
    }

    return { productName, price, quantity };
}

/**
 * Fetch product from DM API matching name and price.
 *
 * @param {string} productName
 * @param {number} price
 * @param {number} quantity
 * @returns {Promise<Object|null>}
 */
async function getProduct(productName, price, quantity) {
    productName = sanitizeText(productName);
    const { from, to } = priceBoundary(price);

    const axiosUrl = `https://product-search.services.dmtech.com/de/search?query=${encodeURIComponent(productName)}&searchProviderType=dm-products&price.value.from=${from}&price.value.to=${to}`;

    try {
        const cachedHeader = await cache.get(CACHE_NAME,'header');
        if (cachedHeader !== null) {
            const products = await axiosRequestProducts(axiosUrl, cachedHeader);
            const priceMatches = products.filter(p => {
                const priceStr = p?.tileData?.price?.price?.current?.value;
                if (!priceStr) return false;
                return parseFloat(priceStr.replace(',', '.').replace('€', '').trim()) === price;
            });

            if (priceMatches.length > 0) {
                let bestMatch = priceMatches.reduce((best, p) => {
                    const score = similarityScore(productName, p?.title || '');
                    return score > best.score ? { product: p, score } : best;
                }, { product: null, score: -1 });

                if (bestMatch.product) {
                    bestMatch.product.quantity = quantity;
                    return bestMatch.product;
                }
            }
        }

        const { products, normalizedHeaders } = await waitForApiWithProducts(axiosUrl, 'https://product-search.services.dmtech.com/de/search?query');
        cache.set(CACHE_NAME, 'header', normalizedHeaders);
        await cache.saveCache(CACHE_NAME);

        return products.find(p => {
            const priceStr = p?.tileData?.price?.price?.current?.value;
            if (!priceStr) return false;
            const priceFloat = parseFloat(priceStr.replace(',', '.').replace('€', '').trim());
            if (priceFloat !== price) return false;
            return similarityScore(p?.title || '', productName) >= 0.3;
        });
    } catch (error) {
        console.error(`Error while fetching product: ${error}`);
        return null;
    }
}

/**
 * Helper: Axios GET for product search.
 */
async function axiosRequestProducts(url, headers) {
    try {
        const response = await axios.get(url, { headers });
        return response.data.products;
    } catch (error) {
        console.error(`Error while fetching product: ${error}`);
        return [];
    }
}

/**
 * Wait for DM API response via Playwright.
 */
async function waitForApiWithProducts(pageUrl, apiBaseUrl) {
    return new Promise(async (resolve, reject) => {
        const browser = await getBrowser();
        const page = await browser.newPage();
        let done = false;

        const timeout = setTimeout(async () => {
            if (!done) {
                done = true;
                await page.close().catch(() => {});
                reject(new Error('Timeout waiting for API response'));
            }
        }, 15000);

        page.on('response', async response => {
            if (done) return;
            if (response.url().startsWith(apiBaseUrl)) {
                try {
                    const headers = response.request().headers();
                    const json = await response.json();
                    if (json && json.products) {
                        done = true;
                        clearTimeout(timeout);
                        const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v]));
                        await page.close().catch(() => {});
                        resolve({ products: json.products, normalizedHeaders });
                    }
                } catch (err) {
                    if (!done) {
                        done = true;
                        clearTimeout(timeout);
                        await page.close().catch(() => {});
                        reject(err);
                    }
                }
            }
        });

        try { await page.goto(pageUrl, { waitUntil: 'networkidle' }); }
        catch (err) { if (!done) { done = true; clearTimeout(timeout); await page.close().catch(() => {}); reject(err); } }
    });
}

/** Helper: Price boundary rounding */
function priceBoundary(price) { return { from: Math.floor(price), to: Math.ceil(price) }; }

/** Get or launch headless browser */
async function getBrowser() {
    if (!browserInstance) browserInstance = await chromium.launch({ headless: true });
    return browserInstance;
}

/** Sanitize text and fuzzy-match tokens */
function sanitizeText(raw) {
    let sanitized = raw
        .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, '$1 $2')
        .replace(/([A-ZÄÖÜ])([a-zäöüß])/g, '$1$2')
        .replace(/(?<=[a-zäöüß])(?=\d)/gi, ' ')
        .replace(/(?<=\d)(?=[a-zäöüß])/gi, ' ')
        .replace(/[^a-z0-9äöüß ]+/gi, ' ')
        .replace(/\b\d+(g|kg|ml|l)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    let tokens = sanitized.split(' ').filter(Boolean);
    tokens = tokens.filter(token => token.length > 2 || dictionary.includes(token));
    return tokens.map(token => {
        const results = fuse.search(token);
        return results.length > 0 && results[0].score < 0.3 ? results[0].item : token;
    }).join(' ');
}

/** Compute similarity score between two strings */
function similarityScore(str1, str2) {
    const tokens1 = str1.split(' ').filter(Boolean);
    const tokens2 = str2.split(' ').filter(Boolean);
    let matchWeight = 0;
    const matchedTokens2 = new Set();

    for (const t1 of tokens1) {
        let bestPartialScore = 0, bestMatchIndex = -1;
        for (let i = 0; i < tokens2.length; i++) {
            if (matchedTokens2.has(i)) continue;
            const lcsLength = longestCommonSubstring(t1, tokens2[i]);
            const partialScore = lcsLength / Math.min(t1.length, tokens2[i].length);
            if (partialScore > bestPartialScore) { bestPartialScore = partialScore; bestMatchIndex = i; }
        }
        if (bestPartialScore > 0.5 && bestMatchIndex !== -1) {
            matchWeight += bestPartialScore;
            matchedTokens2.add(bestMatchIndex);
        }
    }
    return matchWeight / ((tokens1.length + tokens2.length) / 2);
}

/** Longest common substring length */
function longestCommonSubstring(s1, s2) {
    const dp = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(0));
    let maxLen = 0;
    for (let i = 1; i <= s1.length; i++)
        for (let j = 1; j <= s2.length; j++)
            if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1, maxLen = Math.max(maxLen, dp[i][j]);
    return maxLen;
}

export { extraPDFReceipt };