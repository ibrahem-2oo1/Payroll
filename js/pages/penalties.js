/**
 * Dawam - Penalties Page Controller (Phase 0 shell)
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';

export function mount(container) {
  const penalties = store.list('penalties');

  container.innerHTML = `
    <div class="page-header mb-3">
      <h2 class="page-title text-cyan" data-i18n="penalties.title" style="font-size: 1.5rem;">${t('penalties.title')}</h2>
      <p class="text-muted" style="font-size: 0.875rem;">إدارة وتسجيل الجزاءات الإدارية المخصومة (المرحلة 4).</p>
    </div>

    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="penalties.addPenalty">${t('penalties.addPenalty')}</h3>
      </div>
      <div class="card-body">
        <p class="text-muted">${t('common.noData')} (${penalties.length})</p>
      </div>
    </div>
  `;

  return () => {};
}
