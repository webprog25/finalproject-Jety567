// browserSingleton.js
import puppeteer from "puppeteer";

let browserInstance = null;

/**
 * Returns a singleton Puppeteer browser instance.
 * If already launched, returns the existing instance.
 * Otherwise, launches a new browser with secure default settings.
 *
 * @returns {Promise<import('puppeteer').Browser>} Puppeteer browser instance
 */
async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: 'new', // runs in headless mode using latest Chromium
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browserInstance;
}

/**
 * Closes the Puppeteer browser instance (if exists)
 */
async function closeBrowser() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

export { getBrowser, closeBrowser };