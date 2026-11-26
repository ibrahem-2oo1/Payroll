/**
 * Dawam - Client Router
 * Manages hash routing (#attendance, #penalties, #employees, #settings, #report, #login).
 * Enforces role guards and updates navigation state.
 */

import * as auth from './auth.js';
import * as ui from './ui.js';
import { t } from './i18n.js';

const routes = {};
let currentRoute = '';
let currentCleanup = null;
let beforeNavigateHandler = null;

/**
 * Registers a route handler.
 * @param {string} path e.g. '#attendance'
 * @param {{ mount: Function, cleanup?: Function, roles?: string[] }} handler
 */
export function registerRoute(path, handler) {
  routes[path] = handler;
}

/**
 * Sets a before-navigate hook that can cancel or prompt before leaving.
 * @param {((toHash: string) => Promise<boolean>|boolean)|null} fn
 */
export function setBeforeNavigate(fn) {
  beforeNavigateHandler = fn;
}

/**
 * Resolves current hash route and handles navigation.
 */
export async function handleRoute() {
  let hash = window.location.hash.split('?')[0] || '';
  if (!hash || hash === '#') {
    hash = '#attendance';
  }

  // 0. Check beforeNavigate guard if leaving current route
  if (currentRoute && hash !== currentRoute && typeof beforeNavigateHandler === 'function') {
    const canLeave = await beforeNavigateHandler(hash);
    if (!canLeave) {
      window.removeEventListener('hashchange', handleRoute);
      window.location.hash = currentRoute;
      setTimeout(() => window.addEventListener('hashchange', handleRoute), 50);
      return;
    }
    beforeNavigateHandler = null;
  }

  // 1. Guard authentication
  const session = auth.getSession();
  if (!session && hash !== '#login') {
    window.location.hash = '#login';
    return;
  }

  if (session && hash === '#login') {
    window.location.hash = '#attendance';
    return;
  }

  // 2. Check mustChange password
  if (session?.mustChange && hash !== '#login') {
    showForcePasswordChangeModal(session);
  }

  // 3. Guard roles
  const handler = routes[hash];
  if (handler?.roles && !handler.roles.includes(session?.role)) {
    ui.toast(t('auth.unauthorized'), 'warning');
    window.location.hash = '#attendance';
    return;
  }

  // 4. Cleanup previous route
  if (currentCleanup && typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (e) {
      console.warn('Error during route cleanup:', e);
    }
    currentCleanup = null;
  }

  currentRoute = hash;
  updateNavUI(hash, session);

  // 5. Mount new route
  const mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  if (handler && typeof handler.mount === 'function') {
    try {
      currentCleanup = await handler.mount(mainEl) || null;
    } catch (err) {
      console.error(`Error mounting route ${hash}:`, err);
      mainEl.innerHTML = `<div class="card card-neon"><p class="text-error">حدث خطأ أثناء تحميل الصفحة: ${err.message}</p></div>`;
    }
  } else {
    mainEl.innerHTML = `
      <div class="card card-neon text-center" style="padding: 2.5rem 1rem;">
        <h2 style="color: var(--neon-cyan); margin-bottom: 0.5rem;">${escapeHtml(hash.replace('#', '').toUpperCase())}</h2>
        <p class="text-muted">${t('common.loading')}</p>
      </div>
    `;
  }
}

/**
 * Updates UI navigation active indicators and visibility by role.
 * @param {string} activeHash
 * @param {object|null} session
 */
export function updateNavUI(activeHash, session) {
  // Update nav links
  const links = document.querySelectorAll('[data-route]');
  links.forEach(link => {
    const route = link.getAttribute('data-route');
    const isMatch = route === activeHash;
    link.classList.toggle('active', isMatch);
    link.setAttribute('aria-current', isMatch ? 'page' : 'false');

    // Role check for links
    const allowedRoles = link.getAttribute('data-roles');
    if (allowedRoles) {
      const allowed = allowedRoles.split(',').map(r => r.trim());
      const isAllowed = session && (allowed.includes(session.role) || session.role === 'admin');
      const targetEl = link.closest('li') || link;
      targetEl.style.display = isAllowed ? '' : 'none';
    }
  });

  // Toggle app layout if on login page vs dashboard
  const appContainer = document.querySelector('.app-shell');
  if (appContainer) {
    if (activeHash === '#login') {
      appContainer.classList.add('is-login-screen');
    } else {
      appContainer.classList.remove('is-login-screen');
    }
  }

  // Update user badge and change password buttons
  const userBadge = document.getElementById('user-badge');
  const changePwdBtns = document.querySelectorAll('[data-action="change-own-pwd"]');
  if (session) {
    if (userBadge) {
      userBadge.textContent = `${session.username} (${session.role === 'admin' ? t('users.roleAdminShort') : t('users.roleEntryShort')})`;
      userBadge.style.display = 'inline-flex';
    }
    changePwdBtns.forEach(btn => btn.style.display = '');
  } else {
    if (userBadge) userBadge.style.display = 'none';
    changePwdBtns.forEach(btn => btn.style.display = 'none');
  }
}

/**
 * Forces password change for users with mustChange = true.
 */
function showForcePasswordChangeModal(session) {
  if (document.getElementById('force-change-pwd-modal')) return;

  const content = document.createElement('div');
  content.id = 'force-change-pwd-modal';
  content.innerHTML = `
    <p class="text-warning mb-3">${t('auth.mustChangePassword')}</p>
    <div class="form-group mb-3">
      <label class="form-label">${t('auth.newPassword')}</label>
      <input type="password" id="force-new-pwd" class="input input-neon" minlength="6" required>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${t('auth.confirmPassword')}</label>
      <input type="password" id="force-confirm-pwd" class="input input-neon" minlength="6" required>
    </div>
    <div id="force-pwd-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: t('auth.changePassword'),
    content,
    buttons: [
      {
        label: t('common.save'),
        class: 'btn-primary',
        onClick: async () => {
          const newPwd = content.querySelector('#force-new-pwd').value;
          const confirmPwd = content.querySelector('#force-confirm-pwd').value;
          const errEl = content.querySelector('#force-pwd-error');

          if (!newPwd || newPwd.length < 6) {
            errEl.textContent = t('auth.passwordMinLength');
            errEl.style.display = 'block';
            return;
          }
          if (newPwd !== confirmPwd) {
            errEl.textContent = t('auth.passwordsDoNotMatch');
            errEl.style.display = 'block';
            return;
          }

          const res = await auth.changePassword(session.id, newPwd);
          if (res.success) {
            ui.toast(t('toast.saved'), 'success');
            modalInstance.close();
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
 * Starts routing listener.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('dawam:authchange', handleRoute);
  handleRoute();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
