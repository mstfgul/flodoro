const BASE = 'http://localhost:8080/api'

function getToken() {
  return localStorage.getItem('flodoro_token')
}

async function request(method, path, body) {
  const hdrs = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) hdrs['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: hdrs,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data })
    throw err
  }
  return data
}

export const api = {
  // Auth
  register: (email, password, displayName) =>
    request('POST', '/auth/register', { email, password, display_name: displayName }),
  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),

  // Focus sessions
  createSession: (data) => request('POST', '/sessions', data),
  completeSession: (id, data) => request('PUT', `/sessions/${id}/complete`, data),
  listSessions: () => request('GET', '/sessions'),
  getStats: () => request('GET', '/stats'),
  getHistory: () => request('GET', '/stats/history'),

  // Hangar
  getHangar: () => request('GET', '/hangar'),
  claimAircraft: (code) => request('POST', `/hangar/claim/${code}`),
  buySlot: () => request('POST', '/hangar/buy-slot'),

  // Friends
  searchUsers: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
  sendFriendRequest: (receiverId) => request('POST', '/friends/request', { receiver_id: receiverId }),
  getFriendRequests: () => request('GET', '/friends/requests'),
  respondFriendRequest: (id, accept) => request('POST', `/friends/requests/${id}/respond`, { accept }),
  getFriends: () => request('GET', '/friends'),
  removeFriend: (id) => request('DELETE', `/friends/${id}`),

  // Route catalogue
  getRoutes: () => request('GET', '/routes'),

  // Live sessions
  createLiveSession: (body) => request('POST', '/live', body),
  getLiveSessions: () => request('GET', '/live'),
  getLiveSession: (code) => request('GET', `/live/${code}`),
  joinLiveSession: (code) => request('POST', `/live/${code}/join`),
  endLiveSession: (code) => request('POST', `/live/${code}/end`),
}

// WebSocket — token via query param since WS headers aren't supported in browsers
export function openSessionSocket(code, onMessage, onClose) {
  const token = getToken()
  const url = `ws://localhost:8080/ws/${code}?token=${encodeURIComponent(token)}`
  const ws = new WebSocket(url)
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)) } catch {}
  }
  if (onClose) ws.onclose = onClose
  return ws
}
