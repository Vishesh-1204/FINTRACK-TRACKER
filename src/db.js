// ===== IndexedDB Wrapper =====
const DB_NAME = 'FinTrackDB';
const DB_VERSION = 2;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('username', 'username', { unique: true });
      }

      // Income store
      if (!db.objectStoreNames.contains('income')) {
        const incomeStore = db.createObjectStore('income', { keyPath: 'id' });
        incomeStore.createIndex('userId', 'userId', { unique: false });
        incomeStore.createIndex('userMonth', ['userId', 'month'], { unique: true });
      }

      // Categories store
      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('userId', 'userId', { unique: false });
        catStore.createIndex('userMonth', ['userId', 'month'], { unique: false });
      }

      // Expenses store
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expStore.createIndex('userId', 'userId', { unique: false });
        expStore.createIndex('userMonth', ['userId', 'month'], { unique: false });
        expStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // Goals store
      if (!db.objectStoreNames.contains('goals')) {
        const goalsStore = db.createObjectStore('goals', { keyPath: 'id' });
        goalsStore.createIndex('userId', 'userId', { unique: false });
      }

      // v2: Savings Fund store (accumulated savings across months)
      if (!db.objectStoreNames.contains('savingsFund')) {
        const sfStore = db.createObjectStore('savingsFund', { keyPath: 'id' });
        sfStore.createIndex('userId', 'userId', { unique: true });
      }

      // v2: Bank Tracker store (current balance, credits, debits)
      if (!db.objectStoreNames.contains('bankTracker')) {
        const btStore = db.createObjectStore('bankTracker', { keyPath: 'id' });
        btStore.createIndex('userId', 'userId', { unique: true });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Generic CRUD helpers
async function addRecord(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function putRecord(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getRecord(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteRecord(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllByIndex(storeName, indexName, keyValue) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(keyValue);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getByIndex(storeName, indexName, keyValue) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.get(keyValue);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

export { openDB, generateId, addRecord, putRecord, getRecord, deleteRecord, getAllByIndex, getByIndex };
