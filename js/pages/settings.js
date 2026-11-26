/**
 * Dawam - Settings Page Controller
 * Includes Official Hours (Phase 2 preview) and Users & Access Control (Phase 1).
 * Strictly for Admin role. All data operations strictly through store.js and auth.js.
 */

import { t } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as auth from '../core/auth.js';
import * as ui from '../core/ui.js';

let currentContainer = null;

export function mount(container) {
  currentContainer = container;
  render();

  const handleDataChange = () => {
    if (document.body.contains(currentContainer)) {
      render();
    }
  };

  window.addEventListener('dawam:datachange', handleDataChange);
  return () => {
    window.removeEventListener('dawam:datachange', handleDataChange);
  };
}

function render() {
  if (!currentContainer) return;

  const settings = store.getSettings();
  const users = store.list('users');
  const currentSession = auth.getSession();
  const adminCount = users.filter(u => u.role === 'admin').length;

  currentContainer.innerHTML = `
    <div class="page-header mb-3">
      <h2 class="page-title text-cyan" data-i18n="settings.title" style="font-size: 1.5rem;">${t('settings.title')}</h2>
      <p class="text-muted" style="font-size: 0.875rem;">إدارة المستخدمين والصلاحيات واللوائح التنظيمية</p>
    </div>

    <!-- Users Management Section (Admin Only) -->
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

    <!-- Official Hours Settings (Overview - Phase 2 will provide full editor) -->
    <div class="card card-neon mb-3">
      <div class="card-header">
        <h3 class="card-title text-cyan" data-i18n="settings.officialHours">⏰ ${t('settings.officialHours')}</h3>
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

  attachEventListeners();
}

function attachEventListeners() {
  if (!currentContainer) return;

  const currentSession = auth.getSession();

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

/**
 * Modal to add a new user.
 */
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
    buttons: [
      {
        label: t('common.cancel'),
        class: 'btn-secondary',
        onClick: () => modalInstance.close()
      },
      {
        label: t('common.save'),
        class: 'btn-primary',
        onClick: async () => {
          const username = content.querySelector('#new-user-name').value.trim();
          const password = content.querySelector('#new-user-pwd').value;
          const role = content.querySelector('#new-user-role').value;
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

          const res = await auth.createUser({ username, password, role });
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

/**
 * Modal to edit user role with last-admin guard.
 */
function openEditRoleModal(targetUser, currentSession) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="mb-3">
      <p><strong>${t('users.username')}:</strong> ${escapeHtml(targetUser.username)}</p>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${t('users.role')} *</label>
      <select id="edit-user-role" class="select">
        <option value="entry" ${targetUser.role === 'entry' ? 'selected' : ''}>${t('users.roleEntry')}</option>
        <option value="admin" ${targetUser.role === 'admin' ? 'selected' : ''}>${t('users.roleAdmin')}</option>
      </select>
    </div>
    <div id="edit-role-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: t('users.editRole'),
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
          const newRole = content.querySelector('#edit-user-role').value;
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

/**
 * Modal to reset a user's password.
 */
function openResetPasswordModal(targetUser) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="mb-3">
      <p><strong>${t('users.username')}:</strong> ${escapeHtml(targetUser.username)}</p>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${t('users.tempPassword')} *</label>
      <input type="password" id="reset-user-pwd" class="input" minlength="6" required autocomplete="new-password" autofocus>
      <small class="text-muted">${t('users.passwordRequired')}</small>
    </div>
    <p class="text-muted" style="font-size: 0.8rem;">${t('users.mustChangeNotice')}</p>
    <div id="reset-pwd-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: t('users.resetPassword'),
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
        onClick: async () => {
          const tempPwd = content.querySelector('#reset-user-pwd').value;
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
