// === Firebase Configuration ===
// INSTRUCTIE: Vul hier je eigen Firebase config in.
// Ga naar https://console.firebase.google.com
// 1. Maak een nieuw project aan (bijv. "olw-wild-west")
// 2. Ga naar Project Settings > General > Your apps > Web app
// 3. Kopieer de firebaseConfig object hieronder
// 4. Schakel Realtime Database in (Build > Realtime Database > Create Database > Start in test mode)

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "olw-wild-west.firebaseapp.com",
  databaseURL: "https://olw-wild-west-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "olw-wild-west",
  storageBucket: "olw-wild-west.firebasestorage.app",
  messagingSenderId: "293186823933",
  appId: "1:293186823933:web:9379bcb2cd4efbee3fc094"
};
// Initialize Firebase
let db = null;
let firebaseReady = false;

function initFirebase() {
  try {
    if (firebaseConfig.apiKey === "VULL-HIER-IN") {
      console.warn("Firebase config niet ingevuld! App draait in offline modus.");
      return false;
    }
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseReady = true;
    console.log("Firebase verbonden!");
    return true;
  } catch (e) {
    console.error("Firebase init mislukt:", e);
    return false;
  }
}

// Helper: write to Firebase or localStorage fallback
function localSet(path, value) {
  const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
  setNestedValue(store, path, value);
  localStorage.setItem('olw_game', JSON.stringify(store));
  notifyLocalListeners(path, value);
}

function localGet(path) {
  const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
  return getNestedValue(store, path);
}

// Race a promise against a timeout
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve('__TIMEOUT__'), ms))
  ]);
}

function dbSet(path, value) {
  // Always write to localStorage immediately
  localSet(path, value);
  if (firebaseReady && db) {
    // Fire and forget — don't block on Firebase
    db.ref(path).set(value).catch(e => {
      console.warn('Firebase write failed:', e.message);
    });
  }
  return Promise.resolve();
}

function dbUpdate(path, value) {
  const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
  const current = getNestedValue(store, path) || {};
  localSet(path, { ...current, ...value });
  if (firebaseReady && db) {
    db.ref(path).update(value).catch(e => {
      console.warn('Firebase update failed:', e.message);
    });
  }
  return Promise.resolve();
}

function dbGet(path) {
  if (firebaseReady && db) {
    return withTimeout(
      db.ref(path).once('value').then(snap => snap.val()),
      2000
    ).then(result => {
      if (result === '__TIMEOUT__') {
        console.warn('Firebase read timed out, using localStorage');
        return localGet(path);
      }
      return result;
    }).catch(e => {
      console.warn('Firebase read failed:', e.message);
      return localGet(path);
    });
  }
  return Promise.resolve(localGet(path));
}

function dbListen(path, callback) {
  if (firebaseReady && db) {
    let fired = false;
    db.ref(path).on('value', snap => {
      fired = true;
      callback(snap.val());
    });
    // Fallback: if Firebase doesn't fire within 3s, use localStorage
    setTimeout(() => {
      if (!fired) {
        console.warn('Firebase listener timed out for', path, '— falling back to localStorage');
        addLocalListener(path, callback);
        const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
        callback(getNestedValue(store, path));
      }
    }, 3000);
    return;
  }
  // Offline: poll localStorage
  addLocalListener(path, callback);
  // Initial call
  const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
  callback(getNestedValue(store, path));
}

function dbRemoveListener(path) {
  if (firebaseReady && db) {
    db.ref(path).off();
  }
}

// Offline listener system
const localListeners = {};

function addLocalListener(path, callback) {
  if (!localListeners[path]) localListeners[path] = [];
  localListeners[path].push(callback);
}

function notifyLocalListeners(changedPath, value) {
  Object.keys(localListeners).forEach(listenPath => {
    if (changedPath.startsWith(listenPath) || listenPath.startsWith(changedPath)) {
      const store = JSON.parse(localStorage.getItem('olw_game') || '{}');
      localListeners[listenPath].forEach(cb => cb(getNestedValue(store, listenPath)));
    }
  });
}

// Nested object helpers
function setNestedValue(obj, path, value) {
  const keys = path.split('/').filter(k => k);
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function getNestedValue(obj, path) {
  const keys = path.split('/').filter(k => k);
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return null;
    current = current[key];
  }
  return current === undefined ? null : current;
}
