const TOKEN_KEY = 'pollmaster_admin_token';
const USER_KEY = 'pollmaster_admin_user';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('pollmaster_auth_token') || null;
  } catch (e) {
    return null;
  }
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setAuthSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('pollmaster_auth_token', token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save auth session:', e);
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('pollmaster_auth_token');
    localStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
}

export async function loginAdmin(identifier, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Authentication failed. Check your credentials.');
  }

  setAuthSession(data.token, data.user);
  return data;
}

export async function fetchCurrentAdmin() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearAuthSession();
      return null;
    }
    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
  } catch (e) {
    console.warn('Failed to verify current user session:', e);
  }
  return null;
}
