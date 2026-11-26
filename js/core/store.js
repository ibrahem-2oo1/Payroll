/**
 * Dawam - Data Store
 * Central data access layer for all database operations.
 * Seeds from /data/db.json; persists to localStorage.
 * RULE: ALL data access in the entire app must go through this store.
 */

const DB_KEY = 'dawam_db';
const GH_TOKEN_KEY = 'dawam_gh_token';
const GH_CONFIG_KEY = 'dawam_gh_config';

let cache = null;

/**
 * Initializes the store. Loads existing data from localStorage or fetches /data/db.json.
 * @returns {Promise<object>}
 */
export async function initStore() {
  const localData = localStorage.getItem(DB_KEY);
  if (localData) {
    try {
      cache = JSON.parse(localData);
      ensureSchema(cache);
      return cache;
    } catch (err) {
      console.warn('Corrupted localStorage data, re-seeding from /data/db.json', err);
    }
  }

  // Fetch seed database
  try {
    const res = await fetch('./data/db.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
    ensureSchema(cache);
    saveDB(cache);
    return cache;
  } catch (err) {
    console.error('Failed to load seed db.json:', err);
    // Minimal fallback
    cache = getFallbackSchema();
    saveDB(cache);
    return cache;
  }
}

function ensureSchema(db) {
  if (!db.meta) db.meta = { version: 1, updatedAt: new Date().toLocaleString() };
  if (!db.settings) db.settings = {};
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.employees)) db.employees = [];
  if (!Array.isArray(db.attendance)) db.attendance = [];
  if (!Array.isArray(db.penalties)) db.penalties = [];
}

function getFallbackSchema() {
  return {
    meta: { version: 1, updatedAt: new Date().toLocaleString() },
    settings: {
      shiftStart: '08:00',
      shiftEnd: '16:00',
      breakMinutes: 30,
      graceMinutes: 0,
      otCountedPer60: 52,
      otMinMinutes: 0,
      penaltyDayHours: 4,
      absentDayHours: 8,
      leavePaid: true,
      lateCounterReset: 'monthly',
      lateRules: [
        { id: 'r1', type: 'late_x', factor: 2, hours: 0, label: 'ضعف التأخير (×2)' },
        { id: 'r2', type: 'late_x', factor: 3, hours: 0, label: 'ثلاثة أضعاف التأخير (×3)' },
        { id: 'r3', type: 'remaining_x', factor: 0.5, hours: 0, label: 'نصف الوقت المتبقي' }
      ]
    },
    users: [],
    employees: [],
    attendance: [],
    penalties: []
  };
}

/**
 * Returns raw cache copy.
 */
export function getDB() {
  if (!cache) {
    const local = localStorage.getItem(DB_KEY);
    if (local) {
      cache = JSON.parse(local);
    } else {
      cache = getFallbackSchema();
    }
  }
  return cache;
}

/**
 * Saves database state to localStorage and fires datachange event.
 * @param {object} data
 */
export function saveDB(data) {
  cache = data;
  cache.meta = cache.meta || {};
  cache.meta.updatedAt = new Date().toLocaleString();
  localStorage.setItem(DB_KEY, JSON.stringify(cache));
  window.dispatchEvent(new CustomEvent('dawam:datachange', { detail: { db: cache } }));
  return cache;
}

/**
 * List all items in a collection.
 * @param {'employees'|'attendance'|'penalties'|'users'} collection
 * @returns {Array}
 */
export function list(collection) {
  const db = getDB();
  return Array.isArray(db[collection]) ? [...db[collection]] : [];
}

/**
 * Gets a single item by id.
 * @param {'employees'|'attendance'|'penalties'|'users'} collection
 * @param {string} id
 * @returns {object|null}
 */
export function get(collection, id) {
  const items = list(collection);
  return items.find(item => item.id === id) || null;
}

/**
 * Inserts a new item into a collection.
 * @param {'employees'|'attendance'|'penalties'|'users'} collection
 * @param {object} item
 * @returns {object} inserted item with id
 */
export function insert(collection, item) {
  const db = getDB();
  if (!Array.isArray(db[collection])) {
    db[collection] = [];
  }
  const newItem = {
    ...item,
    id: item.id || `${collection.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  };
  db[collection].push(newItem);
  saveDB(db);
  return newItem;
}

/**
 * Updates an existing item in a collection.
 * @param {'employees'|'attendance'|'penalties'|'users'} collection
 * @param {string} id
 * @param {object} partial
 * @returns {object|null} updated item
 */
export function update(collection, id, partial) {
  const db = getDB();
  if (!Array.isArray(db[collection])) return null;
  const index = db[collection].findIndex(item => item.id === id);
  if (index === -1) return null;

  db[collection][index] = {
    ...db[collection][index],
    ...partial,
    id // keep original ID
  };
  saveDB(db);
  return db[collection][index];
}

/**
 * Removes an item from a collection.
 * @param {'employees'|'attendance'|'penalties'|'users'} collection
 * @param {string} id
 * @returns {boolean}
 */
export function remove(collection, id) {
  const db = getDB();
  if (!Array.isArray(db[collection])) return false;
  const prevLen = db[collection].length;
  db[collection] = db[collection].filter(item => item.id !== id);
  if (db[collection].length !== prevLen) {
    saveDB(db);
    return true;
  }
  return false;
}

/**
 * Gets system settings object.
 * @returns {object}
 */
export function getSettings() {
  const db = getDB();
  return { ...db.settings };
}

/**
 * Updates system settings.
 * @param {object} partialSettings
 * @returns {object}
 */
export function updateSettings(partialSettings) {
  const db = getDB();
  db.settings = {
    ...db.settings,
    ...partialSettings
  };
  saveDB(db);
  return db.settings;
}

/**
 * Exports entire database as a formatted JSON string.
 * @returns {string}
 */
export function exportJSON() {
  const db = getDB();
  return JSON.stringify(db, null, 2);
}

/**
 * Imports and validates a JSON string.
 * @param {string} jsonString
 * @returns {{ success: boolean, error?: string }}
 */
export function importJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON object' };
    }
    if (!data.settings || !Array.isArray(data.employees)) {
      return { success: false, error: 'Missing required database collections (settings, employees)' };
    }
    ensureSchema(data);
    saveDB(data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves GitHub sync token from localStorage.
 */
export function getGitHubToken() {
  return localStorage.getItem(GH_TOKEN_KEY) || '';
}

/**
 * Saves GitHub sync token to localStorage only.
 */
export function setGitHubToken(token) {
  if (token) {
    localStorage.setItem(GH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(GH_TOKEN_KEY);
  }
}

/**
 * Gets GitHub repository configuration.
 */
export function getGitHubConfig() {
  const raw = localStorage.getItem(GH_CONFIG_KEY);
  return raw ? JSON.parse(raw) : { owner: '', repo: '', path: 'data/db.json', branch: 'main' };
}

/**
 * Saves GitHub repository configuration.
 */
export function setGitHubConfig(config) {
  localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Syncs the current JSON database to a GitHub repository using the Contents API.
 * Token is retrieved strictly from localStorage.
 * @param {object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {string} params.path
 * @param {string} [params.branch='main']
 * @param {string} params.token
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function syncToGitHub({ owner, repo, path, branch = 'main', token }) {
  if (!owner || !repo || !path || !token) {
    return { success: false, message: 'Missing required GitHub parameters' };
  }

  const cleanPath = path.replace(/^\//, '');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`;

  try {
    // 1. Get file SHA if it exists
    let sha = null;
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      const errData = await getRes.json().catch(() => ({}));
      return { success: false, message: errData.message || `GitHub error: HTTP ${getRes.status}` };
    }

    // 2. Prepare UTF-8 Base64 content
    const content = exportJSON();
    const utf8Bytes = new TextEncoder().encode(content);
    let binary = '';
    utf8Bytes.forEach(b => { binary += String.fromCharCode(b); });
    const base64Content = btoa(binary);

    // 3. Put / commit file
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Sync Dawam DB ${new Date().toLocaleString()}`,
        content: base64Content,
        branch,
        ...(sha ? { sha } : {})
      })
    });

    if (!putRes.ok) {
      const putErr = await putRes.json().catch(() => ({}));
      return { success: false, message: putErr.message || `Commit error: HTTP ${putRes.status}` };
    }

    return { success: true, message: 'Sync completed successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
