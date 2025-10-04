import * as cheerio from 'cheerio'
import axios from "axios";
import fs from 'fs';
import puppeteer from 'puppeteer';
import {response} from "express";

const cookies = 'NoCookie=true; OptanonConsent=isGpcEnabled=0&datestamp=Wed+Aug+27+2025+22%3A11%3A31+GMT%2B0200+(Mitteleurop%C3%A4ische+Sommerzeit)&version=202506.1.0&browserGpcFlag=0&isIABGlobal=false&consentId=81a50421-2a02-47ec-b7eb-f3ee72cb90cc&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A0%2CC0003%3A0%2CC0004%3A0%2CRM001%3A0%2CC0010%3A0&hosts=H89%3A0%2CH50%3A0&genVendors=V21%3A0%2CV29%3A0%2CV8%3A0%2CV12%3A0%2CV14%3A0%2CV22%3A0%2CV10%3A0%2CV16%3A0%2CV2%3A0%2CV26%3A0%2CV11%3A0%2CV18%3A0%2CV28%3A0%2CV3%3A0%2CV1%3A0%2CV4%3A0%2CV27%3A1%2CV24%3A0%2CV25%3A1%2C&intType=2&geolocation=%3B&AwaitingReconsent=false; rsmn_storefront_analytics=v2; csrf-secret=6t%2BASXMrO0qjJdxWw9JcTOH9; i18next=de; JSESSIONSHOPID=Y16-142d8067-6cc5-4d70-81ab-82670d41a5ff.accstorefront-99877797d-27v2b; ROUTE=.accstorefront-99877797d-27v2b; _fs_ch_cp_79UUvfpJ5mWYtLQv=AXegR5hxzdcOOO23GjF7YjObs9H3Ou-k7nhz_aB-Gj0u72ugyUhDXUZQ1LzECSMTJzWUHdf7ydwL64pM5k7uYCvnvKAyNBpCmQuLaDS9cJOGPmmrs6MpQpaU1PUQc_1A7tAHOpflVpGsp9hTazRoueB3OPGj_Du08h92_cMweNOxVjaX6J5lR6XSOzQMNRXCeGZ8sHTRdzuioz5vslJlp6egYJ8_5c86KhW0u3Xh-21dbh6htmBWyVyKu_J89WeCLeYgXTS0fvztoAQ-BPBH4r0OE0kOJrc=; OptanonAlertBoxClosed=2025-08-16T19:18:59.103Z'

async function findProduct(ean, cookies = null) {
    let url = `https://www.rossmann.de/de/p/${ean}`;

    if (cookies === null) {
        cookies = await getCookiesForAxios(url)
    }

    console.log(cookies)

    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookies,
    };

    const request = await axios.get(url, {
        headers: headers
    });

    let html = request.data;

    const finalUrl = request.request.res.responseUrl || url;

    fs.writeFileSync(`./${ean}.html`, JSON.stringify(html));

    let $ = cheerio.load(html);
    const button = $('button[data-cart-add]');

    if (button.length === 0) {
        return findProduct(ean)
    }


    const productData = {};
    Object.keys(button[0].attribs).forEach(attr => {
        if (attr.startsWith('data-')) {
            productData[attr.replace(/^data-/, '')] = button.attr(attr);
        }
    });

    let name = `${productData['product-brand']} ${productData['product-name']}`;

    const img = $(`img[alt="${name}"]`);

    return {
        ean: ean,
        url: finalUrl,
        image: img[0].attribs['data-src'],
        price: parseFloat(productData['product-price']),
        articleNumber: productData['product-id'],
    };
}

async function checkAvailability(articleNr, store, cookies = null) {
    let url = `https://www.rossmann.de/storefinder/.rest/store/${store}?dan=${articleNr}`

    if (cookies === null) {
        cookies = await getCookiesForAxios(url)
    }

    try {
        let request = await axios.get(url, {
            headers: {
                cookie: cookies,
            }
        })

        let data = request.data;


        if (request.headers['content-type'].includes('application/json')) {
            return data;
        } else {
            return checkAvailability(articleNr, store);
        }
    } catch (e) {
        return null;
    }
}

async function getCookiesForAxios(url) {
    // Launch headless browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the page and wait until network is idle (all requests done)
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Get all cookies from the page
    const cookies = await page.cookies();

    // Format cookies as a single string: "name=value; name2=value2; ..."
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    await browser.close();

    return cookieString;
}

checkAvailability("578127","1217",cookies).then((result) => {
    console.log(result);
})

