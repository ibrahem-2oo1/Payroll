/**
 * Dawam - Daily Attendance Page Controller (Phase 0 shell)
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';

export function mount(container) {
  const employees = store.list('employees');
  const activeCount = employees.filter(e => e.active).length;

  container.innerHTML = `
    <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <h2 class="page-title text-cyan" data-i18n="attendance.title" style="font-size: 1.5rem;">${t('attendance.title')}</h2>
        <p class="text-muted" style="font-size: 0.875rem;">${t('app.subtitle')}</p>
      </div>
      <div class="badge badge-present font-num">
        ${activeCount} ${t('common.active')}
      </div>
    </div>

    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="attendance.searchPrompt">${t('attendance.searchPrompt')}</h3>
      </div>
      <div class="card-body">
        <div class="search-wrapper mb-3">
          <input type="text" class="input input-neon" placeholder="${t('common.search')}" data-i18n-attr="placeholder:common.search">
        </div>
        <p class="text-muted" style="font-size: 0.875rem;">شاشة تسجيل الحضور اليومي السريع للموظفين (ستكتمل في المرحلة 3).</p>
      </div>
    </div>
  `;

  return () => {};
}
