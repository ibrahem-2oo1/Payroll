/**
 * Dawam - Reusable Date Bar Component
 * Provides date stepper (◀, ▶, Today), date input, weekday name, and future date warning.
 * Reusable across Attendance (Phase 3) and Penalties (Phase 4).
 */

import { t, getLang } from './i18n.js';
import { toLocalDate, addDays, getWeekdayName } from './dates.js';

/**
 * Creates and mounts a DateBar component into the container element.
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} [options.date] - Initial date (YYYY-MM-DD, defaults to today)
 * @param {(newDate: string) => void} [options.onChange]
 * @returns {object} API: { getDate, setDate, destroy }
 */
export function createDateBar(container, options = {}) {
  let currentDate = options.date || toLocalDate();
  const onChange = options.onChange || (() => {});

  function render() {
    const lang = getLang();
    const today = toLocalDate();
    const isFuture = currentDate > today;
    const weekday = getWeekdayName(currentDate, lang);

    container.innerHTML = `
      <div class="date-bar">
        <div class="date-stepper">
          <button type="button" class="btn btn-secondary btn-sm btn-date-prev" id="btn-date-prev" title="${t('common.prev')}">
            ◀
          </button>
          <input type="date" class="input font-num input-date-picker" id="input-attendance-date" value="${currentDate}" style="max-width: 155px; height: 38px;">
          <button type="button" class="btn btn-secondary btn-sm btn-date-next" id="btn-date-next" title="${t('common.next')}">
            ▶
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-date-today" id="btn-date-today" style="font-size: 0.8rem;">
            ${t('common.today')}
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="text-cyan font-bold weekday-display" id="weekday-display" style="font-size: 1rem;">
            📅 ${weekday}
          </span>
          ${isFuture ? `<span class="badge badge-late font-num future-date-badge" id="future-date-badge" style="font-size: 0.75rem;">⚠️ ${t('attendance.futureDateWarning')}</span>` : ''}
        </div>
      </div>
    `;

    container.querySelector('.btn-date-prev')?.addEventListener('click', () => {
      setDate(addDays(currentDate, -1));
    });

    container.querySelector('.btn-date-next')?.addEventListener('click', () => {
      setDate(addDays(currentDate, 1));
    });

    container.querySelector('.btn-date-today')?.addEventListener('click', () => {
      setDate(toLocalDate());
    });

    container.querySelector('.input-date-picker')?.addEventListener('change', (e) => {
      setDate(e.target.value || toLocalDate());
    });
  }

  function setDate(newDate, triggerChange = true) {
    if (!newDate) newDate = toLocalDate();
    if (newDate === currentDate && !triggerChange) return;
    currentDate = newDate;
    render();
    if (triggerChange) {
      onChange(currentDate);
    }
  }

  function getDate() {
    return currentDate;
  }

  function destroy() {
    container.innerHTML = '';
  }

  render();

  return {
    getDate,
    setDate,
    destroy
  };
}
