/**
 * Dawam - Application Entrypoint
 * Bootstraps i18n, store, router, service worker, and theme toggle.
 */

import * as store from './core/store.js';
import * as i18n from './core/i18n.js';
import * as auth from './core/auth.js';
import * as router from './core/router.js';
import * as ui from './core/ui.js';

// Import Page Modules
import * as loginPage from './pages/login.js';
import * as attendancePage from './pages/attendance.js';
import * as penaltiesPage from './pages/penalties.js';
import * as employeesPage from './pages/employees.js';
import * as settingsPage from './pages/settings.js';
import * as reportPage from './pages/report.js';

async function bootstrap() {
  // 1. Initialize Storage & Seed data
  await store.initStore();

  // 2. Initialize Translations
  await i18n.initI18n();

  // 3. Initialize Theme
  initTheme();

  // 4. Register Routes
  router.registerRoute('#login', loginPage);
  router.registerRoute('#attendance', attendancePage);
  router.registerRoute('#penalties', penaltiesPage);
  router.registerRoute('#employees', { ...employeesPage, roles: ['admin'] });
  router.registerRoute('#settings', { ...settingsPage, roles: ['admin'] });
  router.registerRoute('#report', reportPage);

  // 5. Setup UI Controls (Theme, Language, Logout, Mobile More Drawer)
  setupUIEventListeners();

  // 6. Start Routing
  router.initRouter();

  // 7. Register Service Worker for PWA
  registerServiceWorker();
}

/**
 * Sets up Theme handling (Dark default vs Light mode).
 */
function initTheme() {
  const savedTheme = localStorage.getItem('dawam_theme') || 'dark';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('dawam_theme', theme);
  updateThemeToggleLabels(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

function updateThemeToggleLabels(theme) {
  const isLight = theme === 'light';
  const labels = document.querySelectorAll('.theme-toggle-label');
  labels.forEach(el => {
    el.textContent = isLight ? '🌙' : '☀️';
  });
}

/**
 * Setup Header, Sidebar, and Mobile More controls.
 */
function setupUIEventListeners() {
  // Theme toggles
  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Language toggles
  document.querySelectorAll('[data-action="toggle-lang"]').forEach(btn => {
    btn.addEventListener('click', () => {
      i18n.toggleLang();
      updateLangToggleLabels();
    });
  });

  // Change own password buttons (desktop header & sidebar)
  document.querySelectorAll('[data-action="change-own-pwd"]').forEach(btn => {
    btn.addEventListener('click', showChangeOwnPasswordModal);
  });

  // Logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await ui.confirm({
        title: i18n.t('nav.logout'),
        message: 'هل تريد بالتأكيد تسجيل الخروج من دوام؟',
        confirmText: i18n.t('nav.logout'),
        cancelText: i18n.t('common.cancel'),
        danger: true
      });
      if (confirmed) {
        auth.logout();
      }
    });
  });

  // Mobile More tab trigger
  const moreTab = document.getElementById('tab-more');
  if (moreTab) {
    moreTab.addEventListener('click', (e) => {
      e.preventDefault();
      showMobileMoreModal();
    });
  }

  // Update labels initially
  updateLangToggleLabels();
}

function updateLangToggleLabels() {
  const currentLang = i18n.getLang();
  document.querySelectorAll('.lang-toggle-label').forEach(el => {
    el.textContent = currentLang === 'ar' ? 'English' : 'العربية';
  });
}

/**
 * Opens "More" options modal on mobile (< 768px).
 */
function showMobileMoreModal() {
  const session = auth.getSession();
  const isAdmin = session?.role === 'admin';

  const content = document.createElement('div');
  content.className = 'mobile-more-menu';
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${isAdmin ? `
        <a href="#employees" class="btn btn-secondary more-item" style="justify-content: flex-start;">
          <span>👥</span> <span data-i18n="nav.employees">${i18n.t('nav.employees')}</span>
        </a>
        <a href="#settings" class="btn btn-secondary more-item" style="justify-content: flex-start;">
          <span>⚙️</span> <span data-i18n="nav.settings">${i18n.t('nav.settings')}</span>
        </a>
      ` : ''}
      <button type="button" class="btn btn-secondary" id="more-change-pwd" style="justify-content: flex-start;">
        <span>🔑</span> <span data-i18n="auth.changeMyPassword">${i18n.t('auth.changeMyPassword')}</span>
      </button>
      <button type="button" class="btn btn-secondary" id="more-toggle-theme" style="justify-content: flex-start;">
        <span class="theme-toggle-label">☀️</span>
        <span data-i18n="theme.toggle">${i18n.t('theme.toggle')}</span>
      </button>
      <button type="button" class="btn btn-secondary" id="more-toggle-lang" style="justify-content: flex-start;">
        <span>🌐</span>
        <span class="lang-toggle-label">${i18n.getLang() === 'ar' ? 'English' : 'العربية'}</span>
      </button>
      <button type="button" class="btn btn-danger" id="more-logout" style="justify-content: flex-start; margin-top: 0.5rem;">
        <span>🚪</span> <span data-i18n="nav.logout">${i18n.t('nav.logout')}</span>
      </button>
    </div>
  `;

  const modalInstance = ui.modal({
    title: i18n.t('nav.more'),
    content,
    buttons: [
      {
        label: i18n.t('common.close'),
        class: 'btn-secondary',
        onClick: () => modalInstance.close()
      }
    ]
  });

  content.querySelectorAll('.more-item').forEach(link => {
    link.addEventListener('click', () => modalInstance.close());
  });

  content.querySelector('#more-change-pwd')?.addEventListener('click', () => {
    modalInstance.close();
    showChangeOwnPasswordModal();
  });

  content.querySelector('#more-toggle-theme')?.addEventListener('click', () => {
    toggleTheme();
  });

  content.querySelector('#more-toggle-lang')?.addEventListener('click', () => {
    i18n.toggleLang();
    updateLangToggleLabels();
    modalInstance.close();
  });

  content.querySelector('#more-logout')?.addEventListener('click', async () => {
    modalInstance.close();
    const confirmed = await ui.confirm({
      title: i18n.t('nav.logout'),
      message: 'هل تريد بالتأكيد تسجيل الخروج من دوام؟',
      confirmText: i18n.t('nav.logout'),
      cancelText: i18n.t('common.cancel'),
      danger: true
    });
    if (confirmed) {
      auth.logout();
    }
  });
}

/**
 * Shows "Change my password" modal for any logged-in user.
 * Verifies current password before applying new password.
 */
function showChangeOwnPasswordModal() {
  const session = auth.getSession();
  if (!session) return;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group mb-3">
      <label class="form-label">${i18n.t('auth.currentPassword')}</label>
      <input type="password" id="own-current-pwd" class="input" required autocomplete="current-password" autofocus>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${i18n.t('auth.newPassword')}</label>
      <input type="password" id="own-new-pwd" class="input" minlength="6" required autocomplete="new-password">
      <small class="text-muted">${i18n.t('auth.passwordMinLength')}</small>
    </div>
    <div class="form-group mb-3">
      <label class="form-label">${i18n.t('auth.confirmPassword')}</label>
      <input type="password" id="own-confirm-pwd" class="input" minlength="6" required autocomplete="new-password">
    </div>
    <div id="own-pwd-error" class="text-error mb-2" style="display: none;"></div>
  `;

  const modalInstance = ui.modal({
    title: i18n.t('auth.changeMyPassword'),
    content,
    buttons: [
      {
        label: i18n.t('common.cancel'),
        class: 'btn-secondary',
        onClick: () => modalInstance.close()
      },
      {
        label: i18n.t('common.save'),
        class: 'btn-primary',
        onClick: async () => {
          const currentPwd = content.querySelector('#own-current-pwd').value;
          const newPwd = content.querySelector('#own-new-pwd').value;
          const confirmPwd = content.querySelector('#own-confirm-pwd').value;
          const errEl = content.querySelector('#own-pwd-error');
          errEl.style.display = 'none';

          if (!currentPwd) {
            errEl.textContent = i18n.t('auth.currentPasswordIncorrect');
            errEl.style.display = 'block';
            return;
          }
          if (!newPwd || newPwd.length < 6) {
            errEl.textContent = i18n.t('auth.passwordMinLength');
            errEl.style.display = 'block';
            return;
          }
          if (newPwd !== confirmPwd) {
            errEl.textContent = i18n.t('auth.passwordsDoNotMatch');
            errEl.style.display = 'block';
            return;
          }

          const res = await auth.changeOwnPassword(session.id, currentPwd, newPwd);
          if (res.success) {
            ui.toast(i18n.t('toast.saved'), 'success');
            modalInstance.close();
          } else {
            errEl.textContent = i18n.t(res.error) || res.error;
            errEl.style.display = 'block';
          }
        }
      }
    ]
  });
}

/**
 * Service Worker Registration for PWA.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    const doRegister = () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
        console.log('Dawam ServiceWorker registered successfully:', reg.scope);
      }).catch((err) => {
        console.warn('Dawam ServiceWorker registration failed:', err);
      });
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }
}

// Start Application
window.addEventListener('DOMContentLoaded', bootstrap);
