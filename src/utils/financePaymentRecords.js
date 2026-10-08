/** 财务应收/应付收付款明细行 */

export const PAYMENT_METHOD_OPTIONS = [
  { label: '银行转账', value: '银行转账' },
  { label: '现金', value: '现金' },
  { label: '支票', value: '支票' },
  { label: '承兑汇票', value: '承兑汇票' },
  { label: '其他', value: '其他' },
]

export const DEFAULT_PAYMENT_METHOD = '银行转账'

export function createEmptyPaymentRecord() {
  return {
    payment_no: '',
    amount: undefined,
    payment_date: '',
    payment_bank: '',
    payment_account: '',
    payment_method: DEFAULT_PAYMENT_METHOD,
    voucher_no: '',
    handler: '',
    remark: '',
  }
}

export function mapApiPaymentRecordsToEditorRows(records) {
  if (!Array.isArray(records) || records.length === 0) return []
  return records.map((row) => {
    const amount =
      row?.amount != null && row?.amount !== '' ? Number(row.amount) : undefined
    return {
      payment_no: String(row?.payment_no ?? ''),
      amount: Number.isFinite(amount) ? amount : undefined,
      payment_date: row?.payment_date ? String(row.payment_date).slice(0, 10) : '',
      payment_bank: String(row?.payment_bank ?? ''),
      payment_account: String(row?.payment_account ?? ''),
      payment_method: String(row?.payment_method ?? DEFAULT_PAYMENT_METHOD) || DEFAULT_PAYMENT_METHOD,
      voucher_no: String(row?.voucher_no ?? ''),
      handler: String(row?.handler ?? ''),
      remark: String(row?.remark ?? ''),
    }
  })
}

export function isBlankPaymentRecordRow(row) {
  if (!row || typeof row !== 'object') return true
  if (String(row.payment_date ?? '').trim()) return false
  if (String(row.payment_bank ?? '').trim()) return false
  if (String(row.payment_account ?? '').trim()) return false
  if (String(row.payment_no ?? '').trim()) return false
  if (String(row.voucher_no ?? '').trim()) return false
  if (String(row.handler ?? '').trim()) return false
  if (String(row.remark ?? '').trim()) return false
  const amt = row.amount
  return amt == null || amt === '' || Number(amt) <= 0
}

function activePaymentRows(records) {
  return (Array.isArray(records) ? records : []).filter((row) => !isBlankPaymentRecordRow(row))
}

export function normalizePaymentRecordForSubmit(row) {
  const amount =
    row.amount != null && row.amount !== '' ? Number(row.amount) : undefined
  const payment_date = String(row.payment_date ?? '').trim().slice(0, 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: '请填写有效的收付款金额' }
  }
  if (!payment_date) {
    return { error: '收付款日期不能为空' }
  }
  const method = String(row.payment_method ?? DEFAULT_PAYMENT_METHOD).trim() || DEFAULT_PAYMENT_METHOD
  return {
    amount,
    payment_date,
    payment_method: method,
    payment_no: String(row.payment_no ?? '').trim() || undefined,
    payment_bank: String(row.payment_bank ?? '').trim() || undefined,
    payment_account: String(row.payment_account ?? '').trim() || undefined,
    voucher_no: String(row.voucher_no ?? '').trim() || undefined,
    handler: String(row.handler ?? '').trim() || undefined,
    remark: String(row.remark ?? '').trim() || undefined,
  }
}

export function buildPaymentRecordsPayload(records) {
  const list = activePaymentRows(records)
  const out = []
  let total = 0
  for (let i = 0; i < list.length; i++) {
    const normalized = normalizePaymentRecordForSubmit(list[i])
    if (normalized.error) {
      return { error: `第 ${i + 1} 行：${normalized.error}` }
    }
    out.push(normalized)
    total += normalized.amount
  }
  return {
    payment_records: out,
    totalAmount: Math.round(total * 100) / 100,
  }
}

export function validatePaymentRecordsForSubmit(records) {
  const list = activePaymentRows(records)
  if (!list.length) {
    return { ok: true, payment_records: [], totalAmount: 0 }
  }
  const built = buildPaymentRecordsPayload(records)
  if (built.error) {
    return { ok: false, message: built.error }
  }
  return { ok: true, payment_records: built.payment_records, totalAmount: built.totalAmount }
}
