// ===== Authentication Module =====
import { openDB, generateId, addRecord, getByIndex } from './db.js';

const SESSION_KEY = 'fintrack_session';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'fintrack_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function register(displayName, username, password) {
  const existing = await getByIndex('users', 'username', username.toLowerCase());
  if (existing) {
    throw new Error('Username already taken');
  }

  const passwordHash = await hashPassword(password);
  const user = {
    id: generateId(),
    username: username.toLowerCase(),
    displayName: displayName.trim(),
    passwordHash,
    currency: '₹',
    createdAt: Date.now(),
  };

  await addRecord('users', user);
  setSession(user);
  return user;
}

async function login(username, password) {
  const user = await getByIndex('users', 'username', username.toLowerCase());
  if (!user) {
    throw new Error('User not found');
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    throw new Error('Invalid password');
  }

  setSession(user);
  return user;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
}

function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    currency: user.currency,
  }));
}

function getSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export { register, login, logout, getSession };
