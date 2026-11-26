/**
 * Dawam - Date & Time Utilities
 * Pure functions for local date formatting, conversion and time math.
 * RULE: Local time only. NEVER use toISOString()!
 */

/**
 * Returns YYYY-MM-DD from a Date object or today's date in local time.
 * @param {Date|null} date
 * @returns {string} YYYY-MM-DD
 */
export function toLocalDate(date = null) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a standardized local timestamp "YYYY-MM-DD HH:mm:ss" using local getters.
 * Strictly avoids toISOString() or toLocaleString() for sortability and consistency.
 * @param {Date|null} [date=null]
 * @returns {string} "YYYY-MM-DD HH:mm:ss"
 */
export function nowLocalStamp(date = null) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

/**
 * Converts "HH:MM" (24h) to minutes from midnight.
 * @param {string} hhmm
 * @returns {number} minutes (0 to 1439)
 */
export function hhmmToMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Converts minutes to "HH:MM" format.
 * @param {number} totalMinutes
 * @returns {string} "HH:MM" or "-HH:MM"
 */
export function minToHHMM(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes === null) return '00:00';
  const isNegative = totalMinutes < 0;
  const absMin = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats minutes into "h:mm" format (e.g. "162:30", "0:00", "-2:30").
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatHoursMinutes(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes === null) return '0:00';
  const isNegative = totalMinutes < 0;
  const absMin = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(absMin / 60);
  const m = String(absMin % 60).padStart(2, '0');
  return `${isNegative ? '-' : ''}${h}:${m}`;
}

/**
 * Formats minutes into human-readable label e.g. "7 س 30 د" or "7h 30m".
 * @param {number} totalMinutes
 * @param {string} [lang='ar']
 * @returns {string}
 */
export function minToHoursLabel(totalMinutes, lang = 'ar') {
  if (totalMinutes === null || isNaN(totalMinutes)) return lang === 'ar' ? '0 د' : '0m';
  const isNegative = totalMinutes < 0;
  const absMin = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;

  const hUnit = lang === 'ar' ? 'س' : 'h';
  const mUnit = lang === 'ar' ? 'د' : 'm';

  let result = '';
  if (h > 0 && m > 0) {
    result = `${h} ${hUnit} ${m} ${mUnit}`;
  } else if (h > 0) {
    result = `${h} ${hUnit}`;
  } else {
    result = `${m} ${mUnit}`;
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Calculates start date, end date, and days in month for "YYYY-MM".
 * @param {string} yyyy_mm e.g. "2026-11"
 * @returns {{ start: string, end: string, daysInMonth: number, year: number, month: number }}
 */
export function monthRange(yyyy_mm) {
  if (!yyyy_mm) {
    const today = toLocalDate();
    yyyy_mm = today.slice(0, 7);
  }
  const [yearStr, monthStr] = yyyy_mm.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Last day of month using local date arithmetic
  const lastDate = new Date(year, month, 0).getDate();
  const start = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const end = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

  return {
    start,
    end,
    daysInMonth: lastDate,
    year,
    month
  };
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string.
 * @param {string} dateStr "YYYY-MM-DD"
 * @param {number} days
 * @returns {string} "YYYY-MM-DD"
 */
export function addDays(dateStr, days) {
  if (!dateStr) return toLocalDate();
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d + days);
  return toLocalDate(dateObj);
}

/**
 * Gets the localized weekday name for a YYYY-MM-DD date.
 * @param {string} dateStr "YYYY-MM-DD"
 * @param {string} [lang='ar']
 * @returns {string}
 */
export function getWeekdayName(dateStr, lang = 'ar') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  try {
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(dateObj);
  } catch {
    return '';
  }
}

export function formatDateDisplay(dateStr, lang = 'ar') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  try {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', options).format(dateObj);
  } catch {
    return dateStr;
  }
}
