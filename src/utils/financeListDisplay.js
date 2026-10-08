/** 子行展示的列 */
export const FINANCE_PRODUCT_COLUMN_PROPS = [
  'product_name',
  'specification',
  'unit',
  'quantity',
  'unit_price',
  'amount',
]

/** merged_display_ids 非空时，子行单价/金额列合并展示 */
export const FINANCE_MERGE_PRICE_COLUMN_PROPS = ['unit_price', 'amount']

export function parseMergedDisplayIds(val) {
  return String(val ?? '').trim()
}

export function itemHasMergedDisplay(item) {
  return parseMergedDisplayIds(item?.merged_display_ids) !== ''
}

/** 将同组 merged_display_ids 的明细排在一起，便于表格 rowspan 合并 */
function orderItemsForMergeDisplay(items) {
  if (!Array.isArray(items) || items.length < 2) return items || []
  const list = [...items]
  const consumed = new Set()
  const ordered = []

  for (const item of list) {
    const itemId = item?.id
    if (itemId != null && consumed.has(itemId)) continue

    const key = parseMergedDisplayIds(item?.merged_display_ids)
    if (!key) {
      ordered.push(item)
      if (itemId != null) consumed.add(itemId)
      continue
    }

    const group = list.filter(
      (row) => parseMergedDisplayIds(row?.merged_display_ids) === key,
    )
    for (const row of group) {
      if (row?.id != null) consumed.add(row.id)
    }
    ordered.push(...group)
  }
  return ordered
}

/** 同一主记录下，按 merged_display_ids 计算子行 rowspan（仅 item 行） */
function buildItemMergeSpanMeta(items) {
  const len = Array.isArray(items) ? items.length : 0
  const spanMeta = Array.from({ length: len }, () => ({ rowspan: 1, colspan: 1 }))
  if (!len) return spanMeta

  const groups = new Map()
  items.forEach((item, idx) => {
    const key = parseMergedDisplayIds(item?.merged_display_ids)
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

/** 有子明细时主行需留空的列（金额、合同金额仍在主行展示） */
export const FINANCE_MAIN_HIDDEN_PRODUCT_PROPS = [
  'product_name',
  'specification',
  'unit',
  'quantity',
  'unit_price',
]

export function isFinanceListMainRow(row) {
  return row?._rowKind === 'main'
}

/** 产品/付款子行在首列展示的序号文案（产品1、付款1 / 收款1） */
export function formatFinanceListSubRowLabel(row, options = {}) {
  if (row?._rowKind === 'item') {
    const n = row._itemIndex
    return n != null ? `产品${n}` : '产品'
  }
  if (row?._rowKind === 'payment') {
    const n = row._paymentIndex
    const prefix = options.financeType === 'receivable' ? '收款' : '付款'
    return n != null ? `${prefix}${n}` : prefix
  }
  return ''
}

export function isFinanceListGroupRow(row) {
  return row?._rowKind === 'group'
}

/** 项目详情台账：分组/主行展开用的 id */
export function financeListRowExpandKey(row) {
  if (!row) return null
  if (row._rowKind === 'group') return row._groupId ?? null
  return row._recordId ?? row._parentId ?? null
}

function normalizeProjectDetailCustomerGroupKey(record) {
  const name = String(record?.customer_name ?? '').trim()
  const pid = record?.project_id ?? ''
  return `${pid}\0${name}`
}

/** 项目详情组内记录排序：收款/付款日期优先，其次创建时间 */
export function getProjectDetailRecordSortTime(record, options = {}) {
  const paymentDateProp = options.paymentDateProp ?? 'payment_date'
  const candidates = [
    record?.[paymentDateProp],
    record?.created_at,
    record?.updated_at,
    record?.invoice_date,
    record?.warehouse_date,
  ]
  for (const d of candidates) {
    if (d == null || d === '') continue
    const t = new Date(d).getTime()
    if (Number.isFinite(t)) return t
  }
  return 0
}

/** 主行金额：仅按子产品明细合计，无明细或无法解析时为 0；合并组只计一次 */
export function sumFinanceItemAmounts(items) {
  if (!Array.isArray(items) || items.length === 0) return 0
  const mergeGroupsCounted = new Set()
  let sum = 0
  for (const item of items) {
    const mergedKey = parseMergedDisplayIds(item?.merged_display_ids)
    if (mergedKey) {
      if (mergeGroupsCounted.has(mergedKey)) continue
      mergeGroupsCounted.add(mergedKey)
    }
    const raw = item?.amount ?? item?.total_amount
    const n = Number(String(raw ?? '').replace(/,/g, '').trim())
    if (Number.isFinite(n)) {
      sum += n
    }
  }
  return sum
}

/** 主行实付/实收：按付款明细金额合计，不从主表字段读取 */
export function sumFinancePaymentAmounts(paymentRecords) {
  if (!Array.isArray(paymentRecords) || paymentRecords.length === 0) return 0
  let sum = 0
  for (const row of paymentRecords) {
    const n = Number(String(row?.amount ?? '').replace(/,/g, '').trim())
    if (Number.isFinite(n)) {
      sum += n
    }
  }
  return Math.round(sum * 100) / 100
}

export function formatFinanceListMoney(val) {
  if (val === null || val === undefined || val === '') return ''
  const n = Number(String(val).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return ''
  if (n === 0) return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 应收无 invoice_status 字段时，按开票日期推导展示用发票情况 */
export function resolveReceivableInvoiceStatusFromRecord(record) {
  if (!record || typeof record !== 'object') return '未开票'
  const explicit = String(record.invoice_status ?? '').trim()
  if (explicit) return explicit
  const date = String(record.invoice_date ?? '').trim()
  return date ? '已开票' : '未开票'
}

/** 列表主行收款/付款状态：始终使用主表数据库字段 */
export function resolveMainRecordStatus(record, financeType) {
  const val = String(record?.status ?? '').trim()
  if (val) return val
  return financeType === 'payable' ? '待付款' : '待收款'
}

export function formatFinanceListQuantity(val) {
  if (val === null || val === undefined || val === '') return ''
  const n = Number(String(val).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

/**
 * @param {object} [options]
 * @param {string} [options.paymentDateProp='payment_date'] 付款/收款日期列
 * @param {string} [options.paidAmountProp='paid_amount'] 实付/实收列
 */
export function getFinancePaymentColumnProps(options = {}) {
  const paymentDateProp = options.paymentDateProp ?? 'payment_date'
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  return [paymentDateProp, paidAmountProp]
}

/** 项目详情台账：子行仅展示货款名称、金额 */
export const PROJECT_LEDGER_ITEM_PROPS = ['product_name', 'amount']

/** 项目详情台账：有产品明细时主行隐藏货款名称 */
export const PROJECT_LEDGER_MAIN_HIDDEN_PRODUCT_PROPS = ['product_name']

/** 项目详情应收/应付：第二行（各列对齐展示摘要字段） */
export function isProjectDetailLedgerSummaryRow(row) {
  return row?._rowKind === 'main-meta'
}

/** 项目详情分组头行需汇总的金额列（不含实付/实收，由 paidAmountProp 决定） */
export const PROJECT_DETAIL_GROUP_SUMMARY_PROPS = [
  'customer_name',
  'contract_account',
  'discount_amount',
  'amount',
]

function getProjectDetailGroupSummaryProps(options = {}) {
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  return [...PROJECT_DETAIL_GROUP_SUMMARY_PROPS, paidAmountProp]
}

function parseFinanceMoney(val) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

/** 单条记录在列表中的展示用金额（与主行逻辑一致） */
function getRecordDisplayAmount(record) {
  const items = Array.isArray(record?.items) ? record.items : []
  const fromItems = sumFinanceItemAmounts(items)
  if (items.length > 0) return fromItems
  return parseFinanceMoney(record?.amount ?? record?.total_amount)
}

function getRecordDisplayPaidAmount(record, options = {}) {
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  const payments = Array.isArray(record?.payment_records) ? record.payment_records : []
  const fromPayments = sumFinancePaymentAmounts(payments)
  if (payments.length > 0) return fromPayments
  return parseFinanceMoney(record?.[paidAmountProp])
}

/** 展示用合同金额 = 合同金额 − 优惠金额（不小于 0） */
export function getFinanceListNetContractAccount(record) {
  const contract = parseFinanceMoney(record?.contract_account)
  const discount = parseFinanceMoney(record?.discount_amount)
  return Math.max(0, Math.round((contract - discount) * 100) / 100)
}

/** 未付/未收 = 合同金额 − 优惠金额 − 实付/实收（不小于 0） */
export function computeFinanceRecordUnpaidAmount(record, options = {}) {
  const contract = parseFinanceMoney(record?.contract_account)
  const discount = parseFinanceMoney(record?.discount_amount)
  const paid = getRecordDisplayPaidAmount(record, options)
  const net = Math.max(0, Math.round((contract - discount) * 100) / 100)
  return Math.max(0, Math.round((net - paid) * 100) / 100)
}

/** 同客户/供应商分组：合同金额、金额、实付/实收合计 */
export function sumProjectDetailGroupTotals(records, options = {}) {
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  let contractTotal = 0
  let discountTotal = 0
  let amountTotal = 0
  let paidTotal = 0
  const useNetContract = Boolean(options.projectDetailNetContract)
  for (const record of records || []) {
    if (useNetContract) {
      contractTotal += getFinanceListNetContractAccount(record)
    } else {
      contractTotal += parseFinanceMoney(record?.contract_account)
      discountTotal += parseFinanceMoney(record?.discount_amount)
    }
    amountTotal += getRecordDisplayAmount(record)
    paidTotal += getRecordDisplayPaidAmount(record, options)
  }
  const round2 = (n) => Math.round(n * 100) / 100
  return {
    contract_account: round2(contractTotal),
    discount_amount: round2(discountTotal),
    amount: round2(amountTotal),
    [paidAmountProp]: round2(paidTotal),
  }
}

function shouldShowProjectDetailSummaryCell(row, colProp, options) {
  const paymentDateProp = options.paymentDateProp ?? 'payment_date'
  if (colProp === 'customer_name') {
    return false
  }
  if (row._hasItems && FINANCE_MAIN_HIDDEN_PRODUCT_PROPS.includes(colProp)) {
    return false
  }
  if (row._hasPayments && colProp === paymentDateProp) {
    return false
  }
  return true
}

/** 该列在当前行是否展示内容 */
export function shouldShowFinanceListCell(row, colProp, options = {}) {
  if (!row) return false
  const paymentDateProp = options.paymentDateProp ?? 'payment_date'
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  const paymentCols = getFinancePaymentColumnProps(options)

  if (options.projectLedger) {
    if (row._rowKind === 'payment') {
      return paymentCols.includes(colProp)
    }
    if (row._rowKind === 'item') {
      return PROJECT_LEDGER_ITEM_PROPS.includes(colProp)
    }
    if (row._rowKind === 'main') {
      if (colProp === 'status' || colProp === 'invoice_status') {
        return true
      }
      if (row._hasItems && PROJECT_LEDGER_MAIN_HIDDEN_PRODUCT_PROPS.includes(colProp)) {
        return false
      }
      if (row._hasPayments && colProp === paymentDateProp) {
        return false
      }
      return true
    }
    return false
  }

  if (row._rowKind === 'payment') {
    return paymentCols.includes(colProp)
  }
  if (row._rowKind === 'item') {
    return FINANCE_PRODUCT_COLUMN_PROPS.includes(colProp)
  }
  if (row._rowKind === 'group') {
    return getProjectDetailGroupSummaryProps(options).includes(colProp)
  }

  if (row._rowKind === 'main-meta') {
    return shouldShowProjectDetailSummaryCell(row, colProp, options)
  }

  if (row._rowKind === 'main') {
    if (options.projectDetailStackedMain) {
      return colProp === 'customer_name'
    }
    if (row._hasItems && FINANCE_MAIN_HIDDEN_PRODUCT_PROPS.includes(colProp)) {
      return false
    }
    if (row._hasPayments && colProp === paymentDateProp) {
      return false
    }
    return true
  }
  return true
}

function buildFinanceMainRow(record, options, groupId = null) {
  const paymentDateProp = options.paymentDateProp ?? 'payment_date'
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  const items = Array.isArray(record.items) ? record.items : []
  const payments = Array.isArray(record.payment_records) ? record.payment_records : []
  const hasItems = items.length > 0
  const hasPayments = payments.length > 0
  const financeType = options.financeType ?? 'payable'

  const mainRow = {
    ...record,
    _rowKind: 'main',
    _hasItems: hasItems,
    _hasPayments: hasPayments,
    _recordId: record.id,
    amount: sumFinanceItemAmounts(items),
    [paidAmountProp]: sumFinancePaymentAmounts(payments),
    status: resolveMainRecordStatus(record, financeType),
  }
  if (groupId) mainRow._groupId = groupId
  if (options.deriveReceivableInvoiceStatus) {
    mainRow.invoice_status = resolveReceivableInvoiceStatusFromRecord(record)
  }
  if (hasItems) {
    for (const prop of FINANCE_MAIN_HIDDEN_PRODUCT_PROPS) {
      mainRow[prop] = null
    }
  }
  if (options.projectDetailNetContract) {
    mainRow.contract_account = getFinanceListNetContractAccount(record)
  }
  mainRow[paymentDateProp] = null
  return { mainRow, items, payments, hasItems, hasPayments, paymentDateProp, paidAmountProp }
}

function appendFinanceRecordChildRows(out, record, ctx, options) {
  const { mainRow, items, payments, hasItems, hasPayments, paymentDateProp, paidAmountProp } = ctx
  const groupId = mainRow._groupId ?? null

  if (options.projectDetailStackedMain) {
    out.push({
      ...mainRow,
      _rowKind: 'main-meta',
    })
  }

  const childGroup = groupId ? { _groupId: groupId } : {}
  if (hasItems) {
    const orderedItems = orderItemsForMergeDisplay(items)
    const mergeSpanMeta = buildItemMergeSpanMeta(orderedItems)
    orderedItems.forEach((item, index) => {
      out.push({
        _rowKind: 'item',
        _itemIndex: index + 1,
        _parentId: record.id,
        _recordId: record.id,
        id: item.id,
        product_name: item.product_name,
        specification: item.specification,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        merged_display_ids: item.merged_display_ids,
        _mergeSpan: mergeSpanMeta[index],
        ...childGroup,
      })
    })
  }

  if (hasPayments) {
    payments.forEach((pr, index) => {
      out.push({
        _rowKind: 'payment',
        _paymentIndex: index + 1,
        _parentId: record.id,
        _recordId: record.id,
        id: pr.id,
        [paymentDateProp]: pr.payment_date,
        [paidAmountProp]: pr.amount,
        ...childGroup,
      })
    })
  }
}

function appendFinanceRecordDisplayRows(out, record, options, { skipMain = false, groupId = null } = {}) {
  const ctx = buildFinanceMainRow(record, options, groupId)
  if (!skipMain) {
    out.push(ctx.mainRow)
  }
  appendFinanceRecordChildRows(out, record, ctx, options)
}

function buildProjectDetailGroupedFinanceRows(records, options) {
  const groups = new Map()
  for (const record of records || []) {
    const key = normalizeProjectDetailCustomerGroupKey(record)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }

  const groupEntries = [...groups.entries()].sort((a, b) => {
    const maxA = Math.max(...a[1].map((r) => getProjectDetailRecordSortTime(r, options)))
    const maxB = Math.max(...b[1].map((r) => getProjectDetailRecordSortTime(r, options)))
    return maxB - maxA
  })

  const out = []
  for (const [groupKey, groupRecords] of groupEntries) {
    const sorted = [...groupRecords].sort(
      (a, b) => getProjectDetailRecordSortTime(b, options) - getProjectDetailRecordSortTime(a, options),
    )
    const first = sorted[0]
    const groupId = `pdg:${groupKey}`
    const groupTotals = sumProjectDetailGroupTotals(sorted, options)
    out.push({
      customer_name: first.customer_name,
      project_id: first.project_id,
      ...groupTotals,
      _rowKind: 'group',
      _groupId: groupId,
      _recordCount: sorted.length,
      _hasItems: false,
      _hasPayments: false,
    })

    for (const record of sorted) {
      appendFinanceRecordDisplayRows(out, record, options, { skipMain: true, groupId })
    }
  }
  return out
}

/**
 * 将接口记录展开为表格行：主行 + 产品明细子行 + 付款/收款明细子行
 */
export function buildFinanceListDisplayRows(records, options = {}) {
  if (options.projectDetailGroupByCustomer && options.projectDetailStackedMain) {
    return buildProjectDetailGroupedFinanceRows(records, options)
  }

  const out = []
  for (const record of records || []) {
    appendFinanceRecordDisplayRows(out, record, options)
  }
  return out
}

/** 从展示行解析主表记录（用于查看/删除） */
export function resolveFinanceListRecord(displayRow, dataList) {
  if (!displayRow) return null
  const id = displayRow._recordId ?? displayRow.id
  const found = (dataList || []).find((r) => r.id === id)
  if (found) return found
  return displayRow._rowKind === 'main' ? displayRow : null
}

export function financeListRowHasDetails(row) {
  if (row?._rowKind === 'group') return (row._recordCount ?? 0) > 0
  return row?._rowKind === 'main' && Boolean(row._hasItems || row._hasPayments)
}

/** 按展开状态过滤产品/付款子行，默认仅展示主行 */
export function filterFinanceListDisplayRows(rows, expandedIds, options = {}) {
  if (!Array.isArray(rows)) return []
  const expanded =
    expandedIds instanceof Set ? expandedIds : new Set(expandedIds || [])

  return rows.filter((row) => {
    if (row._rowKind === 'group' || row._rowKind === 'main') return true

    if (row._rowKind === 'main-meta') {
      const groupId = row._groupId
      if (groupId) return expanded.has(groupId)
      const id = row._recordId ?? row._parentId
      return id != null && expanded.has(id)
    }

    if (row._groupId) {
      if (!expanded.has(row._groupId)) return false
      if (row._rowKind === 'item' || row._rowKind === 'payment') return true
      return false
    }

    const id = row._recordId ?? row._parentId
    if (id == null) return false
    return expanded.has(id)
  })
}

export function financeListRowClassName({ row }) {
  if (row?._rowKind === 'group') {
    return 'finance-list-row--group finance-list-row--expandable'
  }
  if (row?._rowKind === 'main-meta') {
    return row._groupId
      ? 'finance-list-row--main-meta finance-list-row--group-member'
      : 'finance-list-row--main-meta'
  }
  if (row?._rowKind === 'main') {
    const base = 'finance-list-row--main'
    return financeListRowHasDetails(row) ? `${base} finance-list-row--expandable` : base
  }
  if (row?._rowKind === 'item') {
    if (itemHasMergedDisplay(row)) return 'finance-list-row--item finance-list-row--merged'
    return 'finance-list-row--item'
  }
  if (row?._rowKind === 'payment') return 'finance-list-row--payment'
  return ''
}

/** el-table span-method：合并子行单价、金额单元格 */
export function financeListSpanMethod({ row, column }) {
  const prop = column?.property
  if (!FINANCE_MERGE_PRICE_COLUMN_PROPS.includes(prop)) {
    return { rowspan: 1, colspan: 1 }
  }
  if (row?._rowKind !== 'item' || !row._mergeSpan) {
    return { rowspan: 1, colspan: 1 }
  }
  return row._mergeSpan
}

/** 列表页底部合计：按当前页主表记录汇总 */
export function computeFinanceListPageTotals(records, options = {}) {
  const financeType = options.financeType ?? 'payable'
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  const unpaidProp = financeType === 'receivable' ? 'unreceived_amount' : 'unpaid_amount'
  let contractTotal = 0
  let discountTotal = 0
  let paidTotal = 0
  let unpaidTotal = 0
  for (const record of records || []) {
    contractTotal += parseFinanceMoney(record?.contract_account)
    discountTotal += parseFinanceMoney(record?.discount_amount)
    const paid = getRecordDisplayPaidAmount(record, options)
    paidTotal += paid
    unpaidTotal += computeFinanceRecordUnpaidAmount(record, options)
  }
  const round2 = (n) => Math.round(n * 100) / 100
  return {
    contract_account: round2(contractTotal),
    discount_amount: round2(discountTotal),
    [paidAmountProp]: round2(paidTotal),
    [unpaidProp]: round2(unpaidTotal),
    unpaidProp,
    paidAmountProp,
  }
}

/** el-table summary-method：合同/实付(收)/未付(收)总金额 */
export function createFinanceListSummaryMethod(getRecords, options = {}) {
  const financeType = options.financeType ?? 'payable'
  const paidAmountProp = options.paidAmountProp ?? 'paid_amount'
  const unpaidProp = financeType === 'receivable' ? 'unreceived_amount' : 'unpaid_amount'
  const unpaidLabel = financeType === 'receivable' ? '未收' : '未付'

  return ({ columns }) => {
    const records = typeof getRecords === 'function' ? getRecords() : (getRecords ?? [])
    const totals = computeFinanceListPageTotals(records, options)
    return columns.map((column, index) => {
      const prop = column.property
      if (index === 0) return '合计'
      if (prop === 'contract_account') {
        return formatFinanceListMoney(totals.contract_account)
      }
      if (prop === 'discount_amount') {
        return formatFinanceListMoney(totals.discount_amount)
      }
      if (prop === paidAmountProp) {
        return formatFinanceListMoney(totals[paidAmountProp])
      }
      if (prop === 'amount') {
        return `${unpaidLabel} ${formatFinanceListMoney(totals[unpaidProp])}`
      }
      return ''
    })
  }
}

