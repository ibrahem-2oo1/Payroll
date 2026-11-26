/**
 * Dawam - Monthly Report Page Controller (Phase 0 shell)
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';

export function mount(container) {
  const employees = store.list('employees');

  container.innerHTML = `
    <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <h2 class="page-title text-cyan" data-i18n="report.title" style="font-size: 1.5rem;">${t('report.title')}</h2>
        <p class="text-muted" style="font-size: 0.875rem;">كشوفات الحضور وساعات العمل والرواتب والتصدير إلى Excel (المرحلة 5).</p>
      </div>
      <button class="btn btn-secondary" id="btn-export-excel" disabled>
        <span data-i18n="report.exportExcel">📊 ${t('report.exportExcel')}</span>
      </button>
    </div>

    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="report.totalSummary">${t('report.totalSummary')}</h3>
      </div>
      <div class="card-body">
        <p class="text-muted">${t('common.loading')} (${employees.length} ${t('common.employee')})</p>
      </div>
    </div>
  `;

  return () => {};
}
