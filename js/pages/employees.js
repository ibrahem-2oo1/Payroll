/**
 * Dawam - Employees Management Controller
 * Responsive card view on mobile (< 768px), table view on desktop (≥ 768px).
 * Search by name or badge, filter by active/all/inactive.
 * Add/edit in modal, unique badge validation against all employees, IQD hourly rate.
 * Deactivate (with confirmation) instead of delete.
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ui from '../core/ui.js';

let currentContainer = null;
let searchQuery = '';
let filterStatus = 'active'; // 'active' | 'all' | 'inactive'

export function mount(container) {
  currentContainer = container;
  searchQuery = '';
  filterStatus = 'active';

  container.innerHTML = `
    <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h2 class="page-title text-cyan" data-i18n="employees.title" style="font-size: 1.5rem;">${t('employees.title')}</h2>
        <div id="emp-count-badges" style="display: flex; gap: 0.5rem; margin-top: 0.25rem;"></div>
      </div>
      <button class="btn btn-primary" id="btn-add-employee">
        <span data-i18n="employees.addEmployee">+ ${t('employees.addEmployee')}</span>
      </button>
    </div>

    <!-- Search & Filter Controls -->
    <div class="card card-neon mb-3">
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="search-wrapper">
          <input 
            type="search" 
            id="emp-search-input" 
            class="input input-neon" 
            placeholder="${t('common.search')}" 
            autocomplete="off"
          >
        </div>

        <div class="segmented-control" role="tablist" id="emp-filter-tabs">
        </div>
      </div>
    </div>

    <!-- Dynamic Results Container -->
    <div id="emp-results-container"></div>
  `;

  // Attach search listener once
  const searchInput = container.querySelector('#emp-search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    updateResults();
  });

  // Attach add employee button once
  container.querySelector('#btn-add-employee')?.addEventListener('click', () => {
    openEmployeeModal();
  });

  updateResults();

  const handleDataChange = () => {
    if (document.body.contains(currentContainer)) {
      updateResults();
    }
  };

  window.addEventListener('dawam:datachange', handleDataChange);
  return () => {
    window.removeEventListener('dawam:datachange', handleDataChange);
  };
}

function formatRate(rate) {
  if (rate === null || rate === undefined || rate === '' || isNaN(rate)) {
    return '-';
  }
  return `${Number(rate).toLocaleString('en-US')} ${t('common.currency')}`;
}

function updateResults() {
  if (!currentContainer) return;

  const allEmployees = store.list('employees');
  const activeCount = allEmployees.filter(e => e.active).length;
  const inactiveCount = allEmployees.filter(e => !e.active).length;

  // 1. Update Header Badges
  const badgesContainer = currentContainer.querySelector('#emp-count-badges');
  if (badgesContainer) {
    badgesContainer.innerHTML = `
      <span class="badge badge-present font-num">${activeCount} ${t('common.active')}</span>
      ${inactiveCount > 0 ? `<span class="badge badge-absent font-num">${inactiveCount} ${t('common.inactive')}</span>` : ''}
    `;
  }

  // 2. Update Filter Tabs
  const tabsContainer = currentContainer.querySelector('#emp-filter-tabs');
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <button 
        type="button" 
        class="segmented-btn ${filterStatus === 'active' ? 'active' : ''}" 
        data-filter="active"
        role="tab"
        aria-selected="${filterStatus === 'active'}"
      >
        ${t('employees.filterActive')} (${activeCount})
      </button>
      <button 
        type="button" 
        class="segmented-btn ${filterStatus === 'all' ? 'active' : ''}" 
        data-filter="all"
        role="tab"
        aria-selected="${filterStatus === 'all'}"
      >
        ${t('employees.filterAll')} (${allEmployees.length})
      </button>
      <button 
        type="button" 
        class="segmented-btn ${filterStatus === 'inactive' ? 'active' : ''}" 
        data-filter="inactive"
        role="tab"
        aria-selected="${filterStatus === 'inactive'}"
      >
        ${t('employees.filterInactive')} (${inactiveCount})
      </button>
    `;

    tabsContainer.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filterStatus = btn.getAttribute('data-filter');
        updateResults();
      });
    });
  }

  // 3. Filter employees by status & query
  let filtered = allEmployees;
  if (filterStatus === 'active') {
    filtered = filtered.filter(e => e.active);
  } else if (filterStatus === 'inactive') {
    filtered = filtered.filter(e => !e.active);
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(e => {
      const nameMatch = (e.name || '').toLowerCase().includes(q);
      const badgeMatch = (e.badge || '').toLowerCase().includes(q);
      return nameMatch || badgeMatch;
    });
  }

  // 4. Render Table / Cards into Results Container
  const resultsContainer = currentContainer.querySelector('#emp-results-container');
  if (!resultsContainer) return;

  if (filtered.length === 0) {
    resultsContainer.innerHTML = `
      <div class="card text-center" style="padding: 2.5rem 1rem;">
        <p class="text-muted" style="margin-bottom: 0;">${t('employees.noEmployees')}</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <!-- Desktop Table View (≥ 768px) -->
    <div class="employees-desktop-view table-container card-neon">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 110px;">${t('common.badge')}</th>
            <th>${t('common.employee')}</th>
            <th>${t('common.department')}</th>
            <th>${t('common.hourlyRate')}</th>
            <th style="width: 100px;">${t('common.status')}</th>
            <th style="width: 160px; text-align: center;">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(emp => `
            <tr data-emp-id="${emp.id}">
              <td class="font-num text-cyan" style="font-weight: 700;">${escapeHtml(emp.badge)}</td>
              <td><strong>${escapeHtml(emp.name)}</strong></td>
              <td class="text-secondary">${escapeHtml(emp.department || '-')}</td>
              <td class="font-num">${formatRate(emp.rate)}</td>
              <td>
                <span class="badge ${emp.active ? 'badge-present' : 'badge-absent'}">
                  ${emp.active ? t('common.active') : t('common.inactive')}
                </span>
              </td>
              <td style="text-align: center;">
                <button type="button" class="btn btn-secondary btn-sm btn-edit" data-id="${emp.id}" title="${t('common.edit')}">
                  ✏️ ${t('common.edit')}
                </button>
                ${emp.active ? `
                  <button type="button" class="btn btn-danger btn-sm btn-deactivate" data-id="${emp.id}" title="${t('employees.deactivate')}">
                    ⛔ ${t('employees.deactivate')}
                  </button>
                ` : `
                  <button type="button" class="btn btn-success btn-sm btn-activate" data-id="${emp.id}" title="${t('employees.activate')}">
                    ✅ ${t('employees.activate')}
                  </button>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View (< 768px) -->
    <div class="employees-mobile-view employee-card-list">
      ${filtered.map(emp => `
        <div class="card employee-card card-neon" data-emp-id="${emp.id}">
          <div class="employee-card-header">
            <div>
              <span class="font-num text-cyan" style="font-weight: 700; font-size: 0.95rem;">#${escapeHtml(emp.badge)}</span>
              <h3 style="font-size: 1.1rem; margin: 0.15rem 0 0.25rem 0;">${escapeHtml(emp.name)}</h3>
              <span class="text-secondary" style="font-size: 0.85rem;">${escapeHtml(emp.department || '-')}</span>
            </div>
            <span class="badge ${emp.active ? 'badge-present' : 'badge-absent'}">
              ${emp.active ? t('common.active') : t('common.inactive')}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
            <small class="text-muted">${t('common.hourlyRate')}:</small>
            <span class="font-num text-cyan" style="font-weight: 700;">${formatRate(emp.rate)}</span>
          </div>

          <div class="employee-card-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-edit" data-id="${emp.id}" style="flex: 1;">
              ✏️ ${t('common.edit')}
            </button>
            ${emp.active ? `
              <button type="button" class="btn btn-danger btn-sm btn-deactivate" data-id="${emp.id}" style="flex: 1;">
                ⛔ ${t('employees.deactivate')}
              </button>
            ` : `
              <button type="button" class="btn btn-success btn-sm btn-activate" data-id="${emp.id}" style="flex: 1;">
                ✅ ${t('employees.activate')}
              </button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  attachActionListeners(resultsContainer);
}

function attachActionListeners(container) {
  // Edit buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const emp = store.get('employees', id);
      if (emp) openEmployeeModal(emp);
    });
  });

  // Deactivate buttons
  container.querySelectorAll('.btn-deactivate').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const emp = store.get('employees', id);
      if (!emp) return;

      const confirmed = await ui.confirm({
        title: t('employees.deactivate'),
        message: `${t('employees.deactivateConfirm')}\n(${emp.name} - #${emp.badge})`,
        confirmText: t('employees.deactivate'),
        cancelText: t('common.cancel'),
        danger: true
      });

      if (confirmed) {
        store.update('employees', id, { active: false });
        ui.toast(t('employees.deactivated'), 'info');
        updateResults();
      }
    });
  });

  // Activate buttons
  container.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const emp = store.get('employees', id);
      if (!emp) return;

      const confirmed = await ui.confirm({
        title: t('employees.activate'),
        message: `${t('employees.activateConfirm')}\n(${emp.name} - #${emp.badge})`,
        confirmText: t('employees.activate'),
        cancelText: t('common.cancel')
      });

      if (confirmed) {
        store.update('employees', id, { active: true });
        ui.toast(t('employees.activated'), 'success');
        updateResults();
      }
    });
  });
}

function openEmployeeModal(employeeToEdit = null) {
  const isEdit = !!employeeToEdit;

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="employee-form" novalidate>
      <div class="form-group mb-3">
        <label class="form-label">${t('employees.name')} *</label>
        <input 
          type="text" 
          id="modal-emp-name" 
          class="input" 
          value="${escapeHtml(employeeToEdit?.name || '')}" 
          required 
          autocomplete="off"
          autofocus
        >
      </div>

      <div class="form-group mb-3">
        <label class="form-label">${t('employees.badge')} *</label>
        <input 
          type="text" 
          id="modal-emp-badge" 
          class="input font-num" 
          value="${escapeHtml(employeeToEdit?.badge || '')}" 
          required 
          autocomplete="off"
        >
        <small class="text-muted">الرقم الوظيفي فريد لكافة الموظفين (النشطين والمعطلين).</small>
      </div>

      <div class="form-group mb-3">
        <label class="form-label">${t('common.department')}</label>
        <input 
          type="text" 
          id="modal-emp-dept" 
          class="input" 
          value="${escapeHtml(employeeToEdit?.department || '')}" 
          autocomplete="off"
        >
      </div>

      <div class="form-group mb-3">
        <label class="form-label">${t('common.hourlyRate')} (${t('common.currency')})</label>
        <input 
          type="number" 
          id="modal-emp-rate" 
          class="input font-num" 
          step="any" 
          min="0" 
          placeholder="${t('employees.ratePlaceholder')}" 
          value="${employeeToEdit?.rate ?? ''}"
        >
        <small class="text-muted">بالدينار العراقي (IQD). اختياري، يُستخدم لحساب الرواتب التقديرية.</small>
      </div>

      <div id="modal-emp-error" class="text-error mb-2" style="display: none;"></div>
    </form>
  `;

  const modalInstance = ui.modal({
    title: isEdit ? t('employees.editEmployee') : t('employees.addEmployee'),
    content,
    buttons: [
      {
        label: t('common.cancel'),
        class: 'btn-secondary',
        onClick: () => modalInstance.close()
      },
      {
        label: t('common.save'),
        class: 'btn-primary',
        onClick: () => {
          const nameInput = content.querySelector('#modal-emp-name');
          const badgeInput = content.querySelector('#modal-emp-badge');
          const deptInput = content.querySelector('#modal-emp-dept');
          const rateInput = content.querySelector('#modal-emp-rate');
          const errEl = content.querySelector('#modal-emp-error');

          errEl.style.display = 'none';

          const name = nameInput.value.trim();
          const badge = badgeInput.value.trim();
          const department = deptInput.value.trim();
          const rawRate = rateInput.value.trim();

          // 1. Validate Name
          if (!name) {
            errEl.textContent = t('employees.nameRequired');
            errEl.style.display = 'block';
            nameInput.focus();
            return;
          }

          // 2. Validate Badge Number (required & unique against ALL employees)
          if (!badge) {
            errEl.textContent = t('employees.badgeRequired');
            errEl.style.display = 'block';
            badgeInput.focus();
            return;
          }

          const allEmployees = store.list('employees');
          const isDuplicate = allEmployees.some(e => {
            const sameBadge = (e.badge || '').trim().toLowerCase() === badge.toLowerCase();
            const isDifferentRecord = !isEdit || e.id !== employeeToEdit.id;
            return sameBadge && isDifferentRecord;
          });

          if (isDuplicate) {
            errEl.textContent = t('employees.badgeExists');
            errEl.style.display = 'block';
            badgeInput.focus();
            return;
          }

          // 3. Validate Rate (step="any", min 0)
          let rate = null;
          if (rawRate !== '') {
            const parsedRate = parseFloat(rawRate);
            if (isNaN(parsedRate) || parsedRate < 0) {
              errEl.textContent = 'الأجر بالساعة يجب أن يكون رقماً موجباً';
              errEl.style.display = 'block';
              rateInput.focus();
              return;
            }
            rate = parsedRate;
          }

          // 4. Save to Store
          if (isEdit) {
            store.update('employees', employeeToEdit.id, {
              name,
              badge,
              department,
              rate
            });
            ui.toast(t('toast.saved'), 'success');
          } else {
            store.insert('employees', {
              name,
              badge,
              department,
              rate,
              active: true
            });
            ui.toast(t('toast.saved'), 'success');
          }

          modalInstance.close();
          updateResults();
        }
      }
    ]
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
