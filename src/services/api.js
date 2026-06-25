const BASE = '/api';

function getToken() {
  return localStorage.getItem('flodoro_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  register: (email, password, displayName) =>
    request('POST', '/auth/register', { email, password, display_name: displayName }),
  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),

  // Sessions
  createSession: (data) => request('POST', '/sessions', data),
  completeSession: (id, data) => request('PUT', `/sessions/${id}/complete`, data),
  listSessions: () => request('GET', '/sessions'),

  // Stats
  getStats: () => request('GET', '/stats'),
  getHistory: () => request('GET', '/stats/history'),
};
