/**
 * 解析项目详情中的 `processes` 字段：数组、JSON 字符串或单对象 → 树根数组。
 * 与任务树、详情区约定一致。
 */
export function parseProjectProcessesField(raw) {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'number') return []
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t || /^\d+(\.\d+)?$/.test(t)) return []
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j
      if (j && typeof j === 'object') return [j]
      return []
    } catch {
      return []
    }
  }
  if (typeof raw === 'object') return [raw]
  return []
}
