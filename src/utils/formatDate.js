/**
 * 仅展示日期部分（YYYY-MM-DD），去掉时间。
 * 兼容 ISO 字符串、含空格的 datetime、已是日期的串。
 */
export function formatDateOnly(value) {
  if (value === undefined || value === null || value === '') return ''
  const s = String(value).trim()
  if (!s) return ''
  if (s.length >= 10) {
    const head = s.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  }
  const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  return s
}

function pad2(n) {
  return String(Math.trunc(Number(n)) || 0).padStart(2, '0')
}

/**
 * 展示为 YYYY-MM-DD HH:mm:ss（日期时间）。
 * 优先解析常见字符串格式，避免纯日期被误解析为 UTC 午夜等问题。
 */
export function formatDateTime(value) {
  if (value === undefined || value === null || value === '') return ''
  const s = String(value).trim()
  if (!s) return ''

  const re =
    /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  const m = s.match(re)
  if (m) {
    const y = m[1]
    const mo = m[2]
    const d = m[3]
    const H = pad2(m[4] !== undefined ? m[4] : 0)
    const M = pad2(m[5] !== undefined ? m[5] : 0)
    const S = pad2(m[6] !== undefined ? m[6] : 0)
    return `${y}-${mo}-${d} ${H}:${M}:${S}`
  }

  const dt = new Date(s)
  if (!Number.isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`
  }
  return s
}
