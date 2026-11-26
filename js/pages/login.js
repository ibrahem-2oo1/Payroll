/**
 * Dawam - Login Page Controller
 */

import * as auth from '../core/auth.js';
import * as ui from '../core/ui.js';
import { t } from '../core/i18n.js';

export function mount(container) {
  container.innerHTML = `
    <div class="card card-neon login-card" style="max-width: 400px; width: 100%; margin: 2rem auto;">
      <div class="card-header text-center" style="display: block; border-bottom: none; padding-bottom: 0;">
        <div class="brand-icon" style="width: 48px; height: 48px; font-size: 1.5rem; margin: 0 auto 0.75rem;">د</div>
        <h2 class="card-title text-cyan" data-i18n="auth.title" style="font-size: 1.4rem;">${t('auth.title')}</h2>
        <p class="text-muted" data-i18n="app.subtitle" style="font-size: 0.85rem;">${t('app.subtitle')}</p>
      </div>

      <form id="login-form" class="card-body">
        <div class="form-group mb-3">
          <label class="form-label" data-i18n="auth.username">${t('auth.username')}</label>
          <input type="text" id="login-username" class="input" required autocomplete="username" autofocus>
        </div>

        <div class="form-group mb-3">
          <label class="form-label" data-i18n="auth.password">${t('auth.password')}</label>
          <input type="password" id="login-password" class="input" required autocomplete="current-password">
        </div>

        <div id="login-error" class="text-error mb-3" style="display: none;"></div>

        <button type="submit" class="btn btn-primary" style="width: 100%;">
          <span data-i18n="auth.submit">${t('auth.submit')}</span>
        </button>

        <div class="text-center mt-3" style="margin-top: 1rem;">
          <small class="text-muted">الافتراضي التجريبي: admin / admin123</small>
        </div>
      </form>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const errEl = container.querySelector('#login-error');

  const handleSubmit = async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';

    const username = container.querySelector('#login-username').value;
    const password = container.querySelector('#login-password').value;

    const res = await auth.login(username, password);
    if (res.success) {
      ui.toast(t('toast.saved'), 'success');
      window.location.hash = '#attendance';
    } else {
      errEl.textContent = t(res.error) || 'خطأ في اسم المستخدم أو كلمة المرور';
      errEl.style.display = 'block';
    }
  };

  form.addEventListener('submit', handleSubmit);

  return () => {
    form.removeEventListener('submit', handleSubmit);
  };
}
