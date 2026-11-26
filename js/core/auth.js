/**
 * Dawam - Authentication & Authorization
 * Salted SHA-256 using Web Crypto API.
 * Session maintained in sessionStorage.
 */

import * as store from './store.js';

const SESSION_KEY = 'dawam_session';

/**
 * Generates a random cryptographic hex salt.
 * @returns {string}
 */
export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a password with a given salt using SHA-256.
 * @param {string} password
 * @param {string} salt
 * @returns {Promise<string>}
 */
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Logs in a user.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function login(username, password) {
  if (!username || !password) {
    return { success: false, error: 'auth.loginFailed' };
  }

  const users = store.list('users');
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user) {
    return { success: false, error: 'auth.loginFailed' };
  }

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.hash) {
    return { success: false, error: 'auth.loginFailed' };
  }

  const sessionUser = {
    id: user.id,
    username: user.username,
    role: user.role || 'entry',
    mustChange: !!user.mustChange
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  window.dispatchEvent(new CustomEvent('dawam:authchange', { detail: { user: sessionUser } }));
  return { success: true, user: sessionUser };
}

/**
 * Returns current authenticated user session or null.
 * @returns {object|null}
 */
export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns true if user is logged in.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getSession();
}

/**
 * Returns true if logged in user is admin.
 * @returns {boolean}
 */
export function isAdmin() {
  const user = getSession();
  return user?.role === 'admin';
}

/**
 * Checks if user has specific role or admin.
 * @param {'admin'|'entry'} role
 * @returns {boolean}
 */
export function hasRole(role) {
  const user = getSession();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === role;
}

/**
 * Logs out the current user.
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('dawam:authchange', { detail: { user: null } }));
  window.location.hash = '#login';
}

/**
 * Changes a user's password and clears mustChange flag.
 * @param {string} userId
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function changePassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'auth.passwordMinLength' };
  }

  const user = store.get('users', userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  store.update('users', userId, {
    salt: newSalt,
    hash: newHash,
    mustChange: false
  });

  const session = getSession();
  if (session && session.id === userId) {
    session.mustChange = false;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('dawam:authchange', { detail: { user: session } }));
  }

  return { success: true };
}
