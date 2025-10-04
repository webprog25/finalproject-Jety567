import {initMap,map} from './modules/storeMap.js'
import {loadStores} from "./modules/stores.js";
import {onLanguageChange} from "./i18n.js";

let brands = null;

initMap()

fetch('/api/settings').then(response => {
    if (response.ok) {
        return response.json();
    }
}).then((json) => {
    brands = json.brands;
    json.brands.forEach((brand) => {
        document.getElementById(brand).classList.remove('d-none');
    })
}).catch(error => {
    console.log(error);
})

onLanguageChange(() => {
    brands.forEach(brand => {
        loadStores(brand)
    })
})