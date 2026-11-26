/**
 * Dawam - Settings Page Controller
 * System & Policy Settings (Phase 2):
 * - Official Working Hours & day length calculation
 * - Overtime calculation & live example
 * - Absence & Penalties rules
 * - Late Rules editor: ordered list, add, remove, move up/down, cycle counter
 * - Live Late Deduction Preview for arrivals (N = 1 .. len+1)
 * - Data Management: Export JSON, Import JSON (validated with confirm), Sync to GitHub
 * - Users & Access Control (Phase 1): Add, edit role, reset password, delete (with last admin & self guards)
 * - Dirty state tracking, Save button state, and unsaved changes navigation guard
 */

import { t, getLang } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import * as ui from '../core/ui.js';
import { setBeforeNavigate } from '../core/router.js';
import { calcDay, hhmmToMin } from '../engine/calc.js';
import { minToHoursLabel } from '../core/dates.js';

let currentContainer = null;
let originalSettings = null;
let state = null;
let simArrival = '08:10';
let isDirty = false;

export function mount(container) {
  currentContainer = container;
  originalSettings = store.getSettings();
  state = JSON.parse(JSON.stringify(originalSettings));
  isDirty = false;

  render();

  // Navigation guard for unsaved changes
  setBeforeNavigate(async () => {
    if (!isDirty) return true;
    const confirmed = await ui.confirm({
      title: t('settings.unsavedChanges'),
      message: t('settings.confirmLeaveDirty'),
      confirmText: t('settings.discardChanges'),
      cancelText: t('common.cancel'),
      danger: true
    });
    if (confirmed) {
      isDirty = false;
      return true;
    }
    return false;
  });

  const handleBeforeUnload = (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  const handleDataChange = () => {
    if (document.body.contains(currentContainer) && !isDirty) {
      originalSettings = store.getSettings();
      state = JSON.parse(JSON.stringify(originalSettings));
      render();
    }
  };
  window.addEventListener('dawam:datachange', handleDataChange);

  return () => {
    setBeforeNavigate(null);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('dawam:datachange', handleDataChange);
  };
}

function checkDirty() {
  isDirty = JSON.stringify(state) !== JSON.stringify(originalSettings);
  updateSaveUI();
}

function updateSaveUI() {
  const saveBtn = currentContainer?.querySelector('#btn-save-settings');
  const saveBtnBar = currentContainer?.querySelector('#btn-save-settings-bar');
  const unsavedBanner = currentContainer?.querySelector('#unsaved-banner');

  if (saveBtn) saveBtn.disabled = !isDirty;
  if (saveBtnBar) saveBtnBar.disabled = !isDirty;
  if (unsavedBanner) {
    unsavedBanner.style.display = isDirty ? 'flex' : 'none';
  }
}

function calculateOfficialDayMinutes() {
  const sStart = hhmmToMin(state.shiftStart || '08:00');
  let sEnd = hhmmToMin(state.shiftEnd || '16:00');
  if (sEnd <= sStart) sEnd += 1440;
  return Math.max(0, sEnd - sStart - Number(state.breakMinutes || 0));
}

function calculateOTExampleMinutes() {
  const countedPer60 = Number(state.otCountedPer60 ?? 52);
  return Math.round(120 * countedPer60 / 60);
}

function render() {
  if (!currentContainer) return;

  const lang = getLang();
  const users = store.list('users');
  const currentSession = auth.getSession();
  const adminCount = users.filter(u => u.role === 'admin').length;
  const ghConfig = store.getGitHubConfig();
  const ghToken = store.getGitHubToken();

  const officialDayMin = calculateOfficialDayMinutes();
  const otExampleMin = calculateOTExampleMinutes();
  if (!Array.isArray(state.weekendDays)) {
    state.weekendDays = [5];
  }

  currentContainer.innerHTML = `
    <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 class="page-title text-cyan" data-i18n="settings.title" style="font-size: 1.5rem;">⚙️ ${t('settings.title')}</h2>
        <p class="text-muted" style="font-size: 0.875rem;">إدارة لوائح ومواعيد العمل، قواعد التأخير، إدارة البيانات والمستخدمين</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-save-settings" ${isDirty ? '' : 'disabled'}>
        💾 <span data-i18n="common.save">${t('common.save')}</span>
      </button>
    </div>

    <!-- Unsaved Changes Floating / Sticky Banner -->
    <div class="settings-save-bar" id="unsaved-banner" style="display: ${isDirty ? 'flex' : 'none'};">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">⚠️</span>
        <span class="text-amber font-bold" data-i18n="settings.unsavedChanges">${t('settings.unsavedChanges')}</span>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-discard-changes">
          <span data-i18n="settings.discardChanges">${t('settings.discardChanges')}</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-settings-bar">
          💾 <span data-i18n="common.save">${t('common.save')}</span>
        </button>
      </div>
    </div>

    <!-- 1. Official Hours Card -->
    <div class="card card-neon mb-4">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.officialHours">⏰ ${t('settings.officialHours')}</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.shiftStart">${t('settings.shiftStart')}</label>
            <input type="time" class="input input-time-lg font-num" id="input-shift-start" value="${state.shiftStart}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.shiftEnd">${t('settings.shiftEnd')}</label>
            <input type="time" class="input input-time-lg font-num" id="input-shift-end" value="${state.shiftEnd}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.breakMinutes">${t('settings.breakMinutes')}</label>
            <input type="number" class="input font-num" id="input-break-minutes" min="0" max="300" step="1" value="${state.breakMinutes}">
          </div>
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.graceMinutes">${t('settings.graceMinutes')}</label>
            <input type="number" class="input font-num" id="input-grace-minutes" min="0" max="180" step="1" value="${state.graceMinutes}">
          </div>
        </div>

        <div class="mt-3 p-2" style="background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span class="text-secondary" style="font-size: 0.9rem;" data-i18n="settings.officialDayLength">
            ⌛ ${t('settings.officialDayLength')}:
          </span>
          <span class="badge badge-leave font-num" id="badge-official-day-length" style="font-size: 0.95rem; padding: 0.4rem 0.8rem;">
            ${minToHoursLabel(officialDayMin, lang)} (${officialDayMin} ${t('common.minutes')})
          </span>
        </div>

        <!-- Weekend Days Toggles -->
        <div class="mt-3 p-2" style="background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <label class="form-label mb-2" data-i18n="settings.weekendDays">🌴 ${t('settings.weekendDays')}</label>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;" id="weekend-days-toggles">
            ${[
              { num: 0, ar: 'الأحد', en: 'Sun' },
              { num: 1, ar: 'الإثنين', en: 'Mon' },
              { num: 2, ar: 'الثلاثاء', en: 'Tue' },
              { num: 3, ar: 'الأربعاء', en: 'Wed' },
              { num: 4, ar: 'الخميس', en: 'Thu' },
              { num: 5, ar: 'الجمعة', en: 'Fri' },
              { num: 6, ar: 'السبت', en: 'Sat' }
            ].map(day => {
              const isSelected = (state.weekendDays || []).includes(day.num);
              return `
                <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-weekend-toggle" data-day="${day.num}">
                  ${lang === 'ar' ? day.ar : day.en} ${isSelected ? '✓' : ''}
                </button>
              `;
            }).join('')}
          </div>
          <small class="text-muted" style="display: block; margin-top: 0.35rem;">الأيام المحددة تعتبر عطلة رسمية تظهر مميزة في كشوفات وسجلات الحضور</small>
        </div>
      </div>
    </div>

    <!-- 2. Overtime Card -->
    <div class="card card-neon mb-4">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.overtime">⚡ ${t('settings.overtime')}</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.otCountedPer60">${t('settings.otCountedPer60')}</label>
            <input type="number" class="input font-num" id="input-ot-counted-per-60" min="0" max="180" step="1" value="${state.otCountedPer60}">
            <small class="text-muted">الافتراضي: 52 دقيقة لكل 60 دقيقة عمل إضافي (خصم 8 دقائق)</small>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.otMinMinutes">${t('settings.otMinMinutes')}</label>
            <input type="number" class="input font-num" id="input-ot-min-minutes" min="0" max="180" step="1" value="${state.otMinMinutes}">
            <small class="text-muted">أي وقت إضافي أقل من هذا الحد لا يحتسب (0)</small>
          </div>
        </div>

        <div class="mt-3 p-2" style="background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <small class="text-muted" id="ot-example-line">
            💡 ${t('settings.otExample')}: <strong class="text-cyan font-num">${minToHoursLabel(otExampleMin, lang)} (${otExampleMin} ${t('common.minutes')})</strong>
          </small>
        </div>
      </div>
    </div>

    <!-- 3. Penalties & Absence Card -->
    <div class="card card-neon mb-4">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.penaltiesAbsence">⚖️ ${t('settings.penaltiesAbsence')}</h3>
      </div>
      <div class="card-body">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.penaltyDayHours">${t('settings.penaltyDayHours')}</label>
            <input type="number" class="input font-num" id="input-penalty-day-hours" min="0" max="24" step="0.5" value="${state.penaltyDayHours}">
            <small class="text-muted">يوم الجزاء الواحد يخصم هذا العدد من الساعات في الشهر</small>
          </div>
          <div class="form-group mb-0">
            <label class="form-label" data-i18n="settings.absentDayHours">${t('settings.absentDayHours')}</label>
            <input type="number" class="input font-num" id="input-absent-day-hours" min="0" max="24" step="0.5" value="${state.absentDayHours}">
            <small class="text-muted">يوم الغياب الواحد يخصم هذا العدد من الساعات</small>
          </div>
        </div>

        <div class="mt-3" style="display: flex; align-items: center; gap: 0.75rem;">
          <input type="checkbox" id="checkbox-leave-paid" ${state.leavePaid ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
          <div>
            <label for="checkbox-leave-paid" style="font-weight: 600; cursor: pointer;" data-i18n="settings.leavePaid">${t('settings.leavePaid')}</label>
            <p class="text-muted mb-0" style="font-size: 0.8rem;">
              ${state.leavePaid ? 'يتم احتساب يوم الإجازة كساعات عمل رسمية معتمدة' : 'يوم الإجازة = 0 ساعة (بدون خصم وبدون رصيد إضافي)'}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Late Rules & Live Simulation Card -->
    <div class="card card-neon mb-4">
      <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 class="card-title text-cyan" data-i18n="settings.lateRules">🔄 ${t('settings.lateRules')}</h3>
          <small class="text-muted">قائمة القواعد الدورية المتتالية؛ تتكرر بعد انتهاء الدورة</small>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-add-rule">
          + <span data-i18n="settings.addRule">${t('settings.addRule')}</span>
        </button>
      </div>

      <div class="card-body">
        <!-- Late Counter Reset Selection -->
        <div class="form-group mb-4">
          <label class="form-label" data-i18n="settings.lateCounterReset">${t('settings.lateCounterReset')}</label>
          <div class="segmented-control" style="max-width: 440px;">
            <button type="button" class="segmented-btn ${state.lateCounterReset === 'monthly' ? 'active' : ''}" data-reset="monthly">
              📅 ${t('settings.monthly')}
            </button>
            <button type="button" class="segmented-btn ${state.lateCounterReset === 'never' ? 'active' : ''}" data-reset="never">
              ♾️ ${t('settings.never')}
            </button>
          </div>
        </div>

        <!-- Rules List -->
        <div id="rules-list-container">
          ${renderRulesList()}
        </div>

        <!-- Live Simulation Preview -->
        <div class="card mt-4" style="background: rgba(0, 240, 255, 0.02); border-color: rgba(0, 240, 255, 0.25);">
          <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h4 class="card-title text-cyan" style="font-size: 1rem;" data-i18n="settings.previewTitle">🔍 ${t('settings.previewTitle')}</h4>
              <small class="text-muted" data-i18n="settings.previewDesc">${t('settings.previewDesc')}:</small>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="time" class="input input-time-lg font-num" id="input-sim-arrival" value="${simArrival}" style="max-width: 140px; height: 38px;">
            </div>
          </div>
          <div class="card-body" id="simulation-preview-body">
            ${renderSimulationTable()}
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Data Management & GitHub Sync Card -->
    <div class="card card-neon mb-4">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.dataManagement">💾 ${t('settings.dataManagement')}</h3>
      </div>
      <div class="card-body">
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <!-- Export JSON Button -->
          <button type="button" class="btn btn-secondary" id="btn-export-json">
            📤 <span data-i18n="settings.exportJSON">${t('settings.exportJSON')}</span>
          </button>

          <!-- Import JSON Button & Hidden File Input -->
          <input type="file" id="input-import-file" accept=".json" style="display: none;">
          <button type="button" class="btn btn-secondary" id="btn-trigger-import">
            📥 <span data-i18n="settings.importJSON">${t('settings.importJSON')}</span>
          </button>

          <!-- Delete Sample Data Button -->
          <button type="button" class="btn btn-danger" id="btn-delete-sample-data">
            🗑️ <span data-i18n="settings.deleteSampleData">${t('settings.deleteSampleData')}</span>
          </button>
        </div>

        <!-- GitHub Sync Configuration -->
        <div class="p-3" style="background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <h4 class="text-cyan mb-2" style="font-size: 0.95rem;">🌐 <span data-i18n="settings.syncGitHub">${t('settings.syncGitHub')}</span></h4>
          <p class="text-muted" style="font-size: 0.8rem;">مزامنة وتخزين قاعدة البيانات JSON مباشرة في مستودع GitHub الخاص بك عبر GitHub Contents API.</p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-top: 1rem;">
            <div class="form-group mb-0">
              <label class="form-label">${t('settings.ghOwner')}</label>
              <input type="text" class="input" id="gh-owner" value="${escapeHtml(ghConfig.owner || '')}" placeholder="e.g. username">
            </div>
            <div class="form-group mb-0">
              <label class="form-label">${t('settings.ghRepo')}</label>
              <input type="text" class="input" id="gh-repo" value="${escapeHtml(ghConfig.repo || '')}" placeholder="e.g. HR-Payroll">
            </div>
            <div class="form-group mb-0">
              <label class="form-label">${t('settings.ghPath')}</label>
              <input type="text" class="input font-num" id="gh-path" value="${escapeHtml(ghConfig.path || 'data/db.json')}">
            </div>
            <div class="form-group mb-0">
              <label class="form-label">${t('settings.ghBranch')}</label>
              <input type="text" class="input font-num" id="gh-branch" value="${escapeHtml(ghConfig.branch || 'main')}">
            </div>
          </div>

          <div class="form-group mt-3 mb-3">
            <label class="form-label">${t('settings.ghToken')}</label>
            <input type="password" class="input font-num" id="gh-token" value="${escapeHtml(ghToken)}" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
            <small class="text-muted">يُحفظ الرمز في متصفحك محلياً فقط ولا يرسل لأي خادم وسيط.</small>
          </div>

          <button type="button" class="btn btn-primary btn-sm" id="btn-sync-github">
            🔄 <span data-i18n="settings.ghSyncBtn">${t('settings.ghSyncBtn')}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 6. Users Management Section (Admin Only) -->
    <div class="card card-neon mb-4" id="users-management-card">
      <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 class="card-title text-cyan" data-i18n="users.title">👥 ${t('users.title')}</h3>
          <small class="text-muted">التحكم في حسابات الدخول وتعيين الصلاحيات (${users.length} مستخدمين)</small>
        </div>
        <button type="button" class="btn btn-primary" id="btn-add-user">
          <span data-i18n="users.addUser">+ ${t('users.addUser')}</span>
        </button>
      </div>

      <div class="card-body">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>${t('users.username')}</th>
                <th>${t('users.role')}</th>
                <th>${t('common.status')}</th>
                <th style="text-align: center;">${t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => {
                const isSelf = currentSession && currentSession.id === u.id;
                const isOnlyAdmin = u.role === 'admin' && adminCount <= 1;
                const roleBadgeClass = u.role === 'admin' ? 'badge-late' : 'badge-leave';
                const roleLabel = u.role === 'admin' ? t('users.roleAdminShort') : t('users.roleEntryShort');

                return `
                  <tr data-user-id="${u.id}">
                    <td>
                      <strong>${escapeHtml(u.username)}</strong>
                      ${isSelf ? `<span class="badge badge-present" style="margin-inline-start: 0.5rem; font-size: 0.7rem;">(أنت)</span>` : ''}
                    </td>
                    <td>
                      <span class="badge ${roleBadgeClass}">
                        ${roleLabel}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${u.mustChange ? 'badge-absent' : 'badge-present'}" style="font-size: 0.72rem;">
                        ${u.mustChange ? t('users.statusMustChange') : t('users.statusActive')}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <!-- Edit Role Button -->
                      <button 
                        type="button" 
                        class="btn btn-secondary btn-sm btn-edit-role" 
                        data-id="${u.id}"
                        ${isSelf || isOnlyAdmin ? 'disabled title="لا يمكن تغيير صلاحية هذا الحساب"' : `title="${t('users.editRole')}"`}
                      >
                        🛡️ ${t('users.editRole')}
                      </button>

                      <!-- Reset Password Button -->
                      <button 
                        type="button" 
                        class="btn btn-secondary btn-sm btn-reset-pwd" 
                        data-id="${u.id}" 
                        title="${t('users.resetPassword')}"
                      >
                        🔑 ${t('users.resetPassword')}
                      </button>

                      <!-- Delete User Button -->
                      <button 
                        type="button" 
                        class="btn btn-danger btn-sm btn-delete-user" 
                        data-id="${u.id}"
                        ${isSelf || isOnlyAdmin ? 'disabled title="لا يمكن حذف هذا الحساب"' : `title="${t('users.deleteUser')}"`}
                      >
                        🗑️ ${t('common.delete')}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  attachEventListeners();
}

function renderRulesList() {
  const rules = state.lateRules || [];
  if (rules.length === 0) {
    return `<p class="text-muted p-3">لا توجد قواعد تأخير مضافة.</p>`;
  }

  return rules.map((r, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === rules.length - 1;
    const isOnly = rules.length <= 1;

    let paramInputHtml = '';
    if (r.type === 'late_x' || r.type === 'remaining_x') {
      paramInputHtml = `
        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <span class="text-muted" style="font-size: 0.8rem;">${t('settings.ruleFactor')}:</span>
          <input type="number" class="input font-num rule-param-input" data-idx="${idx}" data-param="factor" step="0.1" min="0" value="${r.factor ?? 1}" style="max-width: 85px; height: 38px;">
        </div>
      `;
    } else if (r.type === 'fixed_hours') {
      paramInputHtml = `
        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <span class="text-muted" style="font-size: 0.8rem;">${t('settings.ruleHours')}:</span>
          <input type="number" class="input font-num rule-param-input" data-idx="${idx}" data-param="hours" step="0.5" min="0" value="${r.hours ?? 1}" style="max-width: 85px; height: 38px;">
        </div>
      `;
    } else {
      paramInputHtml = `
        <span class="text-muted" style="font-size: 0.85rem;">(يوم كامل)</span>
      `;
    }

    return `
      <div class="rule-card-item" data-rule-idx="${idx}">
        <span class="badge badge-late rule-badge">#${idx + 1}</span>

        <select class="select rule-type-select" data-idx="${idx}" style="max-width: 280px; height: 38px;">
          <option value="late_x" ${r.type === 'late_x' ? 'selected' : ''}>${t('settings.ruleTypeLateX')}</option>
          <option value="remaining_x" ${r.type === 'remaining_x' ? 'selected' : ''}>${t('settings.ruleTypeRemainingX')}</option>
          <option value="fixed_hours" ${r.type === 'fixed_hours' ? 'selected' : ''}>${t('settings.ruleTypeFixedHours')}</option>
          <option value="full_day" ${r.type === 'full_day' ? 'selected' : ''}>${t('settings.ruleTypeFullDay')}</option>
        </select>

        ${paramInputHtml}

        <div class="rule-controls">
          <button type="button" class="btn btn-secondary btn-sm btn-rule-up" data-idx="${idx}" ${isFirst ? 'disabled' : ''} title="${t('settings.moveUp')}">
            ▲
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-rule-down" data-idx="${idx}" ${isLast ? 'disabled' : ''} title="${t('settings.moveDown')}">
            ▼
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-rule-delete" data-idx="${idx}" ${isOnly ? 'disabled title="يجب الإبقاء على قاعدة واحدة على الأقل"' : `title="${t('settings.deleteRule')}"`}>
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderSimulationTable() {
  const rules = state.lateRules || [];
  if (rules.length === 0) {
    return `<p class="text-muted">يرجى إضافة قاعدة تأخير للمعاينة.</p>`;
  }

  const lang = getLang();
  const shiftEnd = state.shiftEnd || '16:00';
  const rowsCount = rules.length + 1; // Show one extra to prove cycling!
  const rows = [];

  for (let n = 1; n <= rowsCount; n++) {
    const res = calcDay({ in: simArrival, out: shiftEnd, status: 'present' }, state, n);
    const ruleLabel = res.ruleUsed ? (res.ruleUsed.label || res.ruleUsed.type) : '—';
    const isWrapCycle = n > rules.length;

    rows.push(`
      <tr style="${isWrapCycle ? 'background: rgba(0, 240, 255, 0.07); font-weight: 600;' : ''}">
        <td>
          <span class="badge ${isWrapCycle ? 'badge-leave' : 'badge-late'} font-num">
            #${n} ${isWrapCycle ? `(تكرار #${(n - 1) % rules.length + 1})` : ''}
          </span>
        </td>
        <td>
          <span class="text-secondary">${ruleLabel}</span>
        </td>
        <td class="font-num text-amber">
          ${res.ruleAmount} د
        </td>
        <td class="font-num text-red">
          ${res.lateDeduction} د
        </td>
        <td class="font-num text-green">
          ${minToHoursLabel(res.net, lang)} (${res.net} د)
        </td>
      </tr>
    `);
  }

  return `
    <div class="table-container simulation-table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>${t('settings.simLateNo')}</th>
            <th>${t('settings.simRule')}</th>
            <th>${t('settings.simTotalLoss')}</th>
            <th>${t('settings.simDeduction')}</th>
            <th>${t('settings.simNet')}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateSimulation() {
  const previewBody = currentContainer?.querySelector('#simulation-preview-body');
  if (previewBody) {
    previewBody.innerHTML = renderSimulationTable();
  }
}

function updateComputedBadges() {
  const lang = getLang();
  const officialDayMin = calculateOfficialDayMinutes();
  const otExampleMin = calculateOTExampleMinutes();
  if (!Array.isArray(state.weekendDays)) {
    state.weekendDays = [5];
  }

  const dayLengthBadge = currentContainer?.querySelector('#badge-official-day-length');
  if (dayLengthBadge) {
    dayLengthBadge.textContent = `${minToHoursLabel(officialDayMin, lang)} (${officialDayMin} ${t('common.minutes')})`;
  }

  const otExampleEl = currentContainer?.querySelector('#ot-example-line');
  if (otExampleEl) {
    otExampleEl.innerHTML = `💡 ${t('settings.otExample')}: <strong class="text-cyan font-num">${minToHoursLabel(otExampleMin, lang)} (${otExampleMin} ${t('common.minutes')})</strong>`;
  }
}

function attachEventListeners() {
  if (!currentContainer) return;

  const currentSession = auth.getSession();

  // Save Settings Handlers
  const handleSave = () => {
    store.updateSettings(state);
    originalSettings = JSON.parse(JSON.stringify(state));
    checkDirty();
    ui.toast(t('settings.savedSuccess'), 'success');
  };

  currentContainer.querySelector('#btn-save-settings')?.addEventListener('click', handleSave);
  currentContainer.querySelector('#btn-save-settings-bar')?.addEventListener('click', handleSave);

  // Discard Changes Handler
  currentContainer.querySelector('#btn-discard-changes')?.addEventListener('click', () => {
    state = JSON.parse(JSON.stringify(originalSettings));
    isDirty = false;
    render();
    ui.toast(t('settings.discardChanges'), 'info');
  });

  // Shift inputs
  currentContainer.querySelector('#input-shift-start')?.addEventListener('change', (e) => {
    state.shiftStart = e.target.value;
    checkDirty();
    updateComputedBadges();
    updateSimulation();
  });

  currentContainer.querySelector('#input-shift-end')?.addEventListener('change', (e) => {
    state.shiftEnd = e.target.value;
    checkDirty();
    updateComputedBadges();
    updateSimulation();
  });

  currentContainer.querySelector('#input-break-minutes')?.addEventListener('input', (e) => {
    state.breakMinutes = parseInt(e.target.value, 10) || 0;
    checkDirty();
    updateComputedBadges();
    updateSimulation();
  });

  currentContainer.querySelector('#input-grace-minutes')?.addEventListener('input', (e) => {
    state.graceMinutes = parseInt(e.target.value, 10) || 0;
    checkDirty();
    updateSimulation();
  });

  // Overtime inputs
  currentContainer.querySelector('#input-ot-counted-per-60')?.addEventListener('input', (e) => {
    state.otCountedPer60 = parseInt(e.target.value, 10) || 0;
    checkDirty();
    updateComputedBadges();
    updateSimulation();
  });

  currentContainer.querySelector('#input-ot-min-minutes')?.addEventListener('input', (e) => {
    state.otMinMinutes = parseInt(e.target.value, 10) || 0;
    checkDirty();
    updateSimulation();
  });

  // Penalties & Absence inputs
  currentContainer.querySelector('#input-penalty-day-hours')?.addEventListener('input', (e) => {
    state.penaltyDayHours = parseFloat(e.target.value) || 0;
    checkDirty();
  });

  currentContainer.querySelector('#input-absent-day-hours')?.addEventListener('input', (e) => {
    state.absentDayHours = parseFloat(e.target.value) || 0;
    checkDirty();
  });

  currentContainer.querySelector('#checkbox-leave-paid')?.addEventListener('change', (e) => {
    state.leavePaid = !!e.target.checked;
    checkDirty();
    // Update notice text
    const labelP = e.target.closest('div')?.querySelector('p');
    if (labelP) {
      labelP.textContent = state.leavePaid
        ? 'يتم احتساب يوم الإجازة كساعات عمل رسمية معتمدة'
        : 'يوم الإجازة = 0 ساعة (بدون خصم وبدون رصيد إضافي)';
    }
  });

  // Late Counter Reset Segmented Buttons
  currentContainer.querySelectorAll('.segmented-btn[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-reset');
      state.lateCounterReset = mode;
      currentContainer.querySelectorAll('.segmented-btn[data-reset]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-reset') === mode);
      });
      checkDirty();
    });
  });

  // Add Late Rule
  currentContainer.querySelector('#btn-add-rule')?.addEventListener('click', () => {
    state.lateRules = state.lateRules || [];
    const newId = `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    state.lateRules.push({
      id: newId,
      type: 'late_x',
      factor: 2,
      hours: 0,
      label: 'ضعف التأخير (×2)'
    });
    checkDirty();
    refreshRulesList();
    updateSimulation();
  });

  // Simulated Arrival input
  currentContainer.querySelector('#input-sim-arrival')?.addEventListener('change', (e) => {
    simArrival = e.target.value || '08:10';
    updateSimulation();
  });

  // Export JSON
  currentContainer.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const dataStr = store.exportJSON();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.download = `dawam-db-backup-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    ui.toast('تم تصدير نسخة قاعدة البيانات بنجاح', 'success');
  });

  // Import JSON Trigger & File Handling
  const fileInput = currentContainer.querySelector('#input-import-file');
  currentContainer.querySelector('#btn-trigger-import')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await ui.confirm({
      title: t('settings.importJSON'),
      message: t('settings.importConfirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      danger: true
    });

    if (!confirmed) {
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      const res = store.importJSON(content);
      if (res.success) {
        ui.toast(t('settings.importSuccess'), 'success');
        originalSettings = store.getSettings();
        state = JSON.parse(JSON.stringify(originalSettings));
        isDirty = false;
        render();
      } else {
        ui.toast(`${t('settings.importFailed')}${res.error}`, 'error');
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  // GitHub Sync
  currentContainer.querySelector('#btn-sync-github')?.addEventListener('click', async () => {
    const owner = currentContainer.querySelector('#gh-owner')?.value?.trim();
    const repo = currentContainer.querySelector('#gh-repo')?.value?.trim();
    const path = currentContainer.querySelector('#gh-path')?.value?.trim() || 'data/db.json';
    const branch = currentContainer.querySelector('#gh-branch')?.value?.trim() || 'main';
    const token = currentContainer.querySelector('#gh-token')?.value?.trim();

    store.setGitHubConfig({ owner, repo, path, branch });
    store.setGitHubToken(token);

    if (!owner || !repo || !token) {
      ui.toast('يرجى ملء جميع حقول GitHub المطلوبة بما فيها رمز الوصول (Token)', 'error');
      return;
    }

    const syncBtn = currentContainer.querySelector('#btn-sync-github');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = `⏳ ${t('settings.ghSyncing')}`;

    const res = await store.syncToGitHub({ owner, repo, path, branch, token });
    syncBtn.disabled = false;
    syncBtn.innerHTML = originalText;

    if (res.success) {
      ui.toast(t('settings.ghSyncSuccess'), 'success');
    } else {
      ui.toast(`${t('settings.ghSyncFailed')}${res.message}`, 'error');
    }
  });

  // Weekend days toggles
  currentContainer.querySelectorAll('.btn-weekend-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayNum = parseInt(btn.dataset.day, 10);
      state.weekendDays = Array.isArray(state.weekendDays) ? state.weekendDays : [5];
      if (state.weekendDays.includes(dayNum)) {
        state.weekendDays = state.weekendDays.filter(d => d !== dayNum);
      } else {
        state.weekendDays.push(dayNum);
        state.weekendDays.sort((a, b) => a - b);
      }
      checkDirty();
      render();
    });
  });

  // Delete Sample Data button
  currentContainer.querySelector('#btn-delete-sample-data')?.addEventListener('click', async () => {
    const confirmed = await ui.confirm({
      title: t('settings.deleteSampleData') || 'حذف البيانات التجريبية',
      message: t('settings.deleteSampleConfirm') || 'هل أنت متأكد من حذف البيانات التجريبية (الموظفين الافتراضيين وسجلات حضورهم وجزاءاتهم)؟ لن تتأثر حسابات المستخدمين أو الموظفون الجدد أو الإعدادات.',
      confirmText: t('common.delete') || 'حذف',
      cancelText: t('common.cancel') || 'إلغاء',
      danger: true
    });

    if (!confirmed) return;

    const res = store.deleteSampleData();
    if (res.deletedEmployees > 0) {
      ui.toast(`تم حذف البيانات التجريبية بنجاح (${res.deletedEmployees} موظفاً، ${res.deletedAttendance} سجل حضور)`, 'success');
    } else {
      ui.toast('لم يتم العثور على أي بيانات تجريبية لحذفها', 'info');
    }
    render();
  });

  // Rules list interactions
  attachRuleItemListeners();

  // Users Management Section
  attachUsersListeners(currentSession);
}

function attachRuleItemListeners() {
  const container = currentContainer?.querySelector('#rules-list-container');
  if (!container) return;

  // Type change
  container.querySelectorAll('.rule-type-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      const newType = e.target.value;
      const r = state.lateRules[idx];
      if (!r) return;

      r.type = newType;
      if (newType === 'late_x') {
        r.factor = r.factor || 2;
        r.label = `ضعف التأخير (×${r.factor})`;
      } else if (newType === 'remaining_x') {
        r.factor = r.factor || 0.5;
        r.label = `نصف الوقت المتبقي (×${r.factor})`;
      } else if (newType === 'fixed_hours') {
        r.hours = r.hours || 1;
        r.label = `خصم ${r.hours} ساعة`;
      } else if (newType === 'full_day') {
        r.label = 'خصم يوم كامل';
      }

      checkDirty();
      refreshRulesList();
      updateSimulation();
    });
  });

  // Param input change
  container.querySelectorAll('.rule-param-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      const param = e.target.getAttribute('data-param');
      const val = parseFloat(e.target.value) || 0;
      const r = state.lateRules[idx];
      if (!r) return;

      r[param] = val;
      if (r.type === 'late_x') {
        r.label = `ضعف التأخير (×${val})`;
      } else if (r.type === 'remaining_x') {
        r.label = `الوقت المتبقي (×${val})`;
      } else if (r.type === 'fixed_hours') {
        r.label = `خصم ${val} ساعة`;
      }

      checkDirty();
      updateSimulation();
    });
  });

  // Move Up
  container.querySelectorAll('.btn-rule-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx > 0) {
        const temp = state.lateRules[idx];
        state.lateRules[idx] = state.lateRules[idx - 1];
        state.lateRules[idx - 1] = temp;
        checkDirty();
        refreshRulesList();
        updateSimulation();
      }
    });
  });

  // Move Down
  container.querySelectorAll('.btn-rule-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx < state.lateRules.length - 1) {
        const temp = state.lateRules[idx];
        state.lateRules[idx] = state.lateRules[idx + 1];
        state.lateRules[idx + 1] = temp;
        checkDirty();
        refreshRulesList();
        updateSimulation();
      }
    });
  });

  // Delete
  container.querySelectorAll('.btn-rule-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.lateRules.length <= 1) {
        ui.toast('يجب الإبقاء على قاعدة تأخير واحدة على الأقل', 'warning');
        return;
      }
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      state.lateRules.splice(idx, 1);
      checkDirty();
      refreshRulesList();
      updateSimulation();
    });
  });
}

function refreshRulesList() {
  const container = currentContainer?.querySelector('#rules-list-container');
  if (container) {
    container.innerHTML = renderRulesList();
    attachRuleItemListeners();
  }
}

function attachUsersListeners(currentSession) {
  if (!currentContainer) return;

  // Add User
  currentContainer.querySelector('#btn-add-user')?.addEventListener('click', () => {
    openAddUserModal();
  });

  // Edit Role
  currentContainer.querySelectorAll('.btn-edit-role').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id');
      const targetUser = store.get('users', userId);
      if (targetUser) openEditRoleModal(targetUser, currentSession);
    });
  });

  // Reset Password
  currentContainer.querySelectorAll('.btn-reset-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id');
      const targetUser = store.get('users', userId);
      if (targetUser) openResetPasswordModal(targetUser);
    });
  });

  // Delete User
  currentContainer.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-id');
      const targetUser = store.get('users', userId);
      if (!targetUser) return;

      const confirmed = await ui.confirm({
        title: t('users.deleteUser'),
        message: `${t('users.confirmDeleteUser')}\n(${targetUser.username})`,
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        danger: true
      });

      if (confirmed) {
        const res = auth.deleteUser(userId, currentSession?.id);
        if (res.success) {
          ui.toast(t('users.userDeleted'), 'success');
          render();
        } else {
          ui.toast(t(res.error) || res.error, 'error');
        }
      }
    });
  });
}

function openAddUserModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <form id="add-user-form" novalidate>
      <div class="form-group mb-3">
        <label class="form-label">${t('users.username')} *</label>
        <input type="text" id="new-user-name" class="input" required autocomplete="off" autofocus>
      </div>

      <div class="form-group mb-3">
        <label class="form-label">${t('auth.password')} *</label>
        <input type="password" id="new-user-pwd" class="input" minlength="6" required autocomplete="new-password">
        <small class="text-muted">${t('users.passwordRequired')}</small>
      </div>

      <div class="form-group mb-3">
        <label class="form-label">${t('users.role')} *</label>
        <select id="new-user-role" class="select">
          <option value="entry">${t('users.roleEntry')}</option>
          <option value="admin">${t('users.roleAdmin')}</option>
        </select>
      </div>

      <p class="text-muted" style="font-size: 0.8rem;">${t('users.mustChangeNotice')}</p>
      <div id="add-user-error" class="text-error mb-2" style="display: none;"></div>
    </form>
  `;

  const modalInstance = ui.modal({
    title: t('users.addUser'),
    content,
    actions: [
      { text: t('common.cancel') },
      {
        text: t('common.save'),
        primary: true,
        handler: async () => {
          const username = content.querySelector('#new-user-name')?.value?.trim();
          const password = content.querySelector('#new-user-pwd')?.value;
          const role = content.querySelector('#new-user-role')?.value;
          const errEl = content.querySelector('#add-user-error');

          errEl.style.display = 'none';

          if (!username) {
            errEl.textContent = t('users.usernameRequired');
            errEl.style.display = 'block';
            return;
          }

          if (!password || password.length < 6) {
            errEl.textContent = t('auth.passwordMinLength');
            errEl.style.display = 'block';
            return;
          }

          const res = await auth.addUser(username, password, role);
          if (res.success) {
            ui.toast(t('users.userAdded'), 'success');
            modalInstance.close();
            render();
          } else {
            errEl.textContent = t(res.error) || res.error;
            errEl.style.display = 'block';
          }
        }
      }
    ]
  });
}

function openEditRoleModal(targetUser, currentSession) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="mb-3">
      <p class="text-muted" style="font-size: 0.9rem;">
        المستخدم: <strong class="text-cyan">${escapeHtml(targetUser.username)}</strong>
      </p>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${t('users.role')}</label>
      <select id="edit-user-role-select" class="select">
        <option value="entry" ${targetUser.role === 'entry' ? 'selected' : ''}>${t('users.roleEntry')}</option>
        <option value="admin" ${targetUser.role === 'admin' ? 'selected' : ''}>${t('users.roleAdmin')}</option>
      </select>
    </div>
    <div id="edit-role-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: t('users.editRole'),
    content,
    actions: [
      { text: t('common.cancel') },
      {
        text: t('common.save'),
        primary: true,
        handler: () => {
          const newRole = content.querySelector('#edit-user-role-select')?.value;
          const errEl = content.querySelector('#edit-role-error');
          errEl.style.display = 'none';

          const res = auth.updateUserRole(targetUser.id, newRole, currentSession?.id);
          if (res.success) {
            ui.toast(t('users.roleUpdated'), 'success');
            modalInstance.close();
            render();
          } else {
            errEl.textContent = t(res.error) || res.error;
            errEl.style.display = 'block';
          }
        }
      }
    ]
  });
}

function openResetPasswordModal(targetUser) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="mb-3">
      <p class="text-muted" style="font-size: 0.9rem;">
        المستخدم: <strong class="text-cyan">${escapeHtml(targetUser.username)}</strong>
      </p>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${t('users.tempPassword')}</label>
      <input type="password" id="reset-user-pwd" class="input" minlength="6" required autocomplete="new-password">
      <small class="text-muted">${t('users.mustChangeNotice')}</small>
    </div>
    <div id="reset-pwd-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: t('users.resetPassword'),
    content,
    actions: [
      { text: t('common.cancel') },
      {
        text: t('common.confirm'),
        primary: true,
        handler: async () => {
          const tempPwd = content.querySelector('#reset-user-pwd')?.value;
          const errEl = content.querySelector('#reset-pwd-error');
          errEl.style.display = 'none';

          if (!tempPwd || tempPwd.length < 6) {
            errEl.textContent = t('auth.passwordMinLength');
            errEl.style.display = 'block';
            return;
          }

          const res = await auth.resetUserPassword(targetUser.id, tempPwd);
          if (res.success) {
            ui.toast(t('users.passwordReset'), 'success');
            modalInstance.close();
            render();
          } else {
            errEl.textContent = t(res.error) || res.error;
            errEl.style.display = 'block';
          }
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
