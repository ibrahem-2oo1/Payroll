/**
 * Dawam - Penalties Page Controller (Phase 4)
 * - Reusable employee search component (active employees only)
 * - Reusable date bar component
 * - Penalty days field (step 0.5, > 0, max 30) with live deducted hours line:
 *   "= X h Y m deducted" from settings.penaltyDayHours
 * - Multi-penalty warning on the same date before saving
 * - Monthly list with month picker & employee search filter
 * - Totals summary row: Total records count, total penalty days, total deducted hours
 * - Responsive: Table on desktop, Cards on mobile (<768px)
 * - Edit modal for admin & entry role
 * - Delete with confirmation for admin only (hidden for entry role)
 * - Audit fields: createdBy, createdAt, updatedBy, updatedAt using nowLocalStamp()
 * - Auto-switch list month if saved penalty is in a different month
 */

import { t, getLang } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import * as ui from '../core/ui.js';
import { toLocalDate, nowLocalStamp, minToHoursLabel } from '../core/dates.js';
import { createEmployeeSearch } from '../core/employee-search.js';
import { createDateBar } from '../core/date-bar.js';

let currentContainer = null;
let employeeSearchInstance = null;
let dateBarInstance = null;

// Page State
let selectedDate = toLocalDate();
let selectedMonth = toLocalDate().slice(0, 7);
let selectedEmployee = null;
let penaltyDays = 1.0;
let penaltyReason = '';
let searchFilter = '';

export function mount(container) {
  currentContainer = container;
  selectedDate = toLocalDate();
  selectedMonth = toLocalDate().slice(0, 7);
  selectedEmployee = null;
  penaltyDays = 1.0;
  penaltyReason = '';
  searchFilter = '';

  render();

  const handleDataChange = () => {
    if (document.body.contains(currentContainer)) {
      renderPenaltiesList();
    }
  };

  window.addEventListener('dawam:datachange', handleDataChange);

  return () => {
    window.removeEventListener('dawam:datachange', handleDataChange);
    if (employeeSearchInstance) {
      employeeSearchInstance.destroy();
      employeeSearchInstance = null;
    }
    if (dateBarInstance) {
      dateBarInstance.destroy();
      dateBarInstance = null;
    }
  };
}

function render() {
  if (!currentContainer) return;

  const currentSession = auth.getSession();
  const settings = store.getSettings();
  const penaltyHoursPerDay = Number(settings.penaltyDayHours ?? 4);

  currentContainer.innerHTML = `
    <div class="page-header mb-3">
      <h2 class="page-title text-cyan" data-i18n="penalties.title" style="font-size: 1.5rem;">⚖️ ${t('penalties.title')}</h2>
      <p class="text-muted" style="font-size: 0.875rem;">تسجيل وإدارة الجزاءات الإدارية والخصومات المعتمدة للشهر</p>
    </div>

    <div class="penalties-grid">
      <!-- Left Column: Add Penalty Form -->
      <div class="penalties-form-col">
        <div class="card card-neon mb-3">
          <div class="card-header">
            <h3 class="card-title text-cyan" data-i18n="penalties.addPenalty">➕ ${t('penalties.addPenalty')}</h3>
          </div>

          <div class="card-body">
            <!-- 1. Employee Search Mount -->
            <div class="form-group mb-3">
              <label class="form-label">${t('common.employee')} *</label>
              <div id="penalty-employee-search-mount"></div>
            </div>

            <!-- 2. Reusable Date Bar Mount -->
            <div class="form-group mb-3">
              <label class="form-label">${t('common.date')} *</label>
              <div id="penalty-date-bar-mount"></div>
            </div>

            <!-- 3. Penalty Days Input -->
            <div class="form-group mb-2">
              <label class="form-label" for="input-penalty-days">${t('penalties.penaltyDays')} *</label>
              <input 
                type="number" 
                id="input-penalty-days" 
                class="input input-time-lg font-num" 
                step="0.5" 
                min="0.5" 
                max="30" 
                value="${penaltyDays}"
              >
              <small class="text-muted">${t('penalties.daysStepNotice')}</small>
            </div>

            <!-- Live Deducted Hours Line -->
            <div class="p-2 mb-3" style="background: rgba(255, 59, 92, 0.08); border-radius: var(--radius-sm); border: 1px solid rgba(255, 59, 92, 0.25);">
              <span class="text-muted" style="font-size: 0.85rem;">${t('penalties.deductedHours')}:</span>
              <strong class="text-red font-num" id="live-deduction-text" style="font-size: 1.05rem; margin-inline-start: 0.35rem;">
                ${getLiveDeductionLabel(penaltyDays, penaltyHoursPerDay)}
              </strong>
            </div>

            <!-- 4. Reason Input -->
            <div class="form-group mb-3">
              <label class="form-label" for="input-penalty-reason">${t('penalties.reason')}</label>
              <input 
                type="text" 
                id="input-penalty-reason" 
                class="input" 
                placeholder="سبب الجزاء أو رقم القرار الإداري..."
                value="${escapeHtml(penaltyReason)}"
              >
            </div>

            <button type="button" class="btn btn-danger" id="btn-submit-penalty" style="width: 100%;">
              💾 ${t('penalties.addPenalty')}
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Monthly Penalties List -->
      <div class="penalties-list-col">
        <div class="card card-neon">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h3 class="card-title text-cyan" data-i18n="penalties.history">📜 ${t('penalties.history')}</h3>
            </div>

            <!-- Month Stepper Bar -->
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-month-prev" title="${t('common.prev')}">
                ◀
              </button>
              <input type="month" class="input font-num" id="input-penalties-month" value="${selectedMonth}" style="height: 36px; max-width: 145px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-month-next" title="${t('common.next')}">
                ▶
              </button>
            </div>
          </div>

          <div class="card-body">
            <!-- Filter by employee -->
            <div class="search-wrapper mb-3">
              <input 
                type="text" 
                class="input" 
                id="input-filter-employee" 
                placeholder="${t('penalties.filterEmployee')}"
                value="${escapeHtml(searchFilter)}"
              >
            </div>

            <!-- Totals Summary Bar -->
            <div class="penalties-summary-bar" id="penalties-summary-mount">
              ${renderSummaryBar()}
            </div>

            <!-- Table & Card List Mount -->
            <div id="penalties-list-mount">
              ${renderPenaltiesTable(currentSession)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initEmployeeSearch();
  initDateBar();
  attachFormListeners();
  attachListListeners(currentSession);
}

function initEmployeeSearch() {
  const mountEl = currentContainer?.querySelector('#penalty-employee-search-mount');
  if (!mountEl) return;

  if (employeeSearchInstance) {
    employeeSearchInstance.destroy();
  }

  employeeSearchInstance = createEmployeeSearch(mountEl, {
    placeholder: t('common.search'),
    filterActiveOnly: true,
    onSelect: (emp) => {
      selectedEmployee = emp;
    },
    onClear: () => {
      selectedEmployee = null;
    }
  });

  if (selectedEmployee) {
    employeeSearchInstance.setEmployee(selectedEmployee);
  }
}

function initDateBar() {
  const mountEl = currentContainer?.querySelector('#penalty-date-bar-mount');
  if (!mountEl) return;

  if (dateBarInstance) {
    dateBarInstance.destroy();
  }

  dateBarInstance = createDateBar(mountEl, {
    date: selectedDate,
    onChange: (newDate) => {
      selectedDate = newDate;
    }
  });
}

function getLiveDeductionLabel(days, hoursPerDay) {
  const lang = getLang();
  const totalMin = Math.round(Number(days || 0) * Number(hoursPerDay || 4) * 60);
  return minToHoursLabel(totalMin, lang);
}

function updateLiveDeductionText() {
  const settings = store.getSettings();
  const hoursPerDay = Number(settings.penaltyDayHours ?? 4);
  const textEl = currentContainer?.querySelector('#live-deduction-text');
  if (textEl) {
    textEl.textContent = getLiveDeductionLabel(penaltyDays, hoursPerDay);
  }
}

function getFilteredPenalties() {
  const allPenalties = store.list('penalties');
  const allEmployees = store.list('employees');

  return allPenalties.filter(p => {
    if (!p.date || !p.date.startsWith(selectedMonth)) return false;

    if (searchFilter) {
      const q = searchFilter.toLowerCase().trim();
      const emp = allEmployees.find(e => e.id === p.employeeId);
      const nameMatch = emp?.name?.toLowerCase().includes(q);
      const badgeMatch = emp?.badge && String(emp.badge).toLowerCase().includes(q);
      const reasonMatch = p.reason && p.reason.toLowerCase().includes(q);
      return nameMatch || badgeMatch || reasonMatch;
    }

    return true;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderSummaryBar() {
  const list = getFilteredPenalties();
  const settings = store.getSettings();
  const hoursPerDay = Number(settings.penaltyDayHours ?? 4);
  const lang = getLang();

  const totalDays = list.reduce((sum, p) => sum + (Number(p.days) || 0), 0);
  const totalMinutes = Math.round(totalDays * hoursPerDay * 60);

  return `
    <div class="stat-box">
      <div class="stat-box-title">${t('penalties.totalRecords')}</div>
      <div class="stat-box-val text-cyan font-num">${list.length}</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-title">${t('penalties.totalDays')}</div>
      <div class="stat-box-val text-amber font-num">${totalDays} ${t('common.unitH') === 'س' ? 'يوم' : 'days'}</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-title">${t('penalties.totalDeductedHours')}</div>
      <div class="stat-box-val text-red font-num">${minToHoursLabel(totalMinutes, lang)}</div>
    </div>
  `;
}

function renderPenaltiesTable(currentSession) {
  const list = getFilteredPenalties();
  const allEmployees = store.list('employees');
  const allUsers = store.list('users');
  const settings = store.getSettings();
  const hoursPerDay = Number(settings.penaltyDayHours ?? 4);
  const lang = getLang();
  const isAdmin = currentSession?.role === 'admin';

  if (list.length === 0) {
    return `
      <div class="text-center p-4 text-muted">
        ${t('common.noData')} (${selectedMonth})
      </div>
    `;
  }

  const getUserName = (userId) => {
    if (!userId) return '—';
    const u = allUsers.find(user => user.id === userId || user.username === userId);
    return u?.username || userId;
  };

  return `
    <!-- Desktop Table View (>= 768px) -->
    <div class="penalties-desktop-view table-container">
      <table class="table">
        <thead>
          <tr>
            <th>${t('common.date')}</th>
            <th>${t('common.employee')}</th>
            <th>${t('penalties.penaltyDays')}</th>
            <th>${t('penalties.deductedHours')}</th>
            <th>${t('penalties.reason')}</th>
            <th>${t('penalties.addedBy')}</th>
            <th style="text-align: center;">${t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => {
            const emp = allEmployees.find(e => e.id === p.employeeId);
            const empName = emp ? emp.name : '—';
            const empBadge = emp ? emp.badge : '';
            const minDeducted = Math.round((Number(p.days) || 0) * hoursPerDay * 60);

            return `
              <tr data-penalty-id="${p.id}">
                <td class="font-num">${p.date}</td>
                <td>
                  <strong>${escapeHtml(empName)}</strong>
                  <span class="badge badge-leave font-num" style="margin-inline-start: 0.35rem; font-size: 0.72rem;">#${escapeHtml(empBadge)}</span>
                </td>
                <td class="font-num text-amber">
                  ${p.days} ${lang === 'ar' ? 'يوم' : 'day(s)'}
                </td>
                <td class="font-num text-red">
                  ${minToHoursLabel(minDeducted, lang)}
                </td>
                <td class="text-secondary" style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(p.reason || '—')}
                </td>
                <td class="text-muted" style="font-size: 0.8rem;">
                  ${escapeHtml(getUserName(p.createdBy))}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                  <button type="button" class="btn btn-secondary btn-sm btn-edit-penalty" data-id="${p.id}" title="${t('common.edit')}">
                    ✏️ ${t('common.edit')}
                  </button>
                  ${isAdmin ? `
                    <button type="button" class="btn btn-danger btn-sm btn-delete-penalty" data-id="${p.id}" title="${t('common.delete')}">
                      🗑️ ${t('common.delete')}
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View (< 768px) -->
    <div class="penalties-mobile-view">
      ${list.map(p => {
        const emp = allEmployees.find(e => e.id === p.employeeId);
        const empName = emp ? emp.name : '—';
        const empBadge = emp ? emp.badge : '';
        const minDeducted = Math.round((Number(p.days) || 0) * hoursPerDay * 60);

        return `
          <div class="penalty-card-mobile" data-penalty-id="${p.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <strong class="text-cyan">${escapeHtml(empName)}</strong>
                <span class="badge badge-leave font-num" style="margin-inline-start: 0.35rem;">#${escapeHtml(empBadge)}</span>
              </div>
              <span class="font-num text-muted" style="font-size: 0.85rem;">${p.date}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="badge badge-late font-num">${p.days} ${lang === 'ar' ? 'يوم' : 'days'}</span>
              <span class="badge badge-absent font-num">${minToHoursLabel(minDeducted, lang)}</span>
            </div>

            ${p.reason ? `
              <div class="text-muted mb-2" style="font-size: 0.85rem;">
                💬 ${escapeHtml(p.reason)}
              </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-muted); padding-top: 0.5rem;">
              <small class="text-muted">
                ${t('penalties.addedBy')}: ${escapeHtml(getUserName(p.createdBy))}
              </small>

              <div style="display: flex; gap: 0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm btn-edit-penalty" data-id="${p.id}">
                  ✏️ ${t('common.edit')}
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger btn-sm btn-delete-penalty" data-id="${p.id}">
                    🗑️ ${t('common.delete')}
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPenaltiesList() {
  const summaryEl = currentContainer?.querySelector('#penalties-summary-mount');
  if (summaryEl) {
    summaryEl.innerHTML = renderSummaryBar();
  }

  const listEl = currentContainer?.querySelector('#penalties-list-mount');
  if (listEl) {
    const currentSession = auth.getSession();
    listEl.innerHTML = renderPenaltiesTable(currentSession);
    attachListListeners(currentSession);
  }
}

function attachFormListeners() {
  if (!currentContainer) return;

  const daysInput = currentContainer.querySelector('#input-penalty-days');
  daysInput?.addEventListener('input', (e) => {
    penaltyDays = parseFloat(e.target.value) || 0;
    updateLiveDeductionText();
  });

  const reasonInput = currentContainer.querySelector('#input-penalty-reason');
  reasonInput?.addEventListener('input', (e) => {
    penaltyReason = e.target.value;
  });

  currentContainer.querySelector('#btn-submit-penalty')?.addEventListener('click', handleAddPenalty);
}

function attachListListeners(currentSession) {
  if (!currentContainer) return;

  // Month Stepper Prev
  currentContainer.querySelector('#btn-month-prev')?.addEventListener('click', () => {
    selectedMonth = stepMonth(selectedMonth, -1);
    updateMonthInput();
    renderPenaltiesList();
  });

  // Month Stepper Next
  currentContainer.querySelector('#btn-month-next')?.addEventListener('click', () => {
    selectedMonth = stepMonth(selectedMonth, 1);
    updateMonthInput();
    renderPenaltiesList();
  });

  // Month Input Change
  currentContainer.querySelector('#input-penalties-month')?.addEventListener('change', (e) => {
    selectedMonth = e.target.value || toLocalDate().slice(0, 7);
    renderPenaltiesList();
  });

  // Filter Employee
  currentContainer.querySelector('#input-filter-employee')?.addEventListener('input', (e) => {
    searchFilter = e.target.value;
    renderPenaltiesList();
  });

  // Edit Penalty Buttons
  currentContainer.querySelectorAll('.btn-edit-penalty').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const penalty = store.get('penalties', id);
      if (penalty) {
        openEditPenaltyModal(penalty, currentSession);
      }
    });
  });

  // Delete Penalty Buttons (Admin Only)
  if (currentSession?.role === 'admin') {
    currentContainer.querySelectorAll('.btn-delete-penalty').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const penalty = store.get('penalties', id);
        if (!penalty) return;

        const confirmed = await ui.confirm({
          title: t('common.delete'),
          message: t('penalties.deleteConfirm'),
          confirmText: t('common.delete'),
          cancelText: t('common.cancel'),
          danger: true
        });

        if (confirmed) {
          store.remove('penalties', id);
          ui.toast(t('penalties.penaltyDeleted'), 'success');
          renderPenaltiesList();
        }
      });
    });
  }
}

function updateMonthInput() {
  const monthInput = currentContainer?.querySelector('#input-penalties-month');
  if (monthInput) monthInput.value = selectedMonth;
}

function stepMonth(yyyy_mm, delta) {
  const [yStr, mStr] = yyyy_mm.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + delta;
  if (m > 12) {
    m = 1;
    y++;
  } else if (m < 1) {
    m = 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function handleAddPenalty() {
  if (!selectedEmployee) {
    ui.toast(t('attendance.selectEmployeePrompt'), 'warning');
    employeeSearchInstance?.focus();
    return;
  }

  if (penaltyDays <= 0 || penaltyDays > 30) {
    ui.toast('أيام الجزاء يجب أن تكون بين 0.5 و 30 يوماً', 'error');
    return;
  }

  // Check if multiple penalties exist for the same employee on this date
  const allPenalties = store.list('penalties');
  const hasExisting = allPenalties.some(p => p.employeeId === selectedEmployee.id && p.date === selectedDate);

  if (hasExisting) {
    const confirmed = await ui.confirm({
      title: t('penalties.addPenalty'),
      message: `${t('penalties.sameDatePenaltyWarning').replace('{date}', selectedDate)}\n(${selectedEmployee.name})`,
      confirmText: t('common.add'),
      cancelText: t('common.cancel')
    });

    if (!confirmed) return;
  }

  const currentSession = auth.getSession();
  const newPenalty = {
    employeeId: selectedEmployee.id,
    date: selectedDate,
    days: penaltyDays,
    reason: (penaltyReason || '').trim(),
    createdBy: currentSession?.id || 'admin',
    createdAt: nowLocalStamp()
  };

  store.insert('penalties', newPenalty);
  ui.toast(t('penalties.penaltySaved'), 'success');

  // Adjustment 2: If penalty date is in a different month than selectedMonth, switch month
  const penaltyMonth = selectedDate.slice(0, 7);
  if (selectedMonth !== penaltyMonth) {
    selectedMonth = penaltyMonth;
    updateMonthInput();
  }

  // Clear form
  selectedEmployee = null;
  penaltyDays = 1.0;
  penaltyReason = '';
  employeeSearchInstance?.clear();

  const daysInput = currentContainer?.querySelector('#input-penalty-days');
  if (daysInput) daysInput.value = 1.0;
  const reasonInput = currentContainer?.querySelector('#input-penalty-reason');
  if (reasonInput) reasonInput.value = '';

  updateLiveDeductionText();
  renderPenaltiesList();
  employeeSearchInstance?.focus();
}

function openEditPenaltyModal(penalty, currentSession) {
  const settings = store.getSettings();
  const hoursPerDay = Number(settings.penaltyDayHours ?? 4);
  const lang = getLang();
  const allEmployees = store.list('employees');
  const emp = allEmployees.find(e => e.id === penalty.employeeId);

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="mb-3">
      <strong class="text-cyan" style="font-size: 1.05rem;">${escapeHtml(emp?.name || '—')}</strong>
      <span class="badge badge-leave font-num" style="margin-inline-start: 0.35rem;">#${escapeHtml(emp?.badge || '')}</span>
    </div>

    <div class="form-group mb-3">
      <label class="form-label">${t('common.date')}</label>
      <input type="date" class="input font-num" id="modal-edit-date" value="${penalty.date}">
    </div>

    <div class="form-group mb-2">
      <label class="form-label">${t('penalties.penaltyDays')}</label>
      <input type="number" step="0.5" min="0.5" max="30" class="input font-num" id="modal-edit-days" value="${penalty.days}">
    </div>

    <div class="p-2 mb-3" style="background: rgba(255, 59, 92, 0.08); border-radius: var(--radius-sm); border: 1px solid rgba(255, 59, 92, 0.25);">
      <span class="text-muted" style="font-size: 0.85rem;">${t('penalties.deductedHours')}:</span>
      <strong class="text-red font-num" id="modal-live-deduction" style="margin-inline-start: 0.35rem;">
        ${getLiveDeductionLabel(penalty.days, hoursPerDay)}
      </strong>
    </div>

    <div class="form-group mb-3">
      <label class="form-label">${t('penalties.reason')}</label>
      <input type="text" class="input" id="modal-edit-reason" value="${escapeHtml(penalty.reason || '')}">
    </div>
  `;

  const daysInp = content.querySelector('#modal-edit-days');
  const liveEl = content.querySelector('#modal-live-deduction');
  daysInp?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 0;
    liveEl.textContent = getLiveDeductionLabel(val, hoursPerDay);
  });

  const modalInstance = ui.modal({
    title: t('penalties.editPenalty'),
    content,
    actions: [
      { text: t('common.cancel') },
      {
        text: t('common.save'),
        primary: true,
        handler: () => {
          const newDate = content.querySelector('#modal-edit-date')?.value;
          const newDays = parseFloat(daysInp?.value) || 0;
          const newReason = content.querySelector('#modal-edit-reason')?.value || '';

          if (!newDate) {
            ui.toast('التاريخ مطلوب', 'error');
            return;
          }
          if (newDays <= 0 || newDays > 30) {
            ui.toast('أيام الجزاء يجب أن تكون بين 0.5 و 30', 'error');
            return;
          }

          store.update('penalties', penalty.id, {
            date: newDate,
            days: newDays,
            reason: newReason.trim(),
            updatedBy: currentSession?.id || 'admin',
            updatedAt: nowLocalStamp()
          });

          ui.toast(t('penalties.penaltyUpdated'), 'success');

          // Auto-switch list month if date month changed
          const pMonth = newDate.slice(0, 7);
          if (selectedMonth !== pMonth) {
            selectedMonth = pMonth;
            updateMonthInput();
          }

          modalInstance.close();
          renderPenaltiesList();
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
