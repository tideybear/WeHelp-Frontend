import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import {
  ensureLastActivityForAuthenticatedSession,
  isSessionInactiveExpired,
} from '@/utils/sessionActivity'

export function shouldForceLogoutDueToInactivity() {
  const userStore = useUserStore()
  if (!userStore.userInfo?.token) return false
  ensureLastActivityForAuthenticatedSession()
  return isSessionInactiveExpired()
}

/** @returns {object|undefined} vue-router 导航重定向对象 */
export function buildInactivityLoginRedirect(redirectPath) {
  const redirect =
    typeof redirectPath === 'string' &&
    redirectPath.startsWith('/') &&
    !redirectPath.startsWith('//') &&
    !redirectPath.startsWith('/login')
      ? redirectPath
      : undefined
  return {
    path: '/login',
    ...(redirect ? { query: { redirect } } : {}),
  }
}

export function logoutDueToInactivity(showMessage = true, redirectPath) {
  const userStore = useUserStore()
  if (!shouldForceLogoutDueToInactivity()) return null

  userStore.clearUserInfo()
  if (showMessage) {
    ElMessage.warning('超过一小时未操作，请重新登录')
  }
  return buildInactivityLoginRedirect(redirectPath)
}
