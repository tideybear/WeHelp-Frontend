<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCrmCustomerDetailAPI, updateCrmCustomerAPI, deleteCrmCustomerAPI, getCrmCustomerFollowUpRecordAPI, deepAnalysisAPI } from '@/apis/crm'
import { getUserListAPI } from '@/apis/user'
import { useNamespace } from '@/stores/namespaceStore'
import CrmCustomerContacts from './CrmCustomerContacts.vue'
import CrmFollowUpRecords from './CrmFollowUpRecords.vue'
import CrmCustomerProducts from './CrmCustomerProducts.vue'
import { COMPANY_SIZE_OPTIONS } from '@/views/Crm/CrmFollowUpRecords/components/shared'
import {
  CUSTOMER_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  REGION_OPTIONS,
  COUNTRY_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  YES_NO_OPTIONS,
  optionLabel,
  normalizeId,
  toDateValue,
  formatDateTime,
  ANALYSIS_LABELS,
  ANALYSIS_MAPPING,
  BASIC_INFO_KEYS,
  REMARK_KEYS,
  ANALYSIS_FALLBACK_GROUP,
  labelToValue,
  readLabeledLine,
  applyLabeledLines,
  extractAddress,
  mergeAddress,
  formatAmount,
  normalizeCurrency,
  extractCurrency,
  CURRENCY_OPTIONS,
} from './shared'

defineOptions({ name: 'CrmCustomerDetailDefault' })

const route = useRoute()
const router = useRouter()
const namespaceStore = useNamespace()

const detailLoading = ref(false)
const saving = ref(false)
const analyzing = ref(false) // 深入分析中（后端耗时较长）
const detail = ref(null)
const editBufferMap = ref({}) // 存储所有修改的字段
const addressEditing = ref(false) // 「地址」行是否处于编辑态（与基本信息共用缓冲区）
const basicInfoEditing = ref(false) // 「基本信息」行是否处于编辑态

// 深入分析结果面板
const analysisResult = ref([]) // [{ label, target, type, oldValue, newValue }]

// 下拉选项注册表：深入分析按 label 反查 value
const OPTION_REGISTRY = {
  CUSTOMER_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
  REGION_OPTIONS,
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
}

// 负责人（销售）下拉选项
const ownerOptions = ref([])

// 是否有未保存的修改
const hasModified = computed(() => Object.keys(editBufferMap.value).length > 0)

const READONLY_FIELDS = ['id', 'created_at', 'updated_at']

// 客户状态：1潜在 2跟进中 3已合作 4流失 5无效
const STATUS_OPTIONS = CUSTOMER_STATUS_OPTIONS

// 数值型字段：保存时需要转成数字
const NUMBER_FIELDS = [
  'status',
  'company_size_min',
  'company_size_max',
  'company_revenue',
  'first_year_sales_potential',
  'third_year_sales_potential',
  'is_followed_up',
  'has_visited',
]

// 日期型字段：保存时需要转成 'YYYY-MM-DD'
const DATE_FIELDS = ['first_cooperation_at']

// 下拉 id 型字段：空值需要转成 null
const ID_FIELDS = [
  'source_id',
  'region_id',
  'country_id',
  'customer_type_id',
  'industry_id',
  'company_size_id',
  'follow_up_status_id',
  'owner_id',
]

// 状态标签配色，与客户列表页保持一致
function statusTagType(value) {
  switch (Number(value)) {
    case 1: return 'info'
    case 2: return 'warning'
    case 3: return 'success'
    case 4: return 'danger'
    case 5: return 'info'
    default: return 'info'
  }
}

// 状态 id 归一化为数字，避免后端返回字符串导致下拉框匹配不到 option
function normalizeStatus(value) {
  return normalizeId(value)
}

// 取状态文案：优先按 id 映射（编辑后后端返回的 status_name 可能是旧值），其次用后端返回的 status_name
function statusLabel() {
  const value = currentStatusValue()
  const opt = STATUS_OPTIONS.find((o) => o.value === value)
  if (opt) return opt.label
  return detail.value?.status_name || '—'
}

// 当前状态 id（编辑缓冲优先）
function currentStatusValue() {
  if (editBufferMap.value.status !== undefined) {
    return normalizeStatus(editBufferMap.value.status)
  }
  return normalizeStatus(detail.value?.status)
}

const recordId = computed(() => {
  const p = route.params.id
  return p != null && p !== '' ? String(p) : ''
})

async function loadDetail() {
  if (!recordId.value) return
  // 切换客户时清空编辑缓冲区
  editBufferMap.value = {}
  addressEditing.value = false
  basicInfoEditing.value = false
  detailLoading.value = true
  try {
    const res = await getCrmCustomerDetailAPI(recordId.value)
    if (!res || !res.result) {
      ElMessage.error(res?.message || res?.msg || '加载详情失败')
      return
    }
    detail.value = res.result
  } catch (e) {
    console.error(e)
    ElMessage.error('加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'customerList' })
}

// 深入分析：把页面上的指定字段与所有跟进记录内容合并打包成 JSON 并打印到控制台
async function handleDeepAnalysis() {
  // 已有请求进行中时直接返回，保证「深入分析」只发一次 API 请求
  // （loading 标记要在任何 await 之前置位，否则等待期间的重复点击会并发发起请求）
  if (analyzing.value) return
  analyzing.value = true

  const customerId = detail.value?.id ?? recordId.value

  // 取字段值（优先使用编辑缓冲区的值，否则使用原始值）
  const pick = (field) => {
    const v = getFieldValue(field)
    return v === undefined || v === null ? '' : v
  }

  // 取 id 型字段对应的名称（优先按 id 匹配字典，其次用后端返回的 *_name）
  const pickName = (field, options, nameField) => {
    const id = normalizeId(getFieldValue(field))
    if (id !== '') {
      const label = optionLabel(options, id)
      if (label) return label
    }
    return detail.value?.[nameField] || ''
  }

  const regionName = pickName('region_id', REGION_OPTIONS, 'region_name')
  const countryName = pickName('country_id', COUNTRY_OPTIONS, 'country_name')
  const industryName = pickName('industry_id', INDUSTRY_OPTIONS, 'industry_name')

  const payload = {
    customer_name: pick('customer_name'),
    company_name_en: pick('company_name_en'),
    region_name: regionName,
    country_name: countryName,
    industry_name: industryName,
    // 后端按 crm_master_data 字段结构返回，这三个字段位填名称而非 id
    region_id: regionName,
    country_id: countryName,
    industry_id: industryName,
    website: pick('website'),
    customer_basic_info: pick('customer_basic_info'),
    customer_needs: pick('customer_needs'),
    follow_up_strategy: pick('follow_up_strategy'),
    follow_up_content: '',
  }

  // 跟进记录：把所有记录的 content 用 || 合并，输出只有一条记录
  if (customerId !== undefined && customerId !== null && customerId !== '') {
    try {
      const res = await getCrmCustomerFollowUpRecordAPI({
        customer_id: Number(customerId),
        page: 1,
        pageSize: 500,
      })
      const result = res?.result ?? res
      const list = result?.list ?? result?.data ?? (Array.isArray(result) ? result : [])
      const mergedContent = (Array.isArray(list) ? list : [])
        .map((item) => item?.content)
        .filter((c) => c !== undefined && c !== null && c !== '')
        .join('||')

      payload.follow_up_content = mergedContent
    } catch (e) {
      console.error('[深入分析] 获取跟进记录失败:', e)
    }
  }

  console.log('[深入分析] 客户数据打包结果:', JSON.stringify(payload, null, 2))

  // 调用深入分析接口（后端耗时较长，超时放宽到 180s）
  try {
    const res = await deepAnalysisAPI(payload, 180000)
    console.log('[深入分析] 接口返回结果:', res)
    const result = res?.result ?? res ?? {}
    const mapped = applyAnalysisResult(result)
    analysisResult.value = mapped
    ElMessage.success('深入分析完成')
    return res
  } catch (e) {
    console.error('[深入分析] 调用深入分析接口失败:', e)
    if (e?.code === 'ECONNABORTED') {
      ElMessage.error('深入分析超时，请稍后重试')
    } else {
      ElMessage.error(e?.response?.data?.message || e?.response?.data?.msg || '深入分析失败')
    }
    return null
  } finally {
    analyzing.value = false
  }
}

/**
 * 把深入分析结果落到客户详情表单。
 *
 * 写入口径：
 * - 字段原值为空 → 直接填入分析结果；
 * - 字段原值有值 → 直接替换（不是在原值后面追加）；
 * - 多行文本容器（基本信息 / 备注）→ 按「标签」在内容中定位并替换对应行，
 *   没有同名标签才新增一行。
 *
 * 所有改动都写入 editBufferMap，等用户点「保存」才落库；
 * 同时返回逐条的「标签 / 原值 -> 新值」列表，用于结果面板展示。
 */
function applyAnalysisResult(result) {
  const items = []      // 面板展示：{ label, target, type, oldValue, newValue }
  const buffer = {}     // 待写入编辑缓冲区的字段
  const basicEntries = []  // 写入「基本信息」的条目：{ label, value, target }
  const remarkEntries = [] // 写入「备注」的条目：{ label, value, target }

  // 当前值：本次已写入 buffer 的优先，其次编辑缓冲区，最后原始数据
  const current = (field) => {
    if (buffer[field] !== undefined) return buffer[field]
    if (editBufferMap.value[field] !== undefined) return editBufferMap.value[field]
    return detail.value?.[field]
  }

  /**
   * 记录一条改动：
   * - 原值为空 → fill（新增）
   * - 原值有值 → replace（原值 -> 新值）
   * - 两边相同 → same（无需改动）
   */
  const record = (label, targetLabel, oldValue, newValue) => {
    const oldText = oldValue == null ? '' : String(oldValue)
    const newText = newValue == null ? '' : String(newValue)
    const type = oldText === newText ? 'same' : (oldText ? 'replace' : 'fill')
    items.push({ label, target: targetLabel, type, oldValue: oldText, newValue: newText })
    return type
  }

  /**
   * 写入表单字段：
   * - 原值为空 → 直接填入；
   * - 原值有值且不同 → 直接替换；
   * - 与原值相同 → 不动（不标记为已修改）。
   *
   * oldDisplay / newDisplay 是面板上展示用的文案（如下拉项显示 label），
   * 与实际存储的 value 分开，避免 id 与文案混淆。
   * isSame 可自定义「是否相同」的判断（如数值与带单位文案的比较）。
   */
  const setField = (field, value, label, targetLabel, oldDisplay, newDisplay, isSame) => {
    const old = current(field)
    const oldText = oldDisplay != null ? oldDisplay : (old == null ? '' : String(old))
    const newText = newDisplay != null ? newDisplay : (value == null ? '' : String(value))
    // 展示文案一致即认为值没变，不写入缓冲区
    const same = isSame ? isSame(old, value) : oldText === newText
    if (!same) {
      buffer[field] = value
    }
    record(label, targetLabel, oldText, newText)
  }

  /** 记录一条「打包进基本信息/备注」的条目，最终由 applyLabeledLines 统一落盘 */
  const pushBasic = (label, value, target = '基本信息') => {
    if (value == null || String(value).trim() === '') return
    basicEntries.push({ label, value, target })
  }
  const pushRemark = (label, value, target = '备注') => {
    if (value == null || String(value).trim() === '') return
    remarkEntries.push({ label, value, target })
  }

  for (const rule of ANALYSIS_MAPPING) {
    const raw = result[rule.key]
    if (raw == null || raw === '') continue

    if (rule.type === 'enum') {
      const options = OPTION_REGISTRY[rule.options] || []
      // 主字段（如 country_cn）优先，取不到用备用字段（如 country）
      const label = raw || (rule.fallbackKey ? result[rule.fallbackKey] : '')
      if (label == null || label === '') continue
      const value = labelToValue(options, label)
      if (value == null) {
        // 下拉里没有对应项：退回到文本形式，按标签写进基本信息
        pushBasic(rule.label, label)
      } else {
        const old = current(rule.target)
        const oldLabel = old == null || old === '' ? '' : optionLabel(options, old)
        // 有原值 → 直接替换成分析结果；原值为空 → 直接填入
        setField(rule.target, value, rule.label, rule.targetLabel, oldLabel, label)
      }
      // 备用字段（如英文国名 country / 英文行业 industry）单独保留一条，
      // 避免模型返回的英文原文被丢掉
      if (rule.fallbackKey) {
        const alt = result[rule.fallbackKey]
        if (alt != null && alt !== '' && String(alt) !== String(label)) {
          pushBasic(`${rule.label}（原文）`, alt)
        }
      }
      continue
    }

    if (rule.type === 'revenue') {
      // 营收：模型常给「1.27 billion USD」这类带单位/币种的文本，
      // 表里的 company_revenue 是无单位的数值，这里抽出数值写入，
      // 同时把币种写进 revenue_currency（币种独立成字段，不混在数值里）。
      const text = String(raw)
      const num = Number(text.replace(/[^\d.]/g, ''))
      // 币种优先取分析结果里的 revenue_currency，没有就从营收文本里解析
      const currency = normalizeCurrency(
        result.revenue_currency || extractCurrency(text) || ''
      )
      if (Number.isNaN(num)) {
        pushBasic(rule.label, text)
      } else {
        const old = current(rule.target)
        // 有原值 → 直接替换；原值为空 → 直接填入
        // 原值是数值、新值是「1.27 billion USD」这类带单位文案，数值相同即视为没变
        setField(
          rule.target,
          num,
          rule.label,
          rule.targetLabel,
          old == null || old === '' ? '' : old,
          text,
          (o) => o != null && o !== '' && Number(o) === num
        )
      }
      // 币种写入 revenue_currency（有原值则替换）
      if (currency) {
        const oldCurrency = current('revenue_currency')
        setField('revenue_currency', currency, '营收币种', '币种', oldCurrency == null ? '' : oldCurrency, currency)
      }
      if (num < 1000) {
        // 单位存疑：不覆盖字段，改为按标签写进备注提示核实
        const note = `${rule.label}原始值 ${raw}，单位请核实（可能是十亿/百万）`
        pushRemark(`${rule.label}（单位待核实）`, note)
      }
      continue
    }

    if (rule.type === 'currency') {
      // 币种：写入 revenue_currency，与销售额绑定展示
      const code = normalizeCurrency(raw)
      if (!code) continue
      const old = current(rule.target)
      setField(rule.target, code, rule.label, rule.targetLabel, old == null ? '' : old, code)
      continue
    }

    if (rule.type === 'number') {
      const num = Number(String(raw).replace(/[^\d.]/g, ''))
      if (Number.isNaN(num)) {
        pushBasic(rule.label, raw)
        continue
      }
      const old = current(rule.target)
      setField(rule.target, num, rule.label, rule.targetLabel, old == null || old === '' ? '' : old, String(raw))
      continue
    }

    if (rule.type === 'address') {
      // 地址存放在 customer_basic_info 的「总部地址：xxx」一行里，
      // 直接按标签定位并替换那一行（mergeAddress 会把旧的地址行摘掉再写回）。
      const before = current('customer_basic_info')
      const old = extractAddress(before).address
      const next = mergeAddress(before, String(raw).trim())
      if (next !== before) buffer.customer_basic_info = next
      record(rule.label, rule.targetLabel, old, String(raw).trim())
      continue
    }

    if (rule.type === 'remark') {
      // 没有对应表单字段，按标签写进备注
      pushRemark(rule.label, raw)
      continue
    }

    if (rule.type === 'website') {
      // 网址是单值字段：有原值 → 直接替换；原值为空 → 直接填入
      const old = current(rule.target)
      setField(rule.target, String(raw).trim(), rule.label, rule.targetLabel, old == null ? '' : old, String(raw).trim())
      continue
    }

    // text / multiline：有原值 → 直接替换；原值为空 → 直接填入
    const old = current(rule.target)
    setField(rule.target, String(raw).trim(), rule.label, rule.targetLabel, old == null ? '' : old, String(raw).trim())
  }

  // 没有对应表单字段的信息项
  const consumed = new Set()
  for (const rule of ANALYSIS_MAPPING) {
    consumed.add(rule.key)
    if (rule.fallbackKey) consumed.add(rule.fallbackKey)
  }

  for (const key of BASIC_INFO_KEYS) {
    consumed.add(key)
    const raw = result[key]
    if (raw == null || raw === '') continue
    pushBasic(ANALYSIS_LABELS[key] || key, raw)
  }
  for (const key of REMARK_KEYS) {
    consumed.add(key)
    const raw = result[key]
    if (raw == null || raw === '') continue
    pushRemark(ANALYSIS_LABELS[key] || key, raw)
  }

  // 兜底：规则表没覆盖到的 key（后端新增字段等）也要落到基本信息/备注，
  // 保证返回的数据一条不漏。按 key 名里的关键词决定归到哪一组。
  for (const [key, raw] of Object.entries(result)) {
    if (consumed.has(key)) continue
    if (raw == null || raw === '') continue
    const label = ANALYSIS_LABELS[key] || key
    const group = ANALYSIS_FALLBACK_GROUP[key] || guessFallbackGroup(key)
    if (group === 'basic') {
      pushBasic(label, raw)
    } else {
      pushRemark(label, raw)
    }
  }

  // 基本信息 / 备注：按标签在内容中定位并替换同名行，没有同名标签才新增一行
  if (basicEntries.length) {
    const before = current('customer_basic_info')
    const { content } = applyLabeledLines(before, basicEntries)
    // 内容没变化就不写入缓冲区，避免把未改动的字段标记为已修改
    if (content !== before) buffer.customer_basic_info = content
    // 逐条记录「原值 -> 新值」，方便面板里按标签展示
    for (const entry of basicEntries) {
      const oldValue = readLabeledLine(before, entry.label)
      record(entry.label, entry.target, oldValue, String(entry.value).trim())
    }
  }
  if (remarkEntries.length) {
    const before = current('remark')
    const { content } = applyLabeledLines(before, remarkEntries)
    if (content !== before) buffer.remark = content
    for (const entry of remarkEntries) {
      const oldValue = readLabeledLine(before, entry.label)
      record(entry.label, entry.target, oldValue, String(entry.value).trim())
    }
  }

  // 写入编辑缓冲区，等用户点「保存」落库
  Object.assign(editBufferMap.value, buffer)

  return items
}

// 未知 key 的归类：按 key 名里的关键词判断进基本信息还是备注
function guessFallbackGroup(key) {
  const name = String(key).toLowerCase()
  const basicWords = ['address', 'employee', 'staff', 'headcount', 'founded', 'established',
    'size', 'scale', 'product', 'service', 'scope', 'business', 'parent', 'group',
    'subsidiary', 'brand', 'website', 'name']
  if (basicWords.some((w) => name.includes(w))) return 'basic'
  return 'remark'
}

// 跳转跟进记录列表页（/crm/follow/record），并按当前客户预置筛选条件
function goFollowUpRecords() {
  const customerName = detail.value?.company_name || detail.value?.customer_name || ''
  router.push({
    name: 'customerFollowUpRecord',
    query: {
      ...(detail.value?.id ? { customer_id: String(detail.value.id) } : {}),
      ...(customerName ? { customer_name: customerName } : {}),
      ...(route.query.namespace_id ? { namespace_id: String(route.query.namespace_id) } : {}),
    },
  })
}

function isReadonly(field) {
  return READONLY_FIELDS.includes(field)
}

function startEdit(field, value) {
  if (isReadonly(field)) return
  // 编辑基本信息时退出地址编辑态，两者共用同一个缓冲区
  if (field === 'customer_basic_info') {
    addressEditing.value = false
    basicInfoEditing.value = true
  }
  // 如果没有修改过，使用原始值初始化
  if (editBufferMap.value[field] === undefined) {
    editBufferMap.value[field] = value ?? ''
  }
  // 公司规模是「下限 - 上限」两个字段，需要一起初始化，
  // 否则 el-input-number 会收到 undefined
  if (field === 'company_size_min' && editBufferMap.value.company_size_max === undefined) {
    editBufferMap.value.company_size_max = detail.value?.company_size_max ?? null
  }
  // 销售额与币种是同一格，一起进入编辑态，币种下拉才有初值
  if (field === 'company_revenue' && editBufferMap.value.revenue_currency === undefined) {
    editBufferMap.value.revenue_currency = detail.value?.revenue_currency ?? ''
  }
}

function cancelEdit(field) {
  delete editBufferMap.value[field]
  if (field === 'customer_basic_info') {
    addressEditing.value = false
    basicInfoEditing.value = false
  }
}

function isEditing(field) {
  return editBufferMap.value[field] !== undefined
}

function getEditBuffer(field) {
  return editBufferMap.value[field] ?? ''
}

function isFieldModified(field) {
  return editBufferMap.value[field] !== undefined
}

// 获取字段值（优先使用编辑缓冲区的值，否则使用原始值）
function getFieldValue(field) {
  if (editBufferMap.value[field] !== undefined) {
    return editBufferMap.value[field]
  }
  return detail.value?.[field]
}

/**
 * 下拉 id 型字段的展示文案。
 * 优先按当前（编辑缓冲优先的）id 映射，后端 join 出的 *_name 只作为兜底，
 * 因为编辑后后端返回的 *_name 仍是旧值。
 */
function idFieldLabel(field, options, nameField) {
  const raw = getFieldValue(field)
  const id = normalizeId(raw)
  if (id !== '') {
    const label = optionLabel(options, id)
    if (label) return label
  }
  return detail.value?.[nameField] || '—'
}

// 负责人展示文案（编辑缓冲优先）
function ownerLabel() {
  if (editBufferMap.value.owner_id !== undefined) {
    const id = normalizeId(editBufferMap.value.owner_id)
    if (id === '') return '—'
    const opt = ownerOptions.value.find((o) => Number(o.id) === id)
    return opt?.name ?? detail.value?.owner_name ?? '—'
  }
  return detail.value?.owner_name || '—'
}

// 是否跟进 / 是否来访展示文案（编辑缓冲优先）
function yesNoLabel(field, nameField) {
  if (editBufferMap.value[field] !== undefined) {
    const id = normalizeId(editBufferMap.value[field])
    if (id === '') return '—'
    return optionLabel(YES_NO_OPTIONS, id)
  }
  return detail.value?.[nameField] || '—'
}

// 日期展示文案（编辑缓冲优先）
function dateLabel(field, withTime = false) {
  const raw = getFieldValue(field)
  if (raw == null || raw === '') return '—'
  if (withTime) return formatDateTime(raw)
  return String(raw).includes('GMT') ? toDateValue(raw) : String(raw).slice(0, 10)
}

// 金额展示文案（编辑缓冲优先）
// 带币种：销售额用 revenue_currency，首年/三年潜力用 potential_currency
function amountLabel(field) {
  const raw = getFieldValue(field)
  if (raw == null || raw === '') return '—'
  return formatAmount(raw, currencyOf(field))
}

// 金额字段对应的币种字段
function currencyFieldOf(field) {
  if (field === 'company_revenue') return 'revenue_currency'
  if (field === 'first_year_sales_potential' || field === 'third_year_sales_potential') {
    return 'potential_currency'
  }
  return ''
}

// 当前金额对应的币种（编辑缓冲优先），没有则回退到营收币种
function currencyOf(field) {
  const currencyField = currencyFieldOf(field)
  if (currencyField) {
    const value = getFieldValue(currencyField)
    if (value != null && value !== '') return value
  }
  const fallback = getFieldValue('revenue_currency')
  return fallback == null ? '' : fallback
}

// 公司规模展示文案：优先按 company_size_id 映射字典，其次用后端返回的 company_size_name
function companySizeLabel() {
  const id = normalizeId(getFieldValue('company_size_id'))
  if (id !== '') {
    const label = optionLabel(COMPANY_SIZE_OPTIONS, id)
    if (label) return label
  }
  return getFieldValue('company_size_name') || '—'
}

/**
 * 地址：crm_master_data 没有独立的 address 列，地址存在 customer_basic_info
 * 里的「总部地址：xxx」一行。这里把它抽出来单独展示成「地址」行，
 * 编辑地址时再合并回 customer_basic_info，两处始终保持一致。
 */
const fullBasicInfo = computed(() => {
  if (editBufferMap.value.customer_basic_info !== undefined) {
    return editBufferMap.value.customer_basic_info
  }
  return detail.value?.customer_basic_info ?? ''
})

const addressValue = computed({
  get: () => extractAddress(fullBasicInfo.value).address,
  set: (val) => {
    editBufferMap.value.customer_basic_info = mergeAddress(fullBasicInfo.value, val)
  },
})

// 基本信息：去掉地址行后的剩余内容
const basicInfoRest = computed({
  get: () => extractAddress(fullBasicInfo.value).rest,
  set: (val) => {
    // 只替换剩余内容，地址行原样保留
    const addr = extractAddress(fullBasicInfo.value).address
    editBufferMap.value.customer_basic_info = mergeAddress(val, addr)
  },
})

// 地址是否处于编辑态（与 customer_basic_info 共用同一个编辑缓冲区，
// 但单独用 addressEditing 标记，避免编辑地址时基本信息也弹出编辑器）
const isEditingAddress = computed(() => addressEditing.value)

// 编辑地址：进入编辑态时把原值放进编辑缓冲区
function startEditAddress() {
  if (isReadonly('customer_basic_info')) return
  if (editBufferMap.value.customer_basic_info === undefined) {
    editBufferMap.value.customer_basic_info = detail.value?.customer_basic_info ?? ''
  }
  addressEditing.value = true
}

// 拉取负责人（销售）下拉选项
async function loadOwnerOptions() {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    ownerOptions.value = []
    return
  }
  try {
    const res = await getUserListAPI({ namespace_id: ns })
    const list = res?.data ?? res?.result?.list ?? []
    ownerOptions.value = (Array.isArray(list) ? list : []).map((item) => ({
      id: Number(item.id),
      name: item.name ?? `用户 ${item.id}`,
    }))
  } catch (e) {
    console.error('获取负责人列表失败:', e)
    ownerOptions.value = []
  }
}

// 保存所有编辑的字段
async function handleSaveAll() {
  if (!recordId.value || !detail.value?.id) return
  const modifiedFields = Object.keys(editBufferMap.value)
  if (modifiedFields.length === 0) {
    ElMessage.info('没有需要保存的修改')
    return
  }
  saving.value = true
  try {
    // 构建更新数据（不包含 id，id 通过 URL 传递）
    const updateData = {}
    modifiedFields.forEach(field => {
      updateData[field] = serializeFieldValue(field, editBufferMap.value[field])
    })
    const res = await updateCrmCustomerAPI(Number(detail.value.id), updateData)
    if (!res?.result?.id) {
      ElMessage.error('保存失败')
      return
    }
    ElMessage.success('保存成功')
    // 更新原始数据
    modifiedFields.forEach(field => {
      detail.value[field] = editBufferMap.value[field]
    })
    // 清空编辑缓冲区
    editBufferMap.value = {}
    addressEditing.value = false
    basicInfoEditing.value = false
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

/**
 * 按字段类型序列化提交值。
 * 后端 crm_master_data 对列类型有约束（tinyint / decimal / date / int unsigned），
 * 直接提交字符串会导致 MySQL 隐式转换报错或写入脏数据。
 */
function serializeFieldValue(field, value) {
  // 空值统一转 null，避免写入空字符串
  if (value === '' || value == null) {
    if (NUMBER_FIELDS.includes(field) || ID_FIELDS.includes(field) || DATE_FIELDS.includes(field)) {
      return null
    }
    return value === '' ? '' : value
  }

  if (NUMBER_FIELDS.includes(field)) {
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  if (ID_FIELDS.includes(field)) {
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }

  if (DATE_FIELDS.includes(field)) {
    // el-date-picker 返回 'YYYY-MM-DD'
    return String(value).slice(0, 10)
  }

  return value
}

// 删除客户
async function handleDelete() {
  if (!recordId.value) return
  try {
    await ElMessageBox.confirm('确定要删除该客户吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    const res = await deleteCrmCustomerAPI(Number(recordId.value))
    if (!res?.result?.id) {
      ElMessage.error('删除失败')
      return
    }
    ElMessage.success('删除成功')
    router.push({ name: 'customerList' })
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
}

onMounted(() => {
  loadDetail()
  loadOwnerOptions()
})

watch(() => route.params.id, () => {
  loadDetail()
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    loadOwnerOptions()
  },
)
</script>

<template>
  <div class="detail-page" v-loading="detailLoading">
    <div class="detail-header">
      <el-button type="primary" plain size="small" @click="goBack">返回列表</el-button>
      <span class="detail-title">{{ detail?.company_name || detail?.customer_name || '客户详情' }}</span>
      <div class="detail-header-actions">
        <el-button type="primary" size="small" :loading="analyzing" @click="handleDeepAnalysis">
          深入分析
        </el-button>
      </div>
    </div>

    <div class="detail-content" v-if="detail">
      <el-descriptions :column="2" border label-width="110px">
        <el-descriptions-item label="客户编号">{{ detail.customer_no || '—' }}</el-descriptions-item>
        <el-descriptions-item label="简称">
          <span class="cell-field" :class="{ 'is-editing': isEditing('short_name') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('short_name', detail.short_name)">{{ getFieldValue('short_name') || '—' }}</span>
            </span>
            <span v-if="isEditing('short_name')" class="cell-editor">
              <el-input v-model="editBufferMap.short_name" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="公司名称">
          <span class="cell-field" :class="{ 'is-editing': isEditing('company_name') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('company_name', detail.company_name)">{{ getFieldValue('company_name') || '—' }}</span>
            </span>
            <span v-if="isEditing('company_name')" class="cell-editor">
              <el-input v-model="editBufferMap.company_name" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="英文名称">
          <span class="cell-field" :class="{ 'is-editing': isEditing('company_name_en') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('company_name_en', detail.company_name_en)">{{ getFieldValue('company_name_en') || '—' }}</span>
            </span>
            <span v-if="isEditing('company_name_en')" class="cell-editor">
              <el-input v-model="editBufferMap.company_name_en" />
            </span>
          </span>
        </el-descriptions-item>
        
        <el-descriptions-item label="客户状态">
          <span class="cell-field" :class="{ 'is-editing': isEditing('status') }">
            <span class="cell-static">
              <el-tag
              size="small"
              :type="statusTagType(currentStatusValue())"
              class="editable-tag"
              @dblclick="startEdit('status', currentStatusValue())"
              >
              {{ statusLabel() }}
              </el-tag>
            </span>
            <span v-if="isEditing('status')" class="cell-editor">
              <el-select v-model="editBufferMap.status" placeholder="请选择客户状态" class="status-select">
              <el-option
              v-for="opt in STATUS_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          <span class="cell-field" :class="{ 'is-editing': isEditing('source_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('source_id', normalizeId(detail.source_id))">{{ idFieldLabel('source_id', SOURCE_OPTIONS, 'source_name') }}</span>
            </span>
            <span v-if="isEditing('source_id')" class="cell-editor">
              <el-select v-model="editBufferMap.source_id" placeholder="请选择来源" class="cell-select">
              <el-option
              v-for="opt in SOURCE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="区域">
          <span class="cell-field" :class="{ 'is-editing': isEditing('region_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('region_id', normalizeId(detail.region_id))">{{ idFieldLabel('region_id', REGION_OPTIONS, 'region_name') }}</span>
            </span>
            <span v-if="isEditing('region_id')" class="cell-editor">
              <el-select v-model="editBufferMap.region_id" placeholder="请选择区域" class="cell-select" filterable>
              <el-option
              v-for="opt in REGION_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="国家">
          <span class="cell-field" :class="{ 'is-editing': isEditing('country_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('country_id', normalizeId(detail.country_id))">{{ idFieldLabel('country_id', COUNTRY_OPTIONS, 'country_name') }}</span>
            </span>
            <span v-if="isEditing('country_id')" class="cell-editor">
              <el-select v-model="editBufferMap.country_id" placeholder="请选择国家" class="cell-select" filterable>
              <el-option
              v-for="opt in COUNTRY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="客户性质">
          <span class="cell-field" :class="{ 'is-editing': isEditing('customer_type_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('customer_type_id', normalizeId(detail.customer_type_id))">{{ idFieldLabel('customer_type_id', CUSTOMER_TYPE_OPTIONS, 'customer_type_name') }}</span>
            </span>
            <span v-if="isEditing('customer_type_id')" class="cell-editor">
              <el-select v-model="editBufferMap.customer_type_id" placeholder="请选择客户性质" class="cell-select">
              <el-option
              v-for="opt in CUSTOMER_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="行业">
          <span class="cell-field" :class="{ 'is-editing': isEditing('industry_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('industry_id', normalizeId(detail.industry_id))">{{ idFieldLabel('industry_id', INDUSTRY_OPTIONS, 'industry_name') }}</span>
            </span>
            <span v-if="isEditing('industry_id')" class="cell-editor">
              <el-select v-model="editBufferMap.industry_id" placeholder="请选择行业" class="cell-select" filterable>
              <el-option
              v-for="opt in INDUSTRY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="公司规模">
          <span class="cell-field" :class="{ 'is-editing': isEditing('company_size_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('company_size_id', normalizeId(detail.company_size_id))">{{ companySizeLabel() }}</span>
            </span>
            <span v-if="isEditing('company_size_id')" class="cell-editor">
              <el-select v-model="editBufferMap.company_size_id" placeholder="请选择公司规模" class="cell-select">
              <el-option
              v-for="opt in COMPANY_SIZE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="销售额">
          <span class="cell-field" :class="{ 'is-editing': isEditing('company_revenue') || isEditing('revenue_currency') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('company_revenue', detail.company_revenue ?? '')">{{ amountLabel('company_revenue') }}</span>
            </span>
            <span v-if="isEditing('company_revenue') || isEditing('revenue_currency')" class="cell-editor">
              <el-input-number
              v-model="editBufferMap.company_revenue"
              :min="0"
              :precision="2"
              :controls="false"
              placeholder="请输入销售额"
              class="cell-number"
              />
              <el-select
              v-model="editBufferMap.revenue_currency"
              placeholder="请选择币种"
              class="cell-select cell-currency"
              filterable
              allow-create
              default-first-option
              >
              <el-option
              v-for="opt in CURRENCY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="负责人">
          <span class="cell-field" :class="{ 'is-editing': isEditing('owner_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('owner_id', normalizeId(detail.owner_id))">{{ ownerLabel() }}</span>
            </span>
            <span v-if="isEditing('owner_id')" class="cell-editor">
              <el-select v-model="editBufferMap.owner_id" placeholder="请选择负责人" class="cell-select" filterable>
              <el-option
              v-for="opt in ownerOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="首次合作">
          <span class="cell-field" :class="{ 'is-editing': isEditing('first_cooperation_at') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('first_cooperation_at', toDateValue(detail.first_cooperation_at))">{{ dateLabel('first_cooperation_at') }}</span>
            </span>
            <span v-if="isEditing('first_cooperation_at')" class="cell-editor">
              <el-date-picker
              v-model="editBufferMap.first_cooperation_at"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择日期"
              class="cell-date"
              />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="首次跟进">{{ detail.first_follow_up_date || '—' }}</el-descriptions-item>
        <el-descriptions-item label="下次跟进">{{ detail.next_follow_up_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="跟进状态">
          <span class="cell-field" :class="{ 'is-editing': isEditing('follow_up_status_id') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('follow_up_status_id', normalizeId(detail.follow_up_status_id))">{{ idFieldLabel('follow_up_status_id', FOLLOW_UP_STATUS_OPTIONS, 'follow_up_status_name') }}</span>
            </span>
            <span v-if="isEditing('follow_up_status_id')" class="cell-editor">
              <el-select v-model="editBufferMap.follow_up_status_id" placeholder="请选择跟进状态" class="cell-select">
              <el-option
              v-for="opt in FOLLOW_UP_STATUS_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="首年潜力">
          <span class="cell-field" :class="{ 'is-editing': isEditing('first_year_sales_potential') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('first_year_sales_potential', detail.first_year_sales_potential ?? '')">{{ amountLabel('first_year_sales_potential') }}</span>
            </span>
            <span v-if="isEditing('first_year_sales_potential')" class="cell-editor">
              <el-input-number
              v-model="editBufferMap.first_year_sales_potential"
              :min="0"
              :precision="2"
              :controls="false"
              placeholder="请输入首年潜力"
              class="cell-number"
              />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="三年潜力">
          <span class="cell-field" :class="{ 'is-editing': isEditing('third_year_sales_potential') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('third_year_sales_potential', detail.third_year_sales_potential ?? '')">{{ amountLabel('third_year_sales_potential') }}</span>
            </span>
            <span v-if="isEditing('third_year_sales_potential')" class="cell-editor">
              <el-input-number
              v-model="editBufferMap.third_year_sales_potential"
              :min="0"
              :precision="2"
              :controls="false"
              placeholder="请输入三年潜力"
              class="cell-number"
              />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="是否来访">
          <span class="cell-field" :class="{ 'is-editing': isEditing('has_visited') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('has_visited', normalizeId(detail.has_visited))">{{ yesNoLabel('has_visited', 'has_visited_label') }}</span>
            </span>
            <span v-if="isEditing('has_visited')" class="cell-editor">
              <el-select v-model="editBufferMap.has_visited" placeholder="请选择" class="cell-select">
              <el-option
              v-for="opt in YES_NO_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        
        <el-descriptions-item label="是否跟进">
          <span class="cell-field" :class="{ 'is-editing': isEditing('is_followed_up') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('is_followed_up', normalizeId(detail.is_followed_up))">{{ yesNoLabel('is_followed_up', 'is_followed_up_label') }}</span>
            </span>
            <span v-if="isEditing('is_followed_up')" class="cell-editor">
              <el-select v-model="editBufferMap.is_followed_up" placeholder="请选择" class="cell-select">
              <el-option
              v-for="opt in YES_NO_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
              />
              </el-select>
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="网址">
          <span class="cell-field" :class="{ 'is-editing': isEditing('website') }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEdit('website', detail.website)">{{ getFieldValue('website') || '—' }}</span>
            </span>
            <span v-if="isEditing('website')" class="cell-editor">
              <el-input v-model="editBufferMap.website" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">
          <span class="cell-field" :class="{ 'is-editing': isEditingAddress }">
            <span class="cell-static">
              <span class="editable" @dblclick="startEditAddress">{{ addressValue || '—' }}</span>
            </span>
            <span v-if="isEditingAddress" class="cell-editor">
              <el-input v-model="addressValue" placeholder="请输入总部地址" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="基本信息" :span="2">
          <span class="cell-field is-multiline" :class="{ 'is-editing': basicInfoEditing }">
            <span class="cell-static">
              <span class="editable editable-multiline" @dblclick="startEdit('customer_basic_info', detail.customer_basic_info)">{{ basicInfoRest || '—' }}</span>
            </span>
            <span v-if="basicInfoEditing" class="cell-editor">
              <el-input v-model="basicInfoRest" type="textarea" :rows="3" resize="none" class="cell-textarea" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="客户需求" :span="2">
          <span class="cell-field is-multiline" :class="{ 'is-editing': isEditing('customer_needs') }">
            <span class="cell-static">
              <span class="editable editable-multiline" @dblclick="startEdit('customer_needs', detail.customer_needs)">{{ getFieldValue('customer_needs') || '—' }}</span>
            </span>
            <span v-if="isEditing('customer_needs')" class="cell-editor">
              <el-input v-model="editBufferMap.customer_needs" type="textarea" :rows="3" resize="none" class="cell-textarea" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="跟进策略" :span="2">
          <span class="cell-field is-multiline" :class="{ 'is-editing': isEditing('follow_up_strategy') }">
            <span class="cell-static">
              <span class="editable editable-multiline" @dblclick="startEdit('follow_up_strategy', detail.follow_up_strategy)">{{ getFieldValue('follow_up_strategy') || '—' }}</span>
            </span>
            <span v-if="isEditing('follow_up_strategy')" class="cell-editor">
              <el-input v-model="editBufferMap.follow_up_strategy" type="textarea" :rows="3" resize="none" class="cell-textarea" />
            </span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          <span class="cell-field is-multiline" :class="{ 'is-editing': isEditing('remark') }">
            <span class="cell-static">
              <span class="editable editable-multiline" @dblclick="startEdit('remark', detail.remark)">{{ getFieldValue('remark') || '—' }}</span>
            </span>
            <span v-if="isEditing('remark')" class="cell-editor">
              <el-input v-model="editBufferMap.remark" type="textarea" :rows="3" resize="none" class="cell-textarea" />
            </span>
          </span>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 深入分析改动：按标签展示「原值 -> 新值」 -->
    <div v-if="analysisResult.length" class="analysis-changes">
      <div class="analysis-changes-title">深入分析改动</div>
      <div v-for="(item, index) in analysisResult" :key="index" class="change-line">
        <span class="change-label">{{ item.label }}</span>
        <span class="change-arrow">-></span>
        <span class="change-old">{{ item.oldValue || '（空）' }}</span>
        <span class="change-arrow">-></span>
        <span class="change-new">{{ item.newValue }}</span>
        <span class="change-target">{{ item.target }}</span>
      </div>
    </div>
    <el-row :gutter="16" class="detail-modules">
      <el-col :span="12">
        <CrmCustomerContacts
          v-if="detail?.id"
          :customer-id="detail.id"
          :customer-name="detail.company_name || detail.customer_name || ''"
          :namespace-id="route.query.namespace_id"
        />
        <CrmFollowUpRecords
          v-if="detail?.id"
          :customer-id="detail.id"
          @refresh="loadDetail"
          @view-all="goFollowUpRecords"
        />
      </el-col>
      <el-col :span="12" class="background-check-col">
        <div class="module-placeholder">背景调查</div>
        <div class="background-check-text">
          <div
            class="cell-field is-multiline"
            :class="{ 'is-editing': isEditing('background_check') }"
          >
            <span class="cell-static">
              <span class="editable editable-multiline" @dblclick="startEdit('background_check', detail.background_check)">{{ getFieldValue('background_check') || '—' }}</span>
            </span>
            <span v-if="isEditing('background_check')" class="cell-editor">
              <el-input v-model="editBufferMap.background_check" type="textarea" :rows="3" resize="none" class="cell-textarea" />
            </span>
          </div>
        </div>
      </el-col>
    </el-row>
    <CrmCustomerProducts
      v-if="detail?.id"
      :customer-id="detail.id"
      @refresh="loadDetail"
    />

    <!-- 操作按钮区域 -->
    <div class="detail-actions" v-if="detail">
      <el-button type="primary" :loading="saving" @click="handleSaveAll" :disabled="!hasModified">保存</el-button>
      <el-button type="danger" @click="handleDelete">删除</el-button>
    </div>

    <div v-else-if="!detailLoading" class="empty-state">暂无数据</div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  background: #fff;
  display: flex;
  flex-direction: column;
  // 全局 #app 上有 user-select: none，这里放开，页面内文本可以选中并复制
  user-select: text;
}

.detail-header {
  flex-shrink: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-header-actions {
  margin-left: auto;
}

.detail-content {
  padding: 16px;
}

// 描述列表使用固定表格布局：编辑态的 input / select / textarea 有较大的固有宽度，
// auto 布局下浏览器会把控件宽度算进列宽，双击编辑时整列被撑开、内容整体位移。
// fixed 布局下列宽只由首行决定，编辑前后布局保持一致。
.detail-content :deep(.el-descriptions__table) {
  table-layout: fixed;
}

// 编辑态控件撑满单元格，宽度不参与表格列宽计算
.detail-content :deep(.el-descriptions__cell .el-input),
.detail-content :deep(.el-descriptions__cell .el-select),
.detail-content :deep(.el-descriptions__cell .el-textarea) {
  width: 100%;
}

// —— 双击编辑不引起高度变化的实现 ——
// 关键点：展示态文字始终占据文档流（cell-static），编辑态控件用绝对定位
// 覆盖在其上方（cell-editor）。编辑控件不参与文档流，所以无论是否处于
// 编辑态，单元格高度都由同一份「展示态内容」决定，切换时高度完全不变，
// 页面不会闪烁。
.cell-field {
  position: relative;
  display: block;
  width: 100%;
}

// 展示态：始终存在于文档流中，决定单元格高度
.cell-static {
  display: flex;
  align-items: center;
  width: 100%;
  // 与编辑态控件（el-input / el-select 默认 32px）保持一致，
  // 保证文字只有一行时也不会比控件矮，控件不会溢出到相邻行
  min-height: 32px;
  box-sizing: border-box;

  // flex 子项默认不换行收缩，这里允许收缩并换行，
  // 否则长文本不会折行而是撑破单元格
  :deep(.editable) {
    flex: 1 1 auto;
    min-width: 0;
  }
}

// 多行文本字段：展示态与编辑态统一为 4 行文本框的高度（96px）
.cell-field.is-multiline .cell-static {
  height: 96px;
  min-height: 96px;
  align-items: stretch;

  :deep(.editable) {
    // 多行文本不使用 flex 撑满，改为固定高度对齐 textarea
    flex: none;
    width: 100%;
  }
}

// 编辑态：绝对定位覆盖在展示态之上，不参与高度计算
.cell-editor {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;

  > :deep(*) {
    width: 100%;
  }
}

// 多行文本的编辑态控件撑满整个区域
.cell-field.is-multiline .cell-editor {
  align-items: stretch;
}

// 单元格进入编辑态时，展示态文字隐藏但仍占位，保证高度不变
.cell-field.is-editing .cell-static {
  visibility: hidden;
}

// 多行文本编辑态：固定为 4 行高度，与展示态 .editable-multiline 严格一致
.cell-textarea :deep(.el-textarea__inner) {
  height: 96px;
  min-height: 96px !important;
  line-height: 21px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.detail-modules {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.module-placeholder {
  padding: 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.background-check-text {
  padding: 0 16px 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

// 背景调查：占满所在列（与左列模块等高），
// 内容区随之拉伸，文本展示区撑满剩余高度
.background-check-col {
  display: flex;
  flex-direction: column;

  .background-check-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  // 展示态与编辑态控件撑满剩余高度
  .cell-field {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .cell-field.is-multiline .cell-static {
    flex: 1;
    height: 100%;
    min-height: 96px;
  }

  .editable-multiline {
    flex: 1;
    height: 100%;
  }

  // 编辑态的 textarea 撑满剩余高度
  .cell-editor > :deep(*) {
    height: 100%;
  }

  .cell-textarea :deep(.el-textarea__inner) {
    height: 100%;
    min-height: 96px;
  }
}

.detail-actions {
  flex-shrink: 0;
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.editable {
  cursor: text;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
  display: block;
  min-height: 22px;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

// 多行文本展示态：高度与编辑态的 textarea（4 行 = 96px）严格一致，
// 内容超出时在自身内部滚动，保证双击前后单元格高度不变
.editable-multiline {
  white-space: pre-wrap;
  word-break: break-word;
  height: 96px;
  box-sizing: border-box;
  overflow-y: auto;
}

// 客户状态标签：双击进入编辑，hover 时给出可点击的视觉反馈
.editable-tag {
  cursor: pointer;
  transition: filter 0.15s ease;

  &:hover {
    filter: brightness(0.92);
  }
}

// 状态下拉框撑满单元格，避免固定宽度导致列宽在编辑前后不一致
.status-select {
  width: 100%;
}

// 下拉框撑满单元格，宽度不参与表格列宽计算
.cell-select {
  width: 100%;
}

// 数字输入框撑满单元格
.cell-number {
  width: 100%;
}

// 币种下拉：与销售额同格展示，固定一个窄宽度
.cell-currency {
  width: 110px !important;
  flex: 0 0 110px;
  margin-left: 6px;
}

// 日期选择器撑满单元格
.cell-date {
  width: 100%;
}

// 区间输入：上下限并排显示
.cell-range {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.cell-range-input {
  flex: 1;
  min-width: 0;
}

.cell-range-sep {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

// —— 深入分析改动：按标签展示「原值 -> 新值」 ——
.analysis-changes {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.analysis-changes-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.change-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 22px;
  font-size: 13px;
  word-break: break-word;
}

.change-label {
  color: var(--el-text-color-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.change-arrow {
  color: var(--el-color-primary);
  font-weight: 600;
  flex-shrink: 0;
}

.change-old {
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
}

.change-new {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.change-target {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  flex-shrink: 0;
}
</style>
