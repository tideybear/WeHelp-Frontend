import { getCrmCustomerListAPI, getCrmCustomerContactListAPI } from '@/apis/crm'

// gender: 0未知 1男 2女
export const GENDER_OPTIONS = [
  { label: '未知', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]

export const LANGUAGE_OPTIONS = ['中文', 'English', 'French', 'German', 'Arabic', 'Spanish', 'Japanese']

// 联系人表单初始值（新增/编辑共用）
export const emptyContactForm = () => ({
  customer_id: '',
  name: '',
  title: '',
  department: '',
  gender: 0,
  phone: '',
  mobile: '',
  email: '',
  wechat: '',
  whatsapp: '',
  linkedin: '',
  language: '',
  is_primary: 0,
  birthday: '',
  notes: '',
})

// 空字符串转 null，避免写入脏数据；namespace_id 沿用当前空间
export function buildContactPayload(form, namespaceId) {
  const payload = {}
  Object.entries(form || {}).forEach(([key, value]) => {
    payload[key] = value === '' ? null : value
  })
  if (namespaceId != null && namespaceId !== '') payload.namespace_id = Number(namespaceId)
  return payload
}

// 客户展示名：不同接口字段名不统一（/crm/list 用 company_name，/crm/contacts 用 customer_name）
export function customerDisplayName(item) {
  return (
    item?.company_name ??
    item?.customer_name ??
    item?.short_name ??
    (item?.id != null ? `客户 ${item.id}` : '未关联客户')
  )
}

// 统一 id 为数字：el-select 的 value 与 option 的 value 类型必须严格一致，
// 否则匹配不到 option，只会显示原始 id 数字
export function toCustomerOption(item) {
  return {
    id: Number(item.id),
    name: customerDisplayName(item),
  }
}

// 拉取可选客户列表（新增/编辑时选择所属客户）
export async function loadCustomerOptions(namespaceId) {
  if (namespaceId == null || namespaceId === '') return []
  const res = await getCrmCustomerListAPI({
    page: 1,
    page_size: 200,
    namespace_id: Number(namespaceId),
  })
  const result = res?.result ?? res
  const list = result?.list ?? result?.data ?? []
  return (Array.isArray(list) ? list : []).map(toCustomerOption)
}

/**
 * 统一的客户 id 归一化：后端在不同接口下可能返回字符串或数字，
 * el-select 用严格相等匹配 value，类型不一致会匹配不到 option 而显示原始 id
 */
export function normalizeCustomerId(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isNaN(num) ? '' : num
}

/**
 * 拉取「尚未归属任何客户」的联系人列表。
 *
 * 后端 /crm/contacts 支持按 namespace_id / customer_id 过滤，但没有
 * 「customer_id IS NULL」的入参，且 customer_id 为空时该参数会被
 * http 层当作未传参剔除掉，所以只能拉全量后在前端筛选。
 */
export async function loadUnassignedContacts(namespaceId) {
  if (namespaceId == null || namespaceId === '') return []
  const res = await getCrmCustomerContactListAPI({
    namespace_id: Number(namespaceId),
  })
  const result = res?.result ?? res
  const list = result?.list ?? result?.data ?? (Array.isArray(result) ? result : [])
  return (Array.isArray(list) ? list : []).filter(
    (row) => row?.customer_id == null || row.customer_id === '',
  )
}
