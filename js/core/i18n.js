/**
 * Dawam - Internationalization (i18n)
 * Supports Arabic (RTL default) and English (LTR).
 * Persists selection in localStorage ('dawam_lang').
 */

let currentLang = 'ar';
const translations = {
  ar: null,
  en: null
};

/**
 * Initializes translations by loading ar.json and en.json.
 * @returns {Promise<string>} current language
 */
export async function initI18n() {
  const saved = localStorage.getItem('dawam_lang');
  currentLang = saved === 'en' ? 'en' : 'ar';

  try {
    const [arRes, enRes] = await Promise.all([
      fetch('./locales/ar.json'),
      fetch('./locales/en.json')
    ]);
    translations.ar = await arRes.json();
    translations.en = await enRes.json();
  } catch (err) {
    console.error('Failed to load locale files:', err);
  }

  applyHtmlLangDir(currentLang);
  return currentLang;
}

/**
 * Gets currently active language ('ar' or 'en').
 */
export function getLang() {
  return currentLang;
}

/**
 * Translates a dot-notated key.
 * @param {string} key e.g. "nav.attendance"
 * @param {object} [params]
 * @returns {string}
 */
export function t(key, params = null) {
  const dict = translations[currentLang] || translations.ar || {};
  const fallbackDict = translations.en || {};

  let val = resolveKey(dict, key) ?? resolveKey(fallbackDict, key) ?? key;

  if (params && typeof val === 'string') {
    Object.keys(params).forEach(k => {
      val = val.replace(new RegExp(`{${k}}`, 'g'), params[k]);
    });
  }
  return val;
}

function resolveKey(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  const parts = key.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  return cur;
}

/**
 * Changes language, saves to localStorage, updates document lang/dir,
 * translates marked DOM elements, and emits event.
 * @param {string} lang 'ar' or 'en'
 */
export function setLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'ar';
  localStorage.setItem('dawam_lang', currentLang);
  applyHtmlLangDir(currentLang);
  translateDOM();
  window.dispatchEvent(new CustomEvent('dawam:langchange', { detail: { lang: currentLang } }));
}

/**
 * Toggles between 'ar' and 'en'.
 */
export function toggleLang() {
  setLang(currentLang === 'ar' ? 'en' : 'ar');
}

/**
 * Sets document.documentElement lang and dir.
 */
function applyHtmlLangDir(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Translates all DOM elements containing [data-i18n] or [data-i18n-attr].
 * @param {HTMLElement|Document} [root=document]
 */
export function translateDOM(root = document) {
  // Translate text content
  const elements = root.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Translate attributes like placeholder, title, aria-label
  const attrElements = root.querySelectorAll('[data-i18n-attr]');
  attrElements.forEach(el => {
    const raw = el.getAttribute('data-i18n-attr');
    // format: "placeholder:common.search,title:common.edit"
    raw.split(',').forEach(pair => {
      const [attr, key] = pair.split(':');
      if (attr && key) {
        el.setAttribute(attr.trim(), t(key.trim()));
      }
    });
  });
}
