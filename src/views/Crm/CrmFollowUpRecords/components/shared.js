import { getCrmCustomerListAPI, getCrmCustomerContactListAPI } from '@/apis/crm'
import { getUserListAPI } from '@/apis/user'

// 跟进方式：sys_dict 中 dict_type='follow_up_type'，取值对应 dict_code
export const FOLLOW_UP_TYPE_OPTIONS = [
  { label: '电话', value: 1 },
  { label: '邮件', value: 2 },
  { label: '拜访', value: 3 },
  { label: '会议', value: 4 },
]

// 跟进后状态：后端注释为「跟进状态，sys_dict.id」，但 sys_dict 并无 follow_up_status 类型，
// 实际取值与 customer_status 的 id/code 完全一致（1潜在 2跟进中 3已合作 4流失 5无效）
export const FOLLOW_UP_STATUS_OPTIONS = [
  { label: '潜在', value: 1 },
  { label: '跟进中', value: 2 },
  { label: '已合作', value: 3 },
  { label: '流失', value: 4 },
  { label: '无效', value: 5 },
]

// 方向：后端字段注释「1客户来信 2我方发出 3内部备注」
export const DIRECTION_OPTIONS = [
  { label: '客户来信', value: 1 },
  { label: '我方发出', value: 2 },
  { label: '内部备注', value: 3 },
]

// 渠道：后端字段注释 email/whatsapp/phone/website/meeting
export const CHANNEL_OPTIONS = [
  { label: '邮件', value: 'email' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: '电话', value: 'phone' },
  { label: '网站', value: 'website' },
  { label: '会议', value: 'meeting' },
]

// 优先级：后端未提供字典，现有数据均为 0，按常见约定定义
export const PRIORITY_OPTIONS = [
  { label: '普通', value: 0 },
  { label: '低', value: 1 },
  { label: '中', value: 2 },
  { label: '高', value: 3 },
]

// 公司规模：后端字段 company_size_id / company_size_name
export const COMPANY_SIZE_OPTIONS = [
  { label: '小型', value: 1 },
  { label: '中型', value: 2 },
  { label: '大型', value: 3 },
  { label: '特大型', value: 4 },
]

// 单页拉取上限，配合 fetchAllRecords 循环补齐
export const FETCH_PAGE_SIZE = 500

// 空值判定：el-select 清空时回填的是 undefined（不是 ''），统一按「未筛选」处理
export function isBlank(v) {
  return v === '' || v === null || v === undefined
}

export function toText(v) {
  return isBlank(v) ? '' : String(v).trim().toLowerCase()
}

// 按 options 取展示名，取不到时回退为原始值
export function optionLabel(options, value) {
  if (isBlank(value)) return ''
  const found = options.find((o) => String(o.value) === String(value))
  return found?.label ?? String(value)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 后端返回 RFC1122/1123（如 'Sun, 18 Oct 2026 16:00:00 GMT'），按 UTC 原样展示不做时区偏移，
// 与客户列表、联系人列表的日期处理保持一致
export function formatDateTime(value) {
  if (isBlank(value)) return '—'
  const text = String(value)
  if (text.includes('GMT')) {
    const p = text.split(' ')
    if (p.length >= 5) {
      const month = MONTHS.indexOf(p[2]) + 1
      const mm = month > 0 ? String(month).padStart(2, '0') : p[2]
      return `${p[3]}-${mm}-${p[1]} ${p[4].slice(0, 5)}`
    }
    return text
  }
  return text.replace('T', ' ').slice(0, 16)
}

// RFC1123 / ISO -> 'YYYY-MM-DD HH:mm:ss'，供 el-date-picker 回显
export function toDateTimeValue(value) {
  if (isBlank(value)) return ''
  const text = String(value)
  if (text.includes('GMT')) {
    const p = text.split(' ')
    if (p.length >= 5) {
      const month = MONTHS.indexOf(p[2]) + 1
      const mm = month > 0 ? String(month).padStart(2, '0') : p[2]
      return `${p[3]}-${mm}-${p[1]} ${p[4].slice(0, 8)}`
    }
    return ''
  }
  return text.replace('T', ' ').slice(0, 19)
}

// 跟进记录表单初始值（新增/编辑共用）
export const emptyFollowUpForm = () => ({
  customer_id: '',
  contact_id: '',
  follow_up_at: '',
  follow_up_type_id: '',
  follow_up_status_id: '',
  owner_id: '',
  direction: '',
  channel: '',
  priority: 0,
  subject: '',
  content: '',
  result: '',
  next_follow_up_at: '',
  next_action: '',
  language: '',
  message_body: '',
})

// 空字符串转 null，避免写入脏数据；namespace_id 沿用当前空间
export function buildFollowUpPayload(form, namespaceId) {
  const payload = {}
  Object.entries(form || {}).forEach(([key, value]) => {
    payload[key] = value === '' ? null : value
  })
  if (namespaceId != null && namespaceId !== '') payload.namespace_id = Number(namespaceId)
  return payload
}

// 拉取可选客户列表
export async function loadCustomerOptions(namespaceId) {
  if (namespaceId == null || namespaceId === '') return []
  const res = await getCrmCustomerListAPI({
    page: 1,
    pageSize: 200,
    namespace_id: Number(namespaceId),
  })
  const result = res?.result ?? res
  const list = result?.list ?? result?.data ?? []
  return (Array.isArray(list) ? list : []).map((item) => ({
    id: Number(item.id),
    name: item.company_name ?? item.customer_name ?? item.short_name ?? `客户 ${item.id}`,
  }))
}

// 拉取空间下全部联系人（新增/编辑时按所选客户过滤）
export async function loadContactOptions(namespaceId) {
  if (namespaceId == null || namespaceId === '') return []
  const res = await getCrmCustomerContactListAPI({ namespace_id: Number(namespaceId) })
  const result = res?.result ?? res
  const list = result?.list ?? result?.data ?? []
  return (Array.isArray(list) ? list : []).map((item) => ({
    id: Number(item.id),
    name: item.name ?? `联系人 ${item.id}`,
    customer_id: item.customer_id == null ? '' : Number(item.customer_id),
  }))
}

// 拉取空间下的用户（跟进人）
export async function loadOwnerOptions(namespaceId) {
  if (namespaceId == null || namespaceId === '') return []
  const res = await getUserListAPI({ namespace_id: Number(namespaceId) })
  const list = res?.data ?? res?.result?.list ?? []
  return (Array.isArray(list) ? list : []).map((item) => ({
    id: Number(item.id),
    name: item.name ?? `用户 ${item.id}`,
  }))
}
