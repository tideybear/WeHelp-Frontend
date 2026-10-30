/**
 * 客户详情页可编辑字段的下拉选项。
 *
 * 取值口径（对齐后端 crm_master_data 表与 v_crm_master_data 视图）：
 * - 客户状态 status：sys_dict dict_type='customer_status'，存的是 dict_code
 *   （1潜在 2跟进中 3已合作 4流失 5无效），视图 v_crm_master_data 也是按 dict_code join 的。
 * - 来源 source_id：sys_dict dict_type='source'，存的是 dict_code（1线上 2线下）。
 * - 区域 region_id：sys_dict dict_type='country_region'，存的是 dict_code。
 * - 国家 country_id：sys_country.id。
 * - 其余 *_id 字段在 sys_dict 中暂无对应 dict_type，历史数据也全为空，
 *   这里按后端 sales.py 的既有约定给出可选值。
 */

/** 客户状态：1潜在 2跟进中 3已合作 4流失 5无效 */
export const CUSTOMER_STATUS_OPTIONS = [
  { label: '潜在', value: 1 },
  { label: '跟进中', value: 2 },
  { label: '已合作', value: 3 },
  { label: '流失', value: 4 },
  { label: '无效', value: 5 },
]

/** 来源：线上 / 线下 */
export const SOURCE_OPTIONS = [
  { label: '线上', value: 1 },
  { label: '线下', value: 2 },
]

/** 区域：东亚 / 东南亚 / ... */
export const REGION_OPTIONS = [
  { label: '东亚', value: 1 },
  { label: '东南亚', value: 2 },
  { label: '南亚', value: 3 },
  { label: '西亚', value: 4 },
  { label: '中亚', value: 5 },
  { label: '西欧', value: 6 },
  { label: '北欧', value: 7 },
  { label: '南欧', value: 8 },
  { label: '东欧', value: 9 },
  { label: '北非', value: 10 },
  { label: '西非', value: 11 },
  { label: '中非', value: 12 },
  { label: '东非', value: 13 },
  { label: '南部非洲', value: 14 },
  { label: '北美洲', value: 15 },
  { label: '南美洲', value: 16 },
  { label: '大洋洲', value: 17 },
]

/** 国家：sys_country.id */
export const COUNTRY_OPTIONS = [
  { label: '中国', value: 1 },
  { label: '美国', value: 2 },
  { label: '日本', value: 3 },
  { label: '韩国', value: 4 },
  { label: '英国', value: 5 },
  { label: '德国', value: 6 },
  { label: '法国', value: 7 },
  { label: '意大利', value: 8 },
  { label: '西班牙', value: 9 },
  { label: '加拿大', value: 10 },
  { label: '澳大利亚', value: 11 },
  { label: '新西兰', value: 12 },
  { label: '俄罗斯', value: 13 },
  { label: '印度', value: 14 },
  { label: '巴西', value: 15 },
  { label: '墨西哥', value: 16 },
  { label: '阿根廷', value: 17 },
  { label: '南非', value: 18 },
  { label: '埃及', value: 19 },
  { label: '尼日利亚', value: 20 },
  { label: '新加坡', value: 21 },
  { label: '马来西亚', value: 22 },
  { label: '泰国', value: 23 },
  { label: '越南', value: 24 },
  { label: '印度尼西亚', value: 25 },
  { label: '菲律宾', value: 26 },
  { label: '巴基斯坦', value: 27 },
  { label: '孟加拉国', value: 28 },
  { label: '伊朗', value: 29 },
  { label: '沙特阿拉伯', value: 30 },
  { label: '阿联酋', value: 31 },
  { label: '土耳其', value: 32 },
  { label: '以色列', value: 33 },
  { label: '瑞士', value: 34 },
  { label: '荷兰', value: 35 },
  { label: '比利时', value: 36 },
  { label: '瑞典', value: 37 },
  { label: '挪威', value: 38 },
  { label: '丹麦', value: 39 },
  { label: '芬兰', value: 40 },
  { label: '波兰', value: 41 },
  { label: '葡萄牙', value: 42 },
  { label: '希腊', value: 43 },
  { label: '奥地利', value: 44 },
  { label: '爱尔兰', value: 45 },
  { label: '乌克兰', value: 46 },
  { label: '捷克', value: 47 },
  { label: '匈牙利', value: 48 },
  { label: '罗马尼亚', value: 49 },
  { label: '智利', value: 50 },
  { label: '哥伦比亚', value: 51 },
  { label: '秘鲁', value: 52 },
  { label: '委内瑞拉', value: 53 },
  { label: '古巴', value: 54 },
  { label: '中国香港', value: 55 },
  { label: '中国台湾', value: 56 },
  { label: '中国澳门', value: 57 },
]

/** 客户性质：沿用后端 sales.py 中 CUSTOMER_TYPE_LABELS 的取值约定 */
export const CUSTOMER_TYPE_OPTIONS = [
  { label: '生产型企业', value: 1 },
  { label: '贸易型企业', value: 2 },
  { label: '服务型企业', value: 3 },
  { label: '政府机构', value: 4 },
  { label: '个人', value: 5 }
  
]

/** 行业：sys_dict 暂无对应字典，按常见外贸行业给出可选值 */
export const INDUSTRY_OPTIONS = [
  { label: '制造业', value: 1 },
  { label: '贸易', value: 2 },
  { label: '科技', value: 3 },
  { label: '电子', value: 4 },
  { label: '医药', value: 5 },
  { label: '化工', value: 6 },
  { label: '机械', value: 7 },
  { label: '建材', value: 8 },
  { label: '服装纺织', value: 9 },
  { label: '农业', value: 10 },
  { label: '食品', value: 11 },
  { label: '物流运输', value: 12 },
  { label: '建筑工程', value: 13 },
  { label: '能源', value: 14 },
  { label: '金融服务', value: 15 },
  { label: '其他', value: 16 },
]

/** 跟进状态：取值与客户状态一致，与跟进记录页保持相同约定 */
export const FOLLOW_UP_STATUS_OPTIONS = [
  { label: '潜在', value: 1 },
  { label: '跟进中', value: 2 },
  { label: '已合作', value: 3 },
  { label: '流失', value: 4 },
  { label: '无效', value: 5 },
]

/** 是否类字段：tinyint(1) 1是 0否 */
export const YES_NO_OPTIONS = [
  { label: '是', value: 1 },
  { label: '否', value: 0 },
]

/** 币种选项（与 crm_master_data.revenue_currency / potential_currency 取值一致） */
export const CURRENCY_OPTIONS = [
  { label: '人民币 CNY', value: 'CNY' },
  { label: '美元 USD', value: 'USD' },
  { label: '欧元 EUR', value: 'EUR' },
  { label: '英镑 GBP', value: 'GBP' },
  { label: '日元 JPY', value: 'JPY' },
  { label: '迪拉姆 AED', value: 'AED' },
  { label: '卢比 INR', value: 'INR' },
]

/** 币种符号（没有符号的币种直接跟在数值后面） */
const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
}

/** 币种别名 / 符号 → 标准币种代码 */
const CURRENCY_ALIASES = {
  $: 'USD',
  '＄': 'USD',
  '¥': 'CNY',
  '￥': 'CNY',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  RMB: 'CNY',
  CNY: 'CNY',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  AED: 'AED',
  INR: 'INR',
  人民币: 'CNY',
  美元: 'USD',
  美金: 'USD',
  欧元: 'EUR',
  英镑: 'GBP',
  日元: 'JPY',
  迪拉姆: 'AED',
  卢比: 'INR',
}

/**
 * 币种归一化：把「美元 / USD / $ / 美元 USD」这类写法统一成标准币种代码。
 * 取不到标准代码时原样返回（保留后端自定义币种）。
 */
export function normalizeCurrency(value) {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  if (!text) return ''
  const upper = text.toUpperCase()
  if (CURRENCY_OPTIONS.some((o) => o.value === upper)) return upper
  const alias = CURRENCY_ALIASES[text] || CURRENCY_ALIASES[upper]
  if (alias) return alias
  const opt = CURRENCY_OPTIONS.find((o) => o.label.includes(text) || text.includes(o.label))
  if (opt) return opt.value
  if (/^[A-Z]{3}$/.test(upper)) return upper
  return text
}

/**
 * 金额展示：数值 + 币种（币种可为空，此时只展示数值）。
 * 例：1234.5 + USD → $1,234.5；1234.5 + AED → AED 1,234.5
 */
export function formatAmount(value, currency) {
  if (value == null || value === '') return '—'
  const num = Number(value)
  const code = normalizeCurrency(currency)
  if (Number.isNaN(num)) return code ? `${value} ${code}` : String(value)
  const text = num.toLocaleString()
  if (!code) return text
  const symbol = CURRENCY_SYMBOLS[code]
  return symbol ? `${symbol}${text}` : `${text} ${code}`
}

/**
 * 从「1.27 billion USD」「$1.2B」这类营收文本里抽出币种，
 * 用于后端只返回带单位的数值、没有单独给币种字段的场景。
 */
export function extractCurrency(text) {
  if (text == null || text === '') return ''
  const s = String(text)
  const aliasMatch = s.match(/(人民币|美元|美金|欧元|英镑|日元|迪拉姆|卢比)/)
  if (aliasMatch) return normalizeCurrency(aliasMatch[1])
  const symbolMatch = s.match(/[$€£¥₹]/)
  if (symbolMatch) return normalizeCurrency(symbolMatch[0])
  const codeMatch = s.match(/\b[A-Z]{3}\b/)
  if (codeMatch) return normalizeCurrency(codeMatch[0])
  return ''
}

/**
 * 按 options 取展示名，取不到时回退为原始值。
 * 后端返回的 *_id 可能是字符串，这里统一按数值比较。
 */
export function optionLabel(options, value) {
  if (value == null || value === '') return ''
  const found = options.find((o) => Number(o.value) === Number(value))
  return found?.label ?? String(value)
}

/** id 归一化为数字，保证 el-select 的 value 与 option 的 value 类型一致 */
export function normalizeId(value) {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isNaN(num) ? '' : num
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * 后端返回的日期是 RFC1123 格式（如 'Wed, 25 Oct 2026 00:00:00 GMT'），
 * 统一转成 'YYYY-MM-DD' 供 el-date-picker 回显。
 */
export function toDateValue(value) {
  if (value == null || value === '') return ''
  const text = String(value)
  if (text.includes('GMT')) {
    const p = text.split(' ')
    if (p.length >= 5) {
      const month = MONTHS.indexOf(p[2]) + 1
      const mm = month > 0 ? String(month).padStart(2, '0') : p[2]
      return `${p[3]}-${mm}-${p[1]}`
    }
    return ''
  }
  return text.replace('T', ' ').slice(0, 10)
}

/**
 * 日期展示：RFC1123 / ISO 统一成 'YYYY-MM-DD HH:mm:ss'，
 * 与客户列表、联系人列表的日期处理保持一致。
 */
export function formatDateTime(value) {
  if (value == null || value === '') return '—'
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

// ————————————————————————————————————————————————
// 深入分析（DeepSeek）结果 → 客户详情表单字段的映射
// ————————————————————————————————————————————————
//
// 后端 /crm/deep-analysis 返回的是一组「信息项」（company_name、business_scope、
// key_contacts ...），与客户详情页的表单字段（crm_master_data）不是一一对应。
// 这里的规则把两边对齐：
//
// 1. 能对上表单字段的 → 写入对应字段（原值为空直接填入，有原值则直接替换）；
// 2. 对不上表单字段的 → 按内容性质打包进「基本信息」或「备注」，
//    在多行文本里按「标签」定位并替换同名行，没有同名标签才新增一行；
// 3. 写不进去的（数量型、下拉型与原值冲突等）→ 记入备注并在结果面板里标注。

/** 深入分析结果的中文字段名（与后端 ANALYSIS_FIELDS 保持一致） */
export const ANALYSIS_LABELS = {
  company_name: '公司名称',
  company_name_en: '公司英文名称',
  short_name: '公司简称',
  company_type: '企业类型',
  website: '公司官网',
  country: '国家/地区',
  country_cn: '国家/地区（中文）',
  region: '所属地区',
  address: '总部地址',
  founded_year: '成立年份',
  industry: '所属行业',
  industry_cn: '所属行业（中文）',
  business_scope: '主营业务介绍',
  main_products: '主要产品/服务',
  company_size: '企业规模',
  employee_count: '员工人数',
  company_revenue: '年营业额',
  revenue_currency: '营收币种',
  parent_company: '母公司/所属集团',
  listing_status: '上市情况',
  export_markets: '主要市场/出口地区',
  certifications: '资质与认证',
  customer_needs: '采购需求分析',
  competitive_advantages: '竞争优势',
  key_contacts: '关键联系人',
  follow_up_strategy: '跟进策略',
  background_check: '背景调查',
  remark: '备注',
}

/**
 * 能与表单字段对应的分析项。
 * type:
 *  - text / multiline：文本，直接写入目标字段（原值为空填入，有原值则替换）
 *  - website：网址，单值字段，原值为空填入，有原值则替换
 *  - revenue：数量型，数值写入，单位说明打包进基本信息
 *  - enum：下拉型，用 label 反查 option.value；查不到则退回基本信息
 */
export const ANALYSIS_MAPPING = [
  { key: 'company_name', label: '公司名称', target: 'company_name', type: 'text', targetLabel: '公司名称' },
  { key: 'company_name_en', label: '公司英文名称', target: 'company_name_en', type: 'text', targetLabel: '英文名称' },
  { key: 'short_name', label: '公司简称', target: 'short_name', type: 'text', targetLabel: '简称' },
  { key: 'website', label: '公司官网', target: 'website', type: 'website', targetLabel: '网址' },
  {
    key: 'company_type',
    label: '企业类型',
    target: 'customer_type_id',
    type: 'enum',
    options: 'CUSTOMER_TYPE_OPTIONS',
    targetLabel: '客户性质',
  },
  {
    key: 'country_cn',
    label: '国家/地区（中文）',
    target: 'country_id',
    type: 'enum',
    options: 'COUNTRY_OPTIONS',
    fallbackKey: 'country',
    targetLabel: '国家',
  },
  {
    key: 'region',
    label: '所属地区',
    target: 'region_id',
    type: 'enum',
    options: 'REGION_OPTIONS',
    targetLabel: '区域',
  },
  {
    key: 'industry_cn',
    label: '所属行业（中文）',
    target: 'industry_id',
    type: 'enum',
    options: 'INDUSTRY_OPTIONS',
    fallbackKey: 'industry',
    targetLabel: '行业',
  },
  {
    key: 'company_size',
    label: '企业规模',
    target: 'company_size_id',
    type: 'enum',
    options: 'COMPANY_SIZE_OPTIONS',
    targetLabel: '公司规模',
  },
  { key: 'company_revenue', label: '年营业额', target: 'company_revenue', type: 'revenue', targetLabel: '销售额' },
  { key: 'revenue_currency', label: '营收币种', target: 'revenue_currency', type: 'currency', targetLabel: '币种' },
  { key: 'address', label: '总部地址', target: 'address', type: 'address', targetLabel: '地址' },
  { key: 'customer_needs', label: '采购需求分析', target: 'customer_needs', type: 'multiline', targetLabel: '客户需求' },
  { key: 'follow_up_strategy', label: '跟进策略', target: 'follow_up_strategy', type: 'multiline', targetLabel: '跟进策略' },
  { key: 'background_check', label: '背景调查', target: 'background_check', type: 'multiline', targetLabel: '背景调查' },
  { key: 'remark', label: '备注', target: 'remark', type: 'multiline', targetLabel: '备注' },
]

/** 没有对应表单字段，打包进「基本信息」的信息项 */
export const BASIC_INFO_KEYS = [
  'business_scope',
  'main_products',
  'founded_year',
  'employee_count',
  'parent_company',
]

/** 没有对应表单字段，打包进「备注」的信息项 */
export const REMARK_KEYS = [
  'certifications',
  'competitive_advantages',
  'key_contacts',
  'listing_status',
  'export_markets',
]

/**
 * 兜底分组：ANALYSIS_MAPPING / BASIC_INFO_KEYS / REMARK_KEYS 都没覆盖到的 key，
 * 按 key 名归类到基本信息或备注，保证后端新增字段时不会漏掉。
 * value 为分组名，'basic' = 基本信息，'remark' = 备注。
 */
export const ANALYSIS_FALLBACK_GROUP = {
  currency: 'remark',
  revenue: 'remark',
  address: 'basic',
  employee: 'basic',
  employees: 'basic',
  staff: 'basic',
  headcount: 'basic',
  founded: 'basic',
  established: 'basic',
  year: 'basic',
  size: 'basic',
  scale: 'basic',
  product: 'basic',
  service: 'basic',
  scope: 'basic',
  business: 'basic',
  parent: 'basic',
  group: 'basic',
  subsidiary: 'basic',
  brand: 'basic',
  market: 'remark',
  export: 'remark',
  certificate: 'remark',
  certification: 'remark',
  contact: 'remark',
  person: 'remark',
  ceo: 'remark',
  cto: 'remark',
  listing: 'remark',
  stock: 'remark',
  ticker: 'remark',
  advantage: 'remark',
  strength: 'remark',
  risk: 'remark',
  note: 'remark',
  remark: 'remark',
}

/**
 * 在多行文本里按「标签：」定位并替换该行的内容：
 * - 找到同标签的行 → 直接替换该行的值（不追加到末尾）；
 * - 没找到 → 作为新行追加到末尾；
 * - 文本为空 → 只放这一行。
 */
export function replaceLabeledLine(text, label, value) {
  const content = text == null ? '' : String(text)
  const val = value == null ? '' : String(value).trim()
  if (!val) return content
  const prefixes = [`${label}：`, `${label}:`]
  const lines = content.split('\n')
  let hit = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (prefixes.some((p) => t.startsWith(p))) {
      hit = i
      break
    }
  }
  const line = `${label}：${val}`
  if (hit >= 0) {
    lines[hit] = line
    return lines.join('\n')
  }
  if (!content.trim()) return line
  return `${content.replace(/\n+$/, '')}\n${line}`
}

/**
 * 读取多行文本里某个「标签：」对应的值，取不到返回空串。
 */
export function readLabeledLine(text, label) {
  if (text == null || text === '') return ''
  const prefixes = [`${label}：`, `${label}:`]
  for (const line of String(text).split('\n')) {
    const t = line.trim()
    for (const p of prefixes) {
      if (t.startsWith(p)) return t.slice(p.length).trim()
    }
  }
  return ''
}

/**
 * 批量把「标签：值」写进多行文本：
 * 已有同标签的行 → 直接替换该行；没有 → 作为新行追加到末尾。
 * 返回写入后的文本与「实际发生变化」的条目列表。
 */
export function applyLabeledLines(text, entries) {
  let content = text == null ? '' : String(text)
  const changes = []
  for (const entry of entries) {
    const { label, value } = entry
    if (value == null || String(value).trim() === '') continue
    const before = content
    content = replaceLabeledLine(content, label, value)
    if (content !== before) {
      changes.push({ label, old: before, new: content })
    }
  }
  return { content, changes }
}

/** 按 label 反查下拉选项的 value */
export function labelToValue(options, label) {
  if (label == null || label === '') return null
  const text = String(label).trim()
  const found = options.find((o) => o.label === text)
  if (found) return found.value
  const loose = options.find((o) => String(o.label).includes(text) || text.includes(String(o.label)))
  return loose ? loose.value : null
}

/** 「总部地址：xxx」这类以中文冒号开头的行前缀 */
export const ADDRESS_LINE_PREFIX = '总部地址：'

/**
 * 从 customer_basic_info 里拆出「总部地址」这一行。
 *
 * crm_master_data 表里没有独立的 address 列，地址是存在 customer_basic_info
 * 文本中的一行（形如「总部地址：xxx」）。这里把它单独抽出来展示成「地址」行，
 * 剩下的内容继续留在「基本信息」里。
 */
export function extractAddress(basicInfo) {
  if (basicInfo == null || basicInfo === '') return { address: '', rest: '' }
  const lines = String(basicInfo).split('\n')
  const addressLines = []
  const restLines = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(ADDRESS_LINE_PREFIX) || trimmed.startsWith('地址：')) {
      addressLines.push(trimmed.replace(/^(总部地址|地址)：/, '').trim())
    } else {
      restLines.push(line)
    }
  }
  return {
    address: addressLines.filter(Boolean).join('、'),
    rest: restLines.join('\n'),
  }
}

/**
 * 把地址写回 customer_basic_info：
 * - 已有地址行 → 就在原位置替换成新地址（不改变行序）；
 * - 没有地址行 → 作为首行插入。
 */
export function mergeAddress(basicInfo, address) {
  const addr = address == null ? '' : String(address).trim()
  if (!addr) return extractAddress(basicInfo).rest
  const content = basicInfo == null ? '' : String(basicInfo)
  const lines = content.split('\n')
  let hit = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith(ADDRESS_LINE_PREFIX) || t.startsWith('地址：')) {
      hit = i
      break
    }
  }
  if (hit >= 0) {
    lines[hit] = `${ADDRESS_LINE_PREFIX}${addr}`
    return lines.join('\n').replace(/\n+$/, '')
  }
  const { rest } = extractAddress(content)
  return `${ADDRESS_LINE_PREFIX}${addr}\n${rest}`.replace(/\n+$/, '')
}
