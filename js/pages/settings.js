/**
 * Dawam - Settings Page Controller (Phase 0 shell)
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';

export function mount(container) {
  const settings = store.getSettings();

  container.innerHTML = `
    <div class="page-header mb-3">
      <h2 class="page-title text-cyan" data-i18n="settings.title" style="font-size: 1.5rem;">${t('settings.title')}</h2>
      <p class="text-muted" style="font-size: 0.875rem;">لوائح العمل الرسمية، الإضافي، وقواعد التأخير (المرحلة 2).</p>
    </div>

    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.officialHours">${t('settings.officialHours')}</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
          <div>
            <label class="form-label" data-i18n="settings.shiftStart">${t('settings.shiftStart')}</label>
            <div class="font-num text-cyan" style="font-size: 1.25rem;">${settings.shiftStart}</div>
          </div>
          <div>
            <label class="form-label" data-i18n="settings.shiftEnd">${t('settings.shiftEnd')}</label>
            <div class="font-num text-cyan" style="font-size: 1.25rem;">${settings.shiftEnd}</div>
          </div>
          <div>
            <label class="form-label" data-i18n="settings.breakMinutes">${t('settings.breakMinutes')}</label>
            <div class="font-num text-cyan" style="font-size: 1.25rem;">${settings.breakMinutes} دقيقة</div>
          </div>
          <div>
            <label class="form-label" data-i18n="settings.graceMinutes">${t('settings.graceMinutes')}</label>
            <div class="font-num text-cyan" style="font-size: 1.25rem;">${settings.graceMinutes} دقيقة</div>
          </div>
        </div>
      </div>
    </div>
  `;

  return () => {};
}
