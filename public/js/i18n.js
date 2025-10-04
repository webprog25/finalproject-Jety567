// js/i18n.js

import {
    showToastFlag
} from "./modules/socket.js";
import Loader from "./modules/loader.js";

export let locations = null;
export let javaScriptText = {}
let translations = null;
export let languages = null
let currentLanguage = null;

const languageListeners = new Set();

async function getLanguages() {
    try {
        let request = await fetch('/api/languages');
        if (request.ok) {
            let json = await request.json();
            return json;
        } else {
            throw new Error('Failed to get languages.');
        }
    }catch(e) {
        console.error(e);
        return {
            en: {
                label: "English",
                flag: 'gb'
            }
        };
    }
}

export async function loadI18n(lang = 'en') {

    // Instantiate immediately
    window.loader = new Loader();

    // Start it right away
    window.loader.startLoader(6000);

    languages = await getLanguages();
    currentLanguage = lang;

    const response = await fetch(`./locales/${lang}.json`);
    translations = await response.json();

    const request = await fetch(`./locales/js/${lang}.json`);
    javaScriptText = await request.json();

    const request_locations = await fetch(`/api/location`);
    locations = await request_locations.json();

    document.getElementById('languageDropdown').innerHTML = `
    <img src="https://flagcdn.com/w20/${languages[lang].flag}.png" alt="English" id="langFlag" className="me-1"/>
    <span id="langLabel">${languages[lang].label}</span>
    `


    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[key]) {
            el.placeholder = translations[key];
        }
    });

    document.documentElement.lang = lang;
    localStorage.setItem('language', lang);

    languageListeners.forEach(cb => cb());

    if (window.loader)
        window.loader.stopLoader();

    showToastFlag(`${javaScriptText.languageChanged} ${languages[lang].label}`,`https://flagcdn.com/w20/${languages[lang].flag}.png`);
}

export function setUpDropdown() {
    let dropdownHtml = ''

    Object.keys(languages).forEach((key) => {
        dropdownHtml += `<li><a class="dropdown-item" href="#" data-lang="${key}"><img src="https://flagcdn.com/w20/${languages[key].flag}.png" class="me-2" /> ${languages[key].label}</a></li>`
    })

    document.getElementById('languageDropdownMenu').innerHTML += dropdownHtml
}

export function onLanguageChange(callback) {
    languageListeners.add(callback);
    return () => languageListeners.delete(callback); // Unsubscribe helper
}

export function getLocationName(location) {
    if (translations && translations.hasOwnProperty(location)) {
        return translations[location];
    }
    for (let item of locations) {
        if (item.name === location) {
            return item.languages[currentLanguage];
        }
    }
}

export function locationArray() {
    let locArray = [{
        key: "freezer",
        name: getLocationName("freezer")
    },{
        key: "shelf",
        name: getLocationName("shelf")
    }];

    for (let item of locations) {
        locArray.push({
            key: item.name,
            name: item.languages[currentLanguage]
        });
    }

    return locArray;
}

export function locationObject() {
    let object = {}
    for (let item of locationArray()) {
        object[item.key] = item.name;
    }

    return object;
}