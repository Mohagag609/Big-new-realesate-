const DB_NAME = 'RealEstateDB';
const DB_VERSION = 1;
let db;

const OBJECT_STORES = [
    'customers', 'units', 'partners', 'unitPartners', 'contracts',
    'installments', 'payments', 'partnerDebts', 'safes', 'transfers',
    'auditLog', 'vouchers', 'brokerDues', 'brokers', 'partnerGroups', 'appState' // appState for settings/locked
];

function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Database error: ' + event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            OBJECT_STORES.forEach(name => {
                if (!tempDb.objectStoreNames.contains(name)) {
                    if (name === 'appState') {
                        // For key-value pairs like settings
                        tempDb.createObjectStore(name, { keyPath: 'key' });
                    } else {
                        // For arrays of objects with an 'id'
                        const store = tempDb.createObjectStore(name, { keyPath: 'id' });
                        // Create indexes for common lookups
                        if (name === 'contracts') {
                            store.createIndex('unitId', 'unitId', { unique: false });
                            store.createIndex('customerId', 'customerId', { unique: false });
                        }
                        if (name === 'installments' || name === 'unitPartners' || name === 'payments') {
                            store.createIndex('unitId', 'unitId', { unique: false });
                        }
                         if (name === 'vouchers') {
                            store.createIndex('linked_ref', 'linked_ref', { unique: false });
                            store.createIndex('safeId', 'safeId', { unique: false });
                        }
                    }
                }
            });
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully.');
            resolve(db);
        };
    });
}

async function getStore(storeName, mode) {
    const db = await initDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
}

async function getAll(storeName) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function get(storeName, key) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function add(storeName, item) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function put(storeName, item) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function remove(storeName, key) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function clearStore(storeName) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// Export a clean API for the application to use
window.db = {
    init: initDB,
    getAll,
    get,
    add,
    put,
    remove,
    clearStore
};
