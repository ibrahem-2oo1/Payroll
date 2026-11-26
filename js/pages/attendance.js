/**
 * Dawam - Daily Attendance Page Controller (Phase 3)
 * Main daily entry screen:
 * - Reusable employee search (active employees only)
 * - Date picker with stepper (◀, ▶, Today), weekday name, and future date warning
 * - Present mode: clock-in & out, pre-fill defaults, midnight crossing detection
 * - Live pre-save result panel with dynamic lateNo and calculation breakdown
 * - Leave & Absent quick actions with overwrite confirmation
 * - Single record per employee/date enforcement (Edit & Delete existing record)
 * - Fast entry loop (≤ 4 taps: search -> pick -> Save -> refocus)
 * - Day attendance log with filter chips, recorded counter, and tap-to-edit
 * - Dynamic late counter cascading
 */

import { t, getLang } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ui from '../core/ui.js';
import { toLocalDate, addDays, getWeekdayName, minToHoursLabel, hhmmToMin } from '../core/dates.js';
import { calcDay, getLateNoForDate } from '../engine/calc.js';
import { createEmployeeSearch } from '../core/employee-search.js';
import { createDateBar } from '../core/date-bar.js';

let currentContainer = null;
let employeeSearchInstance = null;
let dateBarInstance = null;

// Page state
let selectedDate = toLocalDate();
let selectedEmployee = null;
let existingRecord = null;
let currentFilter = 'all';

let formTimes = {
  in: '08:00',
  out: '16:00'
};

export function mount(container) {
  currentContainer = container;
  selectedDate = toLocalDate();
  selectedEmployee = null;
  existingRecord = null;
  currentFilter = 'all';

  const settings = store.getSettings();
  formTimes.in = settings.shiftStart || '08:00';
  formTimes.out = settings.shiftEnd || '16:00';

  render();

  const handleDataChange = () => {
    if (document.body.contains(currentContainer)) {
      if (selectedEmployee) {
        syncRecordForSelectedEmployeeAndDate();
      }
      renderDayList();
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

  currentContainer.innerHTML = `
    <!-- Top Date Stepper Bar Mount -->
    <div id="date-bar-mount"></div>

    <!-- Main Responsive Grid (Desktop 2-col, Mobile 1-col) -->
    <div class="attendance-grid">
      <!-- Left Column: Entry Form & Live Result -->
      <div class="attendance-form-col">
        <div class="card card-neon mb-3">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 class="card-title text-cyan" style="font-size: 1.15rem;">📝 ${t('attendance.title')}</h3>
              <span id="editing-badge-container">
                ${existingRecord ? `<span class="badge badge-present font-num">✏️ ${t('attendance.editingRecord')}</span>` : ''}
              </span>
            </div>
            <div id="delete-btn-container">
              ${existingRecord ? `
                <button type="button" class="btn btn-danger btn-sm" id="btn-delete-record" title="${t('common.delete')}">
                  🗑️ ${t('common.delete')}
                </button>
              ` : ''}
            </div>
          </div>

          <div class="card-body">
            <!-- 1. Employee Search Component Mount Target -->
            <div class="form-group mb-3">
              <label class="form-label">${t('common.employee')} *</label>
              <div id="employee-search-mount"></div>
            </div>

            <!-- 2. Clock In / Out Inputs -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;" class="mb-2">
              <div class="form-group mb-0">
                <label class="form-label">${t('attendance.clockIn')} *</label>
                <input type="time" class="input input-time-lg font-num" id="input-clock-in" value="${formTimes.in}">
              </div>
              <div class="form-group mb-0">
                <label class="form-label">${t('attendance.clockOut')} *</label>
                <input type="time" class="input input-time-lg font-num" id="input-clock-out" value="${formTimes.out}">
              </div>
            </div>

            <!-- Midnight crossing note -->
            <div id="midnight-note-container" class="mb-3" style="display: none;">
              <span class="badge badge-midnight font-num">
                🌙 ${t('attendance.crossesMidnight')}
              </span>
            </div>

            <!-- 3. Live Pre-Save Calculation Result Panel -->
            <div id="live-result-panel-mount">
              ${renderLiveResultPanel()}
            </div>

            <!-- 4. Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
              <button type="button" class="btn btn-primary" id="btn-save-present" style="width: 100%;">
                💾 ${t('common.save')} (${t('attendance.present')})
              </button>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary" id="btn-mark-leave">
                  🏖️ ${t('attendance.leave')}
                </button>
                <button type="button" class="btn btn-danger" id="btn-mark-absent">
                  🚫 ${t('attendance.absent')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Day Attendance Records List -->
      <div class="attendance-list-col">
        <div class="card card-neon">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 class="card-title text-cyan" style="font-size: 1.15rem;">📋 ${t('attendance.todayRecords')}</h3>
              <small class="text-muted" id="records-counter-text">
                ${getRecordsCounterText()}
              </small>
            </div>
          </div>

          <div class="card-body">
            <!-- Filter Chips -->
            <div class="segmented-control mb-3" id="status-filter-chips">
              <button type="button" class="segmented-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                ${t('attendance.filterAll')}
              </button>
              <button type="button" class="segmented-btn ${currentFilter === 'present' ? 'active' : ''}" data-filter="present">
                ${t('attendance.filterPresent')}
              </button>
              <button type="button" class="segmented-btn ${currentFilter === 'late' ? 'active' : ''}" data-filter="late">
                ${t('attendance.filterLate')}
              </button>
              <button type="button" class="segmented-btn ${currentFilter === 'absent' ? 'active' : ''}" data-filter="absent">
                ${t('attendance.filterAbsent')}
              </button>
              <button type="button" class="segmented-btn ${currentFilter === 'leave' ? 'active' : ''}" data-filter="leave">
                ${t('attendance.filterLeave')}
              </button>
            </div>

            <!-- Records Table / Cards -->
            <div id="day-records-table-container">
              ${renderDayRecordsTable()}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initDateBar();
  initEmployeeSearch();
  attachEventListeners();
  checkMidnightCrossing();
}

function initDateBar() {
  const mountEl = currentContainer?.querySelector('#date-bar-mount');
  if (!mountEl) return;

  if (dateBarInstance) {
    dateBarInstance.destroy();
  }

  dateBarInstance = createDateBar(mountEl, {
    date: selectedDate,
    onChange: (newDate) => {
      selectedDate = newDate;
      onDateChanged();
    }
  });
}

function initEmployeeSearch() {
  const mountEl = currentContainer?.querySelector('#employee-search-mount');
  if (!mountEl) return;

  if (employeeSearchInstance) {
    employeeSearchInstance.destroy();
  }

  employeeSearchInstance = createEmployeeSearch(mountEl, {
    placeholder: t('attendance.searchPrompt'),
    filterActiveOnly: true,
    onSelect: (emp) => {
      selectedEmployee = emp;
      syncRecordForSelectedEmployeeAndDate();
      updateLivePanel();
    },
    onClear: () => {
      selectedEmployee = null;
      existingRecord = null;
      resetDefaultTimes();
      updateEditingUI();
      updateLivePanel();
    }
  });

  if (selectedEmployee) {
    employeeSearchInstance.setEmployee(selectedEmployee);
  }
}

/**
 * Adjustment 2: If the date or employee changes, re-syncs the form with the database.
 * If a record exists on that date -> loads it in "Editing" mode.
 * If none exists -> pre-fills default shift times.
 */
function syncRecordForSelectedEmployeeAndDate() {
  if (!selectedEmployee) {
    existingRecord = null;
    resetDefaultTimes();
    updateEditingUI();
    return;
  }

  const allAttendance = store.list('attendance');
  const record = allAttendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDate);

  if (record) {
    existingRecord = record;
    if (record.status === 'present') {
      formTimes.in = record.in || '08:00';
      formTimes.out = record.out || '16:00';
    } else {
      resetDefaultTimes();
    }
  } else {
    existingRecord = null;
    resetDefaultTimes();
  }

  updateTimeInputs();
  updateEditingUI();
  updateLivePanel();
  checkMidnightCrossing();
}

function resetDefaultTimes() {
  const settings = store.getSettings();
  formTimes.in = settings.shiftStart || '08:00';
  formTimes.out = settings.shiftEnd || '16:00';
}

function updateTimeInputs() {
  const inInput = currentContainer?.querySelector('#input-clock-in');
  const outInput = currentContainer?.querySelector('#input-clock-out');
  if (inInput) inInput.value = formTimes.in;
  if (outInput) outInput.value = formTimes.out;
}

function updateEditingUI() {
  const editingBadge = currentContainer?.querySelector('#editing-badge-container');
  const deleteBtnContainer = currentContainer?.querySelector('#delete-btn-container');

  if (editingBadge) {
    editingBadge.innerHTML = existingRecord
      ? `<span class="badge badge-present font-num">✏️ ${t('attendance.editingRecord')}</span>`
      : '';
  }

  if (deleteBtnContainer) {
    deleteBtnContainer.innerHTML = existingRecord ? `
      <button type="button" class="btn btn-danger btn-sm" id="btn-delete-record" title="${t('common.delete')}">
        🗑️ ${t('common.delete')}
      </button>
    ` : '';

    deleteBtnContainer.querySelector('#btn-delete-record')?.addEventListener('click', handleDeleteRecord);
  }
}

function checkMidnightCrossing() {
  const midnightContainer = currentContainer?.querySelector('#midnight-note-container');
  if (!midnightContainer) return;

  const inMin = hhmmToMin(formTimes.in);
  const outMin = hhmmToMin(formTimes.out);

  if (formTimes.in && formTimes.out && outMin <= inMin) {
    midnightContainer.style.display = 'block';
  } else {
    midnightContainer.style.display = 'none';
  }
}

function renderLiveResultPanel() {
  if (!selectedEmployee) {
    return `
      <div class="live-breakdown-card text-center" style="padding: 1.5rem 1rem;">
        <span style="font-size: 1.75rem;">👤</span>
        <p class="text-muted mt-2 mb-0" style="font-size: 0.875rem;">
          ${t('attendance.selectEmployeePrompt')}
        </p>
      </div>
    `;
  }

  const lang = getLang();
  const settings = store.getSettings();
  const allAttendance = store.list('attendance');

  // Adjustment 1: Calculate lateNo strictly counting earlier days in the month
  const lateNo = getLateNoForDate(allAttendance, selectedEmployee.id, selectedDate, settings);
  const calc = calcDay({
    in: formTimes.in,
    out: formTimes.out,
    status: 'present'
  }, settings, lateNo);

  const isLate = calc.late > 0;
  const isOT = calc.otRaw > 0;
  const netColor = calc.net >= (calc.regular || 450)
    ? 'text-green'
    : (calc.net > 0 ? 'text-amber' : 'text-red');

  return `
    <div class="live-breakdown-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
        <span class="text-cyan font-bold" style="font-size: 0.9rem;">
          ⚡ ${t('attendance.liveBreakdown')}
        </span>
        <span class="badge ${isLate ? 'badge-late' : 'badge-present'} font-num">
          ${isLate ? `${t('attendance.lateCount')} #${calc.lateNo}` : t('attendance.present')}
        </span>
      </div>

      <div class="stat-grid-2 mb-2">
        <div class="stat-box">
          <div class="stat-box-title">${t('attendance.workedHours')}</div>
          <div class="stat-box-val text-cyan">${minToHoursLabel(calc.worked, lang)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-box-title">${t('attendance.regularHours')}</div>
          <div class="stat-box-val text-cyan">${minToHoursLabel(calc.regular, lang)}</div>
        </div>
      </div>

      ${isLate ? `
        <div class="p-2 mb-2" style="background: rgba(255, 176, 32, 0.08); border-radius: var(--radius-sm); border: 1px solid rgba(255, 176, 32, 0.25); font-size: 0.825rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span class="text-amber">⏰ ${t('attendance.lateMinutes')}: <strong class="font-num">${calc.late} ${t('common.minutes')}</strong></span>
            <span class="badge badge-late font-num" style="font-size: 0.72rem;">#${calc.lateNo} ← ${calc.ruleUsed?.label || calc.ruleUsed?.type || ''}</span>
          </div>
          <div class="text-muted" style="font-size: 0.775rem;">
            ${t('attendance.ruleAmount')}: <span class="font-num text-amber">${calc.ruleAmount} د</span> | 
            ${t('attendance.extraDeduction')}: <span class="font-num text-red">-${calc.lateDeduction} د</span>
          </div>
        </div>
      ` : ''}

      ${isOT ? `
        <div class="p-2 mb-2" style="background: rgba(0, 240, 255, 0.08); border-radius: var(--radius-sm); border: 1px solid rgba(0, 240, 255, 0.25); font-size: 0.825rem; display: flex; justify-content: space-between; align-items: center;">
          <span class="text-cyan">⌛ ${t('attendance.otRaw')}: <strong class="font-num">${calc.otRaw} د</strong></span>
          <span class="badge badge-leave font-num">${t('attendance.otHours')}: ${calc.ot} د (${minToHoursLabel(calc.ot, lang)})</span>
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-muted);">
        <span style="font-weight: 700; font-size: 0.95rem;">${t('attendance.netHours')}:</span>
        <span class="font-num font-bold ${netColor}" style="font-size: 1.25rem;">
          ${minToHoursLabel(calc.net, lang)} (${calc.net} د)
        </span>
      </div>
    </div>
  `;
}

function updateLivePanel() {
  const panelMount = currentContainer?.querySelector('#live-result-panel-mount');
  if (panelMount) {
    panelMount.innerHTML = renderLiveResultPanel();
  }
}

function getRecordsCounterText() {
  const allEmployees = store.list('employees');
  const activeEmployees = allEmployees.filter(e => e.active !== false);
  const totalActive = activeEmployees.length;

  const allAttendance = store.list('attendance');
  const todayRecords = allAttendance.filter(a => a.date === selectedDate);
  const recordedCount = todayRecords.length;

  return t('attendance.recordedCounter')
    .replace('{recorded}', recordedCount)
    .replace('{total}', totalActive);
}

function renderDayRecordsTable() {
  const allEmployees = store.list('employees');
  const allAttendance = store.list('attendance');
  const allPenalties = store.list('penalties');
  const settings = store.getSettings();
  const lang = getLang();

  // Find all attendance records for selectedDate
  let dayRecords = allAttendance.filter(a => a.date === selectedDate);

  // Compute calculated metrics for each record dynamically
  const computedList = dayRecords.map(rec => {
    const emp = allEmployees.find(e => e.id === rec.employeeId);
    let calc = null;
    let lateNo = 0;

    if (rec.status === 'present') {
      lateNo = getLateNoForDate(allAttendance, rec.employeeId, rec.date, settings);
      calc = calcDay(rec, settings, lateNo);
    } else {
      calc = calcDay(rec, settings, 1);
    }

    return {
      record: rec,
      employee: emp,
      calc,
      lateNo
    };
  });

  // Filter
  const filtered = computedList.filter(item => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'present') return item.record.status === 'present' && item.calc?.late === 0;
    if (currentFilter === 'late') return item.record.status === 'present' && item.calc?.late > 0;
    if (currentFilter === 'absent') return item.record.status === 'absent';
    if (currentFilter === 'leave') return item.record.status === 'leave';
    return true;
  });

  if (filtered.length === 0) {
    return `
      <div class="text-center p-4 text-muted">
        ${t('common.noData')}
      </div>
    `;
  }

  return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>${t('common.employee')}</th>
            <th>${t('common.status')}</th>
            <th>${t('attendance.clockIn')} - ${t('attendance.clockOut')}</th>
            <th>${t('attendance.netHours')}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(({ record, employee, calc, lateNo }) => {
    const isEmpSelected = selectedEmployee && selectedEmployee.id === employee?.id;
    const empName = employee ? employee.name : '—';
    const empBadge = employee ? employee.badge : '';
    const hasPenalty = allPenalties.some(p => p.employeeId === employee?.id && p.date === selectedDate);

    let statusBadge = '';
    let timesText = '—';
    if (record.status === 'present') {
      timesText = `<span class="font-num">${record.in || ''} - ${record.out || ''}</span>`;
      if (calc.late > 0) {
        statusBadge = `<span class="badge badge-late font-num">${t('attendance.lateCount')} #${lateNo}</span>`;
      } else {
        statusBadge = `<span class="badge badge-present">${t('attendance.present')}</span>`;
      }
    } else if (record.status === 'absent') {
      statusBadge = `<span class="badge badge-absent">${t('attendance.absent')}</span>`;
    } else if (record.status === 'leave') {
      statusBadge = `<span class="badge badge-leave">${t('attendance.leave')}</span>`;
    }

    const netFormatted = calc ? `${minToHoursLabel(calc.net, lang)}` : '0';
    const netColor = calc?.net >= (calc?.regular || 450)
      ? 'text-green'
      : (calc?.net > 0 ? 'text-cyan' : 'text-red');

    return `
              <tr class="table-row-clickable ${isEmpSelected ? 'table-row-selected' : ''}" data-emp-id="${employee?.id}" style="${isEmpSelected ? 'background: rgba(0, 240, 255, 0.12);' : ''}">
                <td>
                  <strong>${escapeHtml(empName)}</strong>
                  <span class="badge badge-leave font-num" style="margin-inline-start: 0.35rem; font-size: 0.72rem;">#${escapeHtml(empBadge)}</span>
                  ${hasPenalty ? `<span class="badge badge-absent font-num" title="${t('penalties.penaltyBadge')}" style="margin-inline-start: 0.35rem; font-size: 0.7rem;">⚠️ ${t('penalties.penaltyBadge')}</span>` : ''}
                </td>
                <td>${statusBadge}</td>
                <td>${timesText}</td>
                <td>
                  <strong class="font-num ${netColor}">${netFormatted}</strong>
                </td>
              </tr>
            `;
  }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDayList() {
  const container = currentContainer?.querySelector('#day-records-table-container');
  if (container) {
    container.innerHTML = renderDayRecordsTable();
    attachDayTableListeners();
  }

  const counterEl = currentContainer?.querySelector('#records-counter-text');
  if (counterEl) {
    counterEl.textContent = getRecordsCounterText();
  }
}

function attachDayTableListeners() {
  const rows = currentContainer?.querySelectorAll('.table-row-clickable[data-emp-id]');
  rows?.forEach(row => {
    row.addEventListener('click', () => {
      const empId = row.getAttribute('data-emp-id');
      const emp = store.get('employees', empId);
      if (emp) {
        selectedEmployee = emp;
        employeeSearchInstance?.setEmployee(emp);
        syncRecordForSelectedEmployeeAndDate();
        // Scroll to form on mobile
        if (window.innerWidth < 900) {
          currentContainer?.querySelector('.attendance-form-col')?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

function attachEventListeners() {
  if (!currentContainer) return;

  const lang = getLang();

  // Date Stepper: Prev
  currentContainer.querySelector('#btn-date-prev')?.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, -1);
    onDateChanged();
  });

  // Date Stepper: Next
  currentContainer.querySelector('#btn-date-next')?.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, 1);
    onDateChanged();
  });

  // Date Stepper: Today
  currentContainer.querySelector('#btn-date-today')?.addEventListener('click', () => {
    selectedDate = toLocalDate();
    onDateChanged();
  });

  // Direct Date input
  currentContainer.querySelector('#input-attendance-date')?.addEventListener('change', (e) => {
    selectedDate = e.target.value || toLocalDate();
    onDateChanged();
  });

  // Clock in & out input
  currentContainer.querySelector('#input-clock-in')?.addEventListener('input', (e) => {
    formTimes.in = e.target.value;
    checkMidnightCrossing();
    updateLivePanel();
  });

  currentContainer.querySelector('#input-clock-out')?.addEventListener('input', (e) => {
    formTimes.out = e.target.value;
    checkMidnightCrossing();
    updateLivePanel();
  });

  // Filter chips
  currentContainer.querySelectorAll('#status-filter-chips .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter') || 'all';
      currentContainer.querySelectorAll('#status-filter-chips .segmented-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-filter') === currentFilter);
      });
      renderDayList();
    });
  });

  // Save Present Record (Primary)
  currentContainer.querySelector('#btn-save-present')?.addEventListener('click', handleSavePresent);

  // Mark Leave Record
  currentContainer.querySelector('#btn-mark-leave')?.addEventListener('click', handleMarkLeave);

  // Mark Absent Record
  currentContainer.querySelector('#btn-mark-absent')?.addEventListener('click', handleMarkAbsent);

  // Table row clicks
  attachDayTableListeners();
}

function onDateChanged() {
  const lang = getLang();
  const today = toLocalDate();
  const isFuture = selectedDate > today;

  const dateInput = currentContainer?.querySelector('#input-attendance-date');
  if (dateInput) dateInput.value = selectedDate;

  const weekdayEl = currentContainer?.querySelector('#weekday-display');
  if (weekdayEl) weekdayEl.textContent = `📅 ${getWeekdayName(selectedDate, lang)}`;

  const futureBadge = currentContainer?.querySelector('#future-date-badge');
  if (futureBadge) {
    futureBadge.style.display = isFuture ? 'inline-flex' : 'none';
  } else if (isFuture) {
    weekdayEl?.insertAdjacentHTML('afterend', ` <span class="badge badge-late font-num" id="future-date-badge" style="font-size: 0.75rem;">⚠️ ${t('attendance.futureDateWarning')}</span>`);
  }

  // Adjustment 2: If an employee was selected, reload their record for the new date
  if (selectedEmployee) {
    syncRecordForSelectedEmployeeAndDate();
  }

  renderDayList();
}

async function handleSavePresent() {
  if (!selectedEmployee) {
    ui.toast(t('attendance.selectEmployeePrompt'), 'warning');
    employeeSearchInstance?.focus();
    return;
  }

  if (!formTimes.in || !formTimes.out) {
    ui.toast(t('attendance.timesRequired'), 'error');
    return;
  }

  const allAttendance = store.list('attendance');
  const existing = allAttendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDate);

  if (existing) {
    store.update('attendance', existing.id, {
      in: formTimes.in,
      out: formTimes.out,
      status: 'present'
    });
  } else {
    store.insert('attendance', {
      employeeId: selectedEmployee.id,
      date: selectedDate,
      in: formTimes.in,
      out: formTimes.out,
      status: 'present',
      note: ''
    });
  }

  ui.toast(t('attendance.recordSaved'), 'success');
  finishSaveCycle();
}

async function handleMarkLeave() {
  if (!selectedEmployee) {
    ui.toast(t('attendance.selectEmployeePrompt'), 'warning');
    employeeSearchInstance?.focus();
    return;
  }

  const allAttendance = store.list('attendance');
  const existing = allAttendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDate);

  const confirmMsg = existing
    ? t('attendance.overwriteConfirm')
    : t('attendance.leaveConfirm');

  const confirmed = await ui.confirm({
    title: t('attendance.leave'),
    message: `${confirmMsg}\n(${selectedEmployee.name})`,
    confirmText: t('common.confirm'),
    cancelText: t('common.cancel')
  });

  if (!confirmed) return;

  if (existing) {
    store.update('attendance', existing.id, {
      in: null,
      out: null,
      status: 'leave'
    });
  } else {
    store.insert('attendance', {
      employeeId: selectedEmployee.id,
      date: selectedDate,
      in: null,
      out: null,
      status: 'leave',
      note: ''
    });
  }

  ui.toast(t('attendance.recordSaved'), 'success');
  finishSaveCycle();
}

async function handleMarkAbsent() {
  if (!selectedEmployee) {
    ui.toast(t('attendance.selectEmployeePrompt'), 'warning');
    employeeSearchInstance?.focus();
    return;
  }

  const allAttendance = store.list('attendance');
  const existing = allAttendance.find(a => a.employeeId === selectedEmployee.id && a.date === selectedDate);

  const confirmMsg = existing
    ? t('attendance.overwriteConfirm')
    : t('attendance.absentConfirm');

  const confirmed = await ui.confirm({
    title: t('attendance.absent'),
    message: `${confirmMsg}\n(${selectedEmployee.name})`,
    confirmText: t('common.confirm'),
    cancelText: t('common.cancel'),
    danger: true
  });

  if (!confirmed) return;

  if (existing) {
    store.update('attendance', existing.id, {
      in: null,
      out: null,
      status: 'absent'
    });
  } else {
    store.insert('attendance', {
      employeeId: selectedEmployee.id,
      date: selectedDate,
      in: null,
      out: null,
      status: 'absent',
      note: ''
    });
  }

  ui.toast(t('attendance.recordSaved'), 'success');
  finishSaveCycle();
}

async function handleDeleteRecord() {
  if (!existingRecord) return;

  const confirmed = await ui.confirm({
    title: t('common.delete'),
    message: t('attendance.deleteConfirm'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  });

  if (!confirmed) return;

  store.remove('attendance', existingRecord.id);
  ui.toast(t('attendance.recordDeleted'), 'success');
  finishSaveCycle();
}

/**
 * Fast entry loop:
 * Keeps the selected date, clears the selected employee, and refocuses the search box.
 */
function finishSaveCycle() {
  selectedEmployee = null;
  existingRecord = null;
  resetDefaultTimes();
  employeeSearchInstance?.clear();
  updateTimeInputs();
  updateEditingUI();
  updateLivePanel();
  checkMidnightCrossing();
  renderDayList();
  employeeSearchInstance?.focus();
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
