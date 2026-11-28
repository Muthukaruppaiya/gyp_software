const TOKEN_KEY = 'gym_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (options.raw) {
    if (!res.ok) throw new Error('Request failed');
    return res;
  }

  const data = await res.json().catch(() => ({}));

  // Session expired, account deleted, or deactivated by the owner: sign out instead of
  // leaving the user on a page where every request fails.
  const sessionDead =
    res.status === 401 || (res.status === 403 && ['ACCOUNT_DEACTIVATED', 'GYM_SUSPENDED'].includes(data.code));
  if (token && sessionDead && !path.startsWith('/auth/')) {
    setToken(null);
    const adminArea = window.location.pathname.startsWith('/admin');
    const target = adminArea ? import.meta.env.VITE_ADMIN_LOGIN_PATH || '/platform-console' : '/login';
    if (window.location.pathname !== target) window.location.assign(target);
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** 'YYYY-MM-DD' in the browser's local timezone (toISOString() would give the UTC day). */
export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatCurrency(amount, symbol = '₹') {
  const num = Number(amount || 0);
  return `${symbol}${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDuration(mins) {
  if (mins === null || mins === undefined) return 'Active';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
