/**
 * Dawam - Authentication & Authorization
 * Salted SHA-256 using Web Crypto API.
 * Session maintained in sessionStorage.
 * All persistent data operations strictly through store.js.
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
  const cleanUsername = username?.trim().toLowerCase();
  if (!cleanUsername || !password) {
    return { success: false, error: 'auth.loginFailed' };
  }

  const users = store.list('users');
  const user = users.find(u => u.username.trim().toLowerCase() === cleanUsername);

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
 * Checks if user has specific role or is admin.
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
 * Changes a user's password and clears mustChange flag (used for forced first login).
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

/**
 * Allows any logged-in user to change their own password, requiring current password verification.
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function changeOwnPassword(userId, currentPassword, newPassword) {
  if (!currentPassword) {
    return { success: false, error: 'auth.currentPasswordIncorrect' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'auth.passwordMinLength' };
  }

  const user = store.get('users', userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const currentComputedHash = await hashPassword(currentPassword, user.salt);
  if (currentComputedHash !== user.hash) {
    return { success: false, error: 'auth.currentPasswordIncorrect' };
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
  }

  return { success: true };
}

/**
 * Creates a new user with unique username and salted password.
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.password
 * @param {'admin'|'entry'} params.role
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function createUser({ username, password, role = 'entry' }) {
  const cleanUsername = username?.trim();
  if (!cleanUsername) {
    return { success: false, error: 'users.usernameRequired' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'auth.passwordMinLength' };
  }

  // Case-insensitive uniqueness check
  const users = store.list('users');
  const exists = users.some(u => u.username.trim().toLowerCase() === cleanUsername.toLowerCase());
  if (exists) {
    return { success: false, error: 'users.usernameExists' };
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  const newUser = store.insert('users', {
    username: cleanUsername,
    salt,
    hash,
    role: role === 'admin' ? 'admin' : 'entry',
    mustChange: true
  });

  return { success: true, user: newUser };
}

/**
 * Updates a user's role with protection guards.
 * @param {string} targetUserId
 * @param {'admin'|'entry'} newRole
 * @param {string} currentUserId
 * @returns {{ success: boolean, error?: string }}
 */
export function updateUserRole(targetUserId, newRole, currentUserId) {
  if (targetUserId === currentUserId) {
    return { success: false, error: 'users.cannotChangeOwnRole' };
  }

  const target = store.get('users', targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  // Guard: Cannot demote the last remaining admin
  if (target.role === 'admin' && newRole !== 'admin') {
    const adminCount = store.list('users').filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: 'users.cannotDemoteLastAdmin' };
    }
  }

  store.update('users', targetUserId, { role: newRole });
  return { success: true };
}

/**
 * Resets a user's password (by admin) and flags mustChange: true.
 * @param {string} targetUserId
 * @param {string} tempPassword
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function resetUserPassword(targetUserId, tempPassword) {
  if (!tempPassword || tempPassword.length < 6) {
    return { success: false, error: 'auth.passwordMinLength' };
  }

  const target = store.get('users', targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(tempPassword, newSalt);

  store.update('users', targetUserId, {
    salt: newSalt,
    hash: newHash,
    mustChange: true
  });

  return { success: true };
}

/**
 * Deletes a user with protection guards (cannot delete self, cannot delete last admin).
 * @param {string} targetUserId
 * @param {string} currentUserId
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteUser(targetUserId, currentUserId) {
  if (targetUserId === currentUserId) {
    return { success: false, error: 'users.cannotDeleteSelf' };
  }

  const target = store.get('users', targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  // Guard: Cannot delete the last admin
  if (target.role === 'admin') {
    const adminCount = store.list('users').filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      return { success: false, error: 'users.cannotDeleteLastAdmin' };
    }
  }

  store.remove('users', targetUserId);
  return { success: true };
}
