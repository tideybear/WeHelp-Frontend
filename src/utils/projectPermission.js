/** 项目负责人 / 系统管理员（user_id=1）是否可管理项目 */

export function isSystemAdmin(userId) {
  return Number(userId) === 1
}

export function userDisplayName(userInfo) {
  if (!userInfo || typeof userInfo !== 'object') return ''
  return String(userInfo.name ?? userInfo.account ?? '').trim()
}

/**
 * @param {object|null} projectRow 详情接口返回行
 * @param {object|null} userInfo 当前登录用户
 */
export function canManageProject(projectRow, userInfo) {
  const uid = Number(userInfo?.id)
  if (!Number.isFinite(uid)) return false
  if (isSystemAdmin(uid)) return true
  const manager = String(projectRow?.project_manager ?? '').trim()
  if (!manager) return false
  const me = userDisplayName(userInfo)
  return Boolean(me && manager === me)
}
