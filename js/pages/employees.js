/**
 * Dawam - Employees Page Controller (Phase 0 shell)
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';

export function mount(container) {
  const employees = store.list('employees');

  container.innerHTML = `
    <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <h2 class="page-title text-cyan" data-i18n="employees.title" style="font-size: 1.5rem;">${t('employees.title')}</h2>
        <p class="text-muted" style="font-size: 0.875rem;">إدارة بيانات الموظفين والأقسام والأجور (المرحلة 1).</p>
      </div>
      <button class="btn btn-primary" id="btn-add-employee">
        <span data-i18n="employees.addEmployee">+ ${t('employees.addEmployee')}</span>
      </button>
    </div>

    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan">قائمة الموظفين المسجلين (${employees.length})</h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th data-i18n="common.badge">${t('common.badge')}</th>
                <th data-i18n="common.employee">${t('common.employee')}</th>
                <th data-i18n="common.department">${t('common.department')}</th>
                <th data-i18n="common.hourlyRate">${t('common.hourlyRate')}</th>
                <th data-i18n="common.status">${t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              ${employees.map(emp => `
                <tr>
                  <td class="font-num text-cyan">${emp.badge}</td>
                  <td><strong>${emp.name}</strong></td>
                  <td class="text-secondary">${emp.department || '-'}</td>
                  <td class="font-num">${emp.rate ? `${emp.rate} ${t('common.currency')}` : '-'}</td>
                  <td>
                    <span class="badge ${emp.active ? 'badge-present' : 'badge-absent'}">
                      ${emp.active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return () => {};
}
