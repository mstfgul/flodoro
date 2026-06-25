const KEY = 'flodoro_sessions';

export function loadSessions() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveSession(data) {
  const all = loadSessions();
  all.push({ id: Date.now().toString(), created_at: new Date().toISOString(), ...data });
  localStorage.setItem(KEY, JSON.stringify(all));
}
