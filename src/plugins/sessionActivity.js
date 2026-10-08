import router from '@/router'
import { useUserStore } from '@/stores/userStore'
import { touchLastActivity } from '@/utils/sessionActivity'
import { logoutDueToInactivity } from '@/utils/sessionInactivity'

const THROTTLE_MS = 30_000
const CHECK_INTERVAL_MS = 60_000

let lastTouchAt = 0

function throttledTouchActivity() {
  const now = Date.now()
  if (now - lastTouchAt < THROTTLE_MS) return
  lastTouchAt = now
  touchLastActivity(now)
}

function runInactivityCheck() {
  const nav = logoutDueToInactivity(true)
  if (nav) {
    router.replace(nav)
  }
}

export function setupSessionActivityWatch() {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

  const onActivity = () => {
    const userStore = useUserStore()
    if (!userStore.userInfo?.token) return
    throttledTouchActivity()
  }

  events.forEach((name) => {
    window.addEventListener(name, onActivity, { passive: true })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    runInactivityCheck()
  })

  window.setInterval(runInactivityCheck, CHECK_INTERVAL_MS)

  runInactivityCheck()
}
