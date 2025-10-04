import {loadI18n, onLanguageChange, setUpDropdown} from './i18n.js';
import {initSocket} from './modules/socket.js'

const toggle = document.getElementById('darkModeToggle');
const html = document.documentElement;
const navbar = document.getElementById('mainNav');

window.locations = null;

function setTheme(mode) {
    html.setAttribute('data-bs-theme', mode);
    navbar.setAttribute('data-bs-theme', mode);
    localStorage.setItem('theme', mode);
    toggle.checked = mode === 'dark';
}

let locations = null;

async function initApp() {
    try {
        let response = await fetch('/api/settings');
        if (response.ok) {
            let json = await response.json();
            const savedTheme = localStorage.getItem('theme') || (json.darkMode ? 'dark' : 'light');
            setTheme(savedTheme);

            const lang = localStorage.getItem('language') || json.defaultLanguage;
            loadI18n(lang).then(() => {
                setUpDropdown();
                initSocket();
                fetch('/api/location').then((response) => {
                    if (response.ok) {
                        return response.json();
                    }
                }).then((json) => {
                    locations = json;
                    window.locations = json;
                    updateDropdown(json,lang)
                }).catch((error) => {
                    console.log(error);
                })
                document.querySelectorAll('[data-lang]').forEach(item => {
                    item.addEventListener('click', e => {
                        e.preventDefault();
                        const selectedLang = e.currentTarget.getAttribute('data-lang');
                        loadI18n(selectedLang);
                    });
                });
            });
        }
    } catch (error) {
        console.log(error);
    }
}

toggle.addEventListener('change', () => {
    const newTheme = toggle.checked ? 'dark' : 'light';
    setTheme(newTheme);
});

onLanguageChange(() => {
    const lang = localStorage.getItem('language') || json.defaultLanguage;
    if (locations !== null) {
        updateDropdown(locations,lang);
    }
})

function updateDropdown(items,lang) {
    const dropdownMenu = document.querySelector('ul[aria-labelledby="storageDropdown"]');
    document.querySelectorAll('ul[aria-labelledby="storageDropdown"] .new_added').forEach(row => row.remove());

    const dropDownAdd = document.getElementById('location');

    if (dropDownAdd) {
        document.querySelectorAll('select[id="location"] .new_added').forEach(row => row.remove());
    }

    for (const item of items) {
        // Create the new <li> and <a>
        const newItem = document.createElement('li');
        const newLink = document.createElement('a');

        newLink.classList.add('dropdown-item');
        newLink.href = `location.html?id=${item._id}`;
        newLink.id = item._id;
        newLink.textContent = item.languages[lang];

        // Put <a> inside <li>, then append to menu
        newItem.appendChild(newLink);
        newItem.classList.add('new_added');

        dropdownMenu.appendChild(newItem);

        if (dropDownAdd) {
            // Create the new <option>
            const newOption = document.createElement('option');

            // Set value and text
            newOption.value = item.name;
            newOption.textContent = item.languages[lang];

            // Add a class if needed
            newOption.classList.add('new_added');

            // Append to the <select>
            dropDownAdd.appendChild(newOption);
        }
    }
}

initApp();