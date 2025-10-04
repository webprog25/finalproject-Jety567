/*
Here a shema json for the database
*/

const stores = {
    "storeId": "1214",
    "storeNumber": "1214",
    "brand": "rossmann",
    "address": {
        "name": "Rossmann",
        "street": "Bahnhofstr. 23-27",
        "zip": "83022",
        "city": "Rosenheim",
        "regionName": "bayern"
    },
    "phone": null,
    "coordinates": [
        47.851114070066,
        12.120982351938
    ],
    "openingHours": {
        "Monday": [
            {
                "open": "08:00",
                "close": "20:00"
            }
        ],
        "Tuesday": [
            {
                "open": "08:00",
                "close": "20:00"
            }
        ],
        "Wednesday": [
            {
                "open": "08:00",
                "close": "20:00"
            }
        ],
        "Thursday": [
            {
                "open": "08:00",
                "close": "20:00"
            }
        ],
        "Friday": [
            {
                "open": "08:00",
                "close": "20:00"
            }
        ],
        "Saturday": [
            {
                "open": "08:00",
                "close": "19:00"
            }
        ],
        "Sunday": []
    },
}

const shelf_item = {
    ean: null,
    qr_code: null,
    quantity: 1,
    expires_at: '2014-21-12',
    location: null, // Enum [freezer, shelf]
}

const shopping_list_item = {
    ean: null,
    quantity: 1,
}

const article = {
    ean: 1,
    name: "Rossmann",
    price: {
        dm: 1.69,
        rossmann: 2,
        mueller: 3,
        lastUpdated: Date.now(),
    },
    imageUrl: null,
    productUrl: {
        dm: null,
        rossmann: null,
        mueller: null,
    },
    articleNumber: {
        dm: null,
        rossmann: null,
        mueller: null,
    },
    storeAvailability: {
        dm: [{
            storeId: "1214",
            quantity: 1,
        }, {
            storeId: "1216",
            quantity: 1,
        }],
        rossmann: null,
        mueller: null,
        lastUpdated: Date.now(), // Date
    },
    updatedAt: null,
    createdAt: null,
}

let item = {
    qr_code: null,
    name: "Rossmann",
}