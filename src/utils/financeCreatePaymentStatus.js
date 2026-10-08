/** 新建应收/应付：合同金额与付款明细联动状态 */

export const PAYABLE_STATUS = {
  pending: '待付款',
  partial: '部分付款',
  cleared: '已付清',
}

export const RECEIVABLE_STATUS = {
  pending: '待收款',
  partial: '部分收款',
  cleared: '已收清',
}

export function resolveContractAmount(contractAccount) {
  if (contractAccount == null || contractAccount === '') return 0
  const n = Number(contractAccount)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function roundMoney(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** 净应付/应收基数 = 合同金额 − 优惠金额（不小于 0） */
export function resolveNetContractAmount(contractAccount, discountAmount = 0) {
  const contract = resolveContractAmount(contractAccount)
  const discount = resolveContractAmount(discountAmount)
  return Math.max(0, roundMoney(contract - discount))
}

/**
 * @param {'payable'|'receivable'} financeType
 */
export function computeFinancePaymentStatus(
  paidAmount,
  contractAmount,
  financeType,
  discountAmount = 0,
) {
  const paid = roundMoney(paidAmount)
  const net = resolveNetContractAmount(contractAmount, discountAmount)
  const labels =
    financeType === 'payable' ? PAYABLE_STATUS : RECEIVABLE_STATUS

  if (net <= 0 || paid <= 0) {
    return labels.pending
  }
  if (paid >= net) {
    return labels.cleared
  }
  return labels.partial
}

/**
 * 根据合同金额与付款明细合计，计算实付/实收与状态。
 */
export function syncCreatePaymentFromContractAndRecords({
  contractAmount,
  discountAmount = 0,
  paymentTotal,
  financeType,
}) {
  const contract = resolveContractAmount(contractAmount)
  const net = resolveNetContractAmount(contractAmount, discountAmount)
  const canAddRecords = contract > 0
  const paidAmount = canAddRecords ? roundMoney(paymentTotal) : 0
  const status = computeFinancePaymentStatus(
    paidAmount,
    contractAmount,
    financeType,
    discountAmount,
  )
  return { paidAmount, status, canAddRecords, contractAmount: contract, netContractAmount: net }
}

/** 未付/未收金额 = 合同金额 − 优惠金额 − 实付/实收（不小于 0） */
export function computeFinanceBalanceAmount(contractAmount, paidAmount, discountAmount = 0) {
  const net = resolveNetContractAmount(contractAmount, discountAmount)
  const paid = roundMoney(paidAmount)
  if (net <= 0) return 0
  return Math.max(0, roundMoney(net - paid))
}

export function formatCreatePaymentMoney(val) {
  const n = roundMoney(val)
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
