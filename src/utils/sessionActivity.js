/** 未操作超过该时长则视为会话过期（毫秒） */
export const SESSION_INACTIVITY_MS = 60 * 60 * 1000

const STORAGE_KEY = 'user_last_activity_at'

export function touchLastActivity(at = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLastActivity() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function getLastActivityAt() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** 已有登录态但尚无活动时间戳时补记，避免升级后立刻被踢出 */
export function ensureLastActivityForAuthenticatedSession() {
  if (getLastActivityAt() == null) {
    touchLastActivity()
  }
}

export function isSessionInactiveExpired(now = Date.now()) {
  const last = getLastActivityAt()
  if (last == null) return false
  return now - last >= SESSION_INACTIVITY_MS
}
