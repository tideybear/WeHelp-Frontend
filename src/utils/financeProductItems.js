/** 财务应收/应付产品明细行 */

import { parseMergedDisplayIds } from '@/utils/financeListDisplay'

export const DEFAULT_TAX_RATE = 13

export const FINANCE_ITEM_MERGE_PRICE_PROPS = ['unit_price', 'amount']

let _clientIdSeq = 0

export function createClientItemId() {
  _clientIdSeq += 1
  return `ci-${Date.now()}-${_clientIdSeq}`
}

export function createEmptyFinanceItem() {
  return {
    _clientId: createClientItemId(),
    _mergeGroupId: null,
    product_name: '',
    specification: '',
    unit: '',
    quantity: undefined,
    unit_price: undefined,
    amount: undefined,
    tax_rate: DEFAULT_TAX_RATE,
    remark: '',
  }
}

export function isMergedItemRow(row) {
  return Boolean(String(row?._mergeGroupId ?? '').trim())
}

export function getMergeGroupRows(items, mergeGroupId) {
  const gid = String(mergeGroupId ?? '').trim()
  if (!gid) return []
  return (Array.isArray(items) ? items : []).filter(
    (r) => String(r?._mergeGroupId ?? '').trim() === gid,
  )
}

export function buildMergedDisplayIdsForGroup(rows) {
  const ids = (Array.isArray(rows) ? rows : [])
    .map((r) => {
      if (r?.id != null && r.id !== '') return String(r.id)
      return String(r?._clientId ?? '').trim()
    })
    .filter(Boolean)
  return [...new Set(ids)].join(',')
}

export function isMergeGroupLeader(row, items) {
  if (!isMergedItemRow(row)) return false
  const group = getMergeGroupRows(items, row._mergeGroupId)
  return group.length > 0 && group[0]?._clientId === row._clientId
}

/** 合计：合并组只计一次金额 */
export function resolveRowAmountForTotal(row, items) {
  if (!row || typeof row !== 'object') return undefined
  if (isMergedItemRow(row)) {
    if (!isMergeGroupLeader(row, items)) return 0
    const amt = Number(row.amount)
    if (Number.isFinite(amt) && amt > 0) return amt
    return undefined
  }
  const calc = calcLineAmount(row.quantity, row.unit_price)
  if (Number.isFinite(calc)) return calc
  const amt = Number(row.amount)
  return Number.isFinite(amt) ? amt : undefined
}

/** 将同组明细排在一起并附加 _mergeSpan，供编辑器/表格 rowspan */
export function orderItemsForMergeDisplay(items) {
  if (!Array.isArray(items) || items.length < 2) return items || []
  const list = [...items]
  const consumed = new Set()
  const ordered = []

  for (const item of list) {
    const itemId = item?.id
    const clientId = item?._clientId
    const consumedKey = itemId != null ? `id:${itemId}` : clientId
    if (consumedKey && consumed.has(consumedKey)) continue

    const key = parseMergedDisplayIds(item?.merged_display_ids)
    if (!key) {
      ordered.push(item)
      if (consumedKey) consumed.add(consumedKey)
      continue
    }

    const group = list.filter(
      (row) => parseMergedDisplayIds(row?.merged_display_ids) === key,
    )
    for (const row of group) {
      const rk = row?.id != null ? `id:${row.id}` : row?._clientId
      if (rk) consumed.add(rk)
    }
    ordered.push(...group)
  }
  return ordered
}

function buildItemMergeSpanMeta(items) {
  const len = Array.isArray(items) ? items.length : 0
  const spanMeta = Array.from({ length: len }, () => ({ rowspan: 1, colspan: 1 }))
  if (!len) return spanMeta

  const groups = new Map()
  items.forEach((item, idx) => {
    const key =
      String(item?._mergeGroupId ?? '').trim() ||
      parseMergedDisplayIds(item?.merged_display_ids)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(idx)
  })

  for (const indices of groups.values()) {
    if (indices.length < 2) continue
    spanMeta[indices[0]] = { rowspan: indices.length, colspan: 1 }
    for (let i = 1; i < indices.length; i++) {
      spanMeta[indices[i]] = { rowspan: 0, colspan: 0 }
    }
  }
  return spanMeta
}

/** 编辑器展示用：排序 + rowspan 元数据 */
export function prepareEditorItemsForDisplay(items) {
  const list = Array.isArray(items) ? items : []
  const ordered = orderItemsForMergeDisplay(list)
  const spanMeta = buildItemMergeSpanMeta(ordered)
  return ordered.map((row, index) => ({
    ...row,
    _mergeSpan: spanMeta[index],
  }))
}

/** 编辑器表格 span-method */
export function financeProductItemsSpanMethod({ row, column }) {
  const prop = column?.property
  if (!FINANCE_ITEM_MERGE_PRICE_PROPS.includes(prop)) {
    return { rowspan: 1, colspan: 1 }
  }
  if (!row?._mergeSpan) return { rowspan: 1, colspan: 1 }
  return row._mergeSpan
}

/** 详情接口 items → 编辑器行 */
export function mapApiItemsToEditorRows(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  const rows = items.map((row) => {
    const quantity =
      row?.quantity != null && row?.quantity !== '' ? Number(row.quantity) : undefined
    const unit_price =
      row?.unit_price != null && row?.unit_price !== '' ? Number(row.unit_price) : undefined
    let amount =
      row?.amount != null && row?.amount !== '' ? Number(row.amount) : undefined
    const mergedIds = parseMergedDisplayIds(row?.merged_display_ids)
    const isMerged = mergedIds !== ''
    if (!isMerged && !Number.isFinite(amount)) {
      amount = calcLineAmount(quantity, unit_price)
    }
    let tax_rate = DEFAULT_TAX_RATE
    if (row?.tax_rate != null && row?.tax_rate !== '') {
      const tr = Number(String(row.tax_rate).replace(/%/g, ''))
      if (Number.isFinite(tr)) tax_rate = tr
    }
    let _mergeGroupId = null
    if (isMerged) {
      _mergeGroupId = `mg-${mergedIds}`
    }
    return {
      _clientId: row?.id != null ? `db-${row.id}` : createClientItemId(),
      _mergeGroupId,
      id: row?.id,
      product_name: String(row?.product_name ?? ''),
      specification: String(row?.specification ?? ''),
      unit: String(row?.unit ?? ''),
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      unit_price: Number.isFinite(unit_price) ? unit_price : undefined,
      amount: Number.isFinite(amount) ? amount : undefined,
      tax_rate,
      remark: String(row?.remark ?? ''),
      merged_display_ids: mergedIds || undefined,
    }
  })
  return prepareEditorItemsForDisplay(rows)
}

/** 未填写任何内容的行视为未添加，不参与校验 */
export function isBlankItemRow(row) {
  if (!row || typeof row !== 'object') return true
  if (String(row.product_name ?? '').trim()) return false
  const hasQty = row.quantity != null && row.quantity !== ''
  const hasPrice = row.unit_price != null && row.unit_price !== ''
  const hasAmount =
    row.amount != null && row.amount !== '' && Number(row.amount) > 0
  return !hasQty && !hasPrice && !hasAmount
}

export function calcLineAmount(quantity, unitPrice) {
  const q = Number(quantity)
  const p = Number(unitPrice)
  if (!Number.isFinite(q) || !Number.isFinite(p)) return undefined
  return Math.round(q * p * 100) / 100
}

function parseTaxRate(raw) {
  if (raw == null || raw === '') return DEFAULT_TAX_RATE
  const n = Number(String(raw).replace(/%/g, '').trim())
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_TAX_RATE
  return Math.round(n * 100) / 100
}

/** 用户点击「添加一行」后的行：整行校验，不允许留空 */
export function normalizeItemForSubmit(row, allItems) {
  const product_name = String(row.product_name ?? '').trim()
  const quantity =
    row.quantity != null && row.quantity !== '' ? Number(row.quantity) : undefined
  const unit_price =
    row.unit_price != null && row.unit_price !== '' ? Number(row.unit_price) : undefined
  const merged = isMergedItemRow(row)
  let amount

  if (merged) {
    const amtRaw = row.amount != null && row.amount !== '' ? Number(row.amount) : undefined
    amount = Number.isFinite(amtRaw) ? Math.round(amtRaw * 100) / 100 : undefined
  } else {
    amount = calcLineAmount(quantity, unit_price)
    if (amount == null && row.amount != null && row.amount !== '') {
      const a = Number(row.amount)
      amount = Number.isFinite(a) ? a : undefined
    }
  }

  if (!product_name) {
    return { error: '产品/货款名称不能为空' }
  }
  if (merged) {
    if (unit_price == null || !Number.isFinite(unit_price) || unit_price < 0) {
      return { error: '合并行请填写有效单价' }
    }
    if (amount == null || amount <= 0) {
      return { error: '合并行请填写有效金额' }
    }
  } else if (amount == null || amount <= 0) {
    return { error: '请填写有效的数量、单价' }
  }

  const out = {
    product_name,
    specification: String(row.specification ?? '').trim() || undefined,
    unit: String(row.unit ?? '').trim() || undefined,
    quantity: Number.isFinite(quantity) ? quantity : undefined,
    unit_price: Number.isFinite(unit_price) ? unit_price : undefined,
    amount,
    tax_rate: parseTaxRate(row.tax_rate),
    remark: String(row?.remark ?? '').trim() || undefined,
    _client_id: String(row._clientId ?? '').trim() || undefined,
  }

  if (merged) {
    const group = getMergeGroupRows(allItems, row._mergeGroupId)
    const merged_display_ids = buildMergedDisplayIdsForGroup(group)
    if (merged_display_ids) {
      out.merged_display_ids = merged_display_ids
    }
  }

  return out
}

function activeItemRows(items) {
  return (Array.isArray(items) ? items : []).filter((row) => !isBlankItemRow(row))
}

export function buildItemsPayload(items) {
  const list = activeItemRows(items)
  const out = []
  let total = 0
  for (let i = 0; i < list.length; i++) {
    const normalized = normalizeItemForSubmit(list[i], items)
    if (normalized.error) {
      return { error: `第 ${i + 1} 行：${normalized.error}` }
    }
    out.push(normalized)
    const rowAmt = resolveRowAmountForTotal(list[i], items)
    if (Number.isFinite(rowAmt)) total += rowAmt
  }
  return {
    items: out,
    amount: Math.round(total * 100) / 100,
  }
}

/** 无明细行时允许提交；仅校验用户实际填写过的行 */
export function validateItemsForSubmit(items) {
  const list = activeItemRows(items)
  if (!list.length) {
    return { ok: true, items: [], amount: 0 }
  }
  const built = buildItemsPayload(items)
  if (built.error) {
    return { ok: false, message: built.error }
  }
  return { ok: true, items: built.items, amount: built.amount }
}
