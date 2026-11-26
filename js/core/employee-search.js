/**
 * Dawam - Reusable Employee Search Component
 * Provides instant search by employee name or badge number with keyboard navigation.
 * Reusable across Attendance (Phase 3) and Penalties (Phase 4).
 * Strictly filters active employees by default.
 */

import { t } from './i18n.js';
import * as store from './store.js';

/**
 * Creates and mounts an EmployeeSearch component instance into the target container.
 * @param {HTMLElement} container
 * @param {object} options
 * @param {(employee: object) => void} options.onSelect
 * @param {() => void} [options.onClear]
 * @param {string} [options.placeholder]
 * @param {boolean} [options.filterActiveOnly=true]
 * @returns {object} API: { setEmployee, clear, focus, getSelected, destroy }
 */
export function createEmployeeSearch(container, options = {}) {
  const {
    onSelect = () => {},
    onClear = () => {},
    placeholder = t('common.search'),
    filterActiveOnly = true
  } = options;

  let selectedEmployee = null;
  let activeIndex = -1;
  let currentSuggestions = [];

  function renderEmpty() {
    container.innerHTML = `
      <div class="search-wrapper">
        <input 
          type="text" 
          class="input employee-search-input font-num" 
          placeholder="${placeholder}"
          autocomplete="off" 
          spellcheck="false"
          autofocus
        >
        <ul class="suggestions-dropdown" style="display: none;"></ul>
      </div>
    `;

    const input = container.querySelector('.employee-search-input');
    const dropdown = container.querySelector('.suggestions-dropdown');

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (!query) {
        dropdown.style.display = 'none';
        currentSuggestions = [];
        activeIndex = -1;
        return;
      }

      const allEmployees = store.list('employees');
      currentSuggestions = allEmployees.filter(e => {
        if (filterActiveOnly && e.active === false) return false;
        const nameMatch = e.name && e.name.toLowerCase().includes(query);
        const badgeMatch = e.badge && String(e.badge).toLowerCase().includes(query);
        return nameMatch || badgeMatch;
      }).slice(0, 10);

      activeIndex = -1;
      renderDropdown(dropdown, currentSuggestions);
    });

    input.addEventListener('keydown', (e) => {
      if (dropdown.style.display === 'none' || currentSuggestions.length === 0) {
        return;
      }

      const items = dropdown.querySelectorAll('.suggestion-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % currentSuggestions.length;
        updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
        updateActiveItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pickIndex = activeIndex >= 0 ? activeIndex : 0;
        if (currentSuggestions[pickIndex]) {
          select(currentSuggestions[pickIndex]);
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        activeIndex = -1;
      }
    });

    const handleDocumentClick = (e) => {
      if (!container.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', handleDocumentClick);

    container._cleanupDocClick = () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }

  function renderDropdown(dropdown, suggestions) {
    if (suggestions.length === 0) {
      dropdown.innerHTML = `
        <li class="suggestion-item text-muted" style="cursor: default; pointer-events: none;">
          ${t('employees.noEmployees')}
        </li>
      `;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = suggestions.map((e, idx) => `
      <li class="suggestion-item" data-idx="${idx}">
        <div>
          <strong>${escapeHtml(e.name)}</strong>
          <span class="badge badge-leave font-num" style="margin-inline-start: 0.5rem; font-size: 0.72rem;">#${escapeHtml(e.badge)}</span>
        </div>
        <small class="text-muted">${escapeHtml(e.department || '')}</small>
      </li>
    `).join('');

    dropdown.querySelectorAll('.suggestion-item[data-idx]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        if (suggestions[idx]) {
          select(suggestions[idx]);
        }
      });
    });

    dropdown.style.display = 'block';
  }

  function updateActiveItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function renderSelected(employee) {
    container.innerHTML = `
      <div class="employee-selected-card card p-2" style="background: var(--bg-surface-elevated); border: 1px solid var(--neon-cyan); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">👤</span>
          <strong class="text-cyan" style="font-size: 1.05rem;">${escapeHtml(employee.name)}</strong>
          <span class="badge badge-leave font-num" style="font-size: 0.8rem;">#${escapeHtml(employee.badge)}</span>
          <span class="text-muted" style="font-size: 0.825rem;">(${escapeHtml(employee.department || '—')})</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-clear-employee" title="${t('common.cancel')}">
          ✕ <span style="font-size: 0.8rem;">${t('common.cancel')}</span>
        </button>
      </div>
    `;

    container.querySelector('.btn-clear-employee')?.addEventListener('click', () => {
      clear();
      onClear();
    });
  }

  function select(employee) {
    selectedEmployee = employee;
    renderSelected(employee);
    onSelect(employee);
  }

  function clear() {
    selectedEmployee = null;
    activeIndex = -1;
    currentSuggestions = [];
    if (container._cleanupDocClick) {
      container._cleanupDocClick();
    }
    renderEmpty();
    focus();
  }

  function setEmployee(employee) {
    if (!employee) {
      clear();
      return;
    }
    selectedEmployee = employee;
    renderSelected(employee);
  }

  function focus() {
    const input = container.querySelector('.employee-search-input');
    if (input) {
      input.focus();
    }
  }

  function getSelected() {
    return selectedEmployee;
  }

  function destroy() {
    if (container._cleanupDocClick) {
      container._cleanupDocClick();
    }
    container.innerHTML = '';
  }

  // Initial render
  renderEmpty();

  return {
    setEmployee,
    clear,
    focus,
    getSelected,
    destroy
  };
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
