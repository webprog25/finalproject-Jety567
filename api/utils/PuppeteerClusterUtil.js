// utils/puppeteerCluster.js
import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

let cluster = null;

// Add stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Initializes Puppeteer Cluster (once).
 */
export async function initCluster() {
    if (!cluster) {
        cluster = await Cluster.launch({
            puppeteer, // Use puppeteer-extra
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 4,
            puppeteerOptions: {
                headless: 'new', // just for debugging
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
            monitor: false,
            timeout: 300000
        });

        console.log('✅ Puppeteer Cluster with Stealth launched');
    }
}

/**
 * Get a new page-like context from the cluster.
 * This returns a Puppeteer Page object you can use freely.
 */
export function getPage(callbackFn) {
    if (!cluster) {
        throw new Error('Puppeteer cluster not initialized. Call initCluster() first.');
    }

    return cluster.execute({}, async ({ page }) => {
        return await callbackFn(page);
    });
}

/**
 * Gracefully close the cluster (optional for shutdown).
 */
export async function closeCluster() {
    if (cluster) {
        await cluster.idle();
        await cluster.close();
        cluster = null;
        console.log('🛑 Puppeteer Cluster closed');
    }
}