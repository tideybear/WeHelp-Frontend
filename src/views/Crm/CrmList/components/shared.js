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
  { label: '企业', value: 1 },
  { label: '个人', value: 2 },
  { label: '政府机构', value: 3 },
  { label: '事业单位', value: 4 },
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
