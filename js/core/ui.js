/**
 * Dawam - UI Feedback & Dialog System
 * Neon cyber toast, modal, and confirm components.
 */

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Displays a neon cyber toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 * @param {number} [duration=3000]
 */
export function toast(message, type = 'info', duration = 3000) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  el.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  const dismiss = () => {
    el.classList.add('toast-leaving');
    el.addEventListener('animationend', () => {
      el.remove();
    });
  };

  el.querySelector('.toast-close').addEventListener('click', dismiss);
  el.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') dismiss();
  });

  container.appendChild(el);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

/**
 * Displays an accessible neon cyber confirm dialog.
 * @param {object} options
 * @param {string} [options.title='Confirm']
 * @param {string} options.message
 * @param {string} [options.confirmText='Confirm']
 * @param {string} [options.cancelText='Cancel']
 * @param {boolean} [options.danger=false]
 * @returns {Promise<boolean>}
 */
export function confirm({
  title = '',
  message = '',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  danger = false
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="modal-card confirm-card ${danger ? 'confirm-danger' : ''}">
        ${title ? `<div class="modal-header"><h3 class="modal-title">${escapeHtml(title)}</h3></div>` : ''}
        <div class="modal-body">
          <p class="confirm-message">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };

    overlay.querySelector('.btn-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('.btn-confirm').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);

    // Focus confirm or cancel
    setTimeout(() => {
      const targetBtn = danger ? overlay.querySelector('.btn-cancel') : overlay.querySelector('.btn-confirm');
      if (targetBtn) targetBtn.focus();
    }, 50);
  });
}

/**
 * Displays a general-purpose modal dialog.
 * @param {object} options
 * @param {string} options.title
 * @param {string|HTMLElement} options.content
 * @param {Array<{ label: string, class?: string, onClick: Function }>} [options.buttons=[]]
 * @param {Function} [options.onClose]
 * @returns {{ close: Function, setContent: Function, getElement: Function }}
 */
export function modal({ title = '', content = '', buttons = [], onClose = null }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'modal-card';

  card.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body"></div>
    ${buttons.length > 0 ? '<div class="modal-footer"></div>' : ''}
  `;

  const bodyEl = card.querySelector('.modal-body');
  if (typeof content === 'string') {
    bodyEl.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    bodyEl.appendChild(content);
  }

  const footerEl = card.querySelector('.modal-footer');
  if (footerEl) {
    buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${btnConfig.class || 'btn-secondary'}`;
      btn.textContent = btnConfig.label;
      btn.addEventListener('click', (e) => {
        if (btnConfig.onClick) btnConfig.onClick(e, instance);
      });
      footerEl.appendChild(btn);
    });
  }

  overlay.appendChild(card);

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 200);
    if (onClose) onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };

  card.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);

  const instance = {
    close,
    setContent: (newContent) => {
      if (typeof newContent === 'string') {
        bodyEl.innerHTML = newContent;
      } else if (newContent instanceof HTMLElement) {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(newContent);
      }
    },
    getElement: () => overlay
  };

  return instance;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
