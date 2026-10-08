import { computed, watch } from 'vue'
import {
  resolveContractAmount,
  syncCreatePaymentFromContractAndRecords,
  computeFinanceBalanceAmount,
  formatCreatePaymentMoney,
} from '@/utils/financeCreatePaymentStatus'

/**
 * 新建表单：合同金额 ↔ 付款/收款明细 ↔ 实付/实收、状态 联动。
 * @param {object} options
 * @param {import('vue').Reactive} options.createForm
 * @param {'payable'|'receivable'} options.financeType
 * @param {import('vue').Ref} options.paymentRecords
 * @param {import('vue').Ref} options.paymentRecordsTotal
 * @param {string} [options.contractField='contract_account']
 * @param {string} [options.paidField] paid_amount | received_amount
 * @param {string} [options.statusField='status']
 */
export function useFinanceCreatePaymentSync({
  createForm,
  financeType,
  paymentRecords,
  paymentRecordsTotal,
  contractField = 'contract_account',
  discountField = 'discount_amount',
  paidField = financeType === 'payable' ? 'paid_amount' : 'received_amount',
  statusField = 'status',
}) {
  const contractAmount = computed(() =>
    resolveContractAmount(createForm[contractField]),
  )

  const discountAmount = computed(() =>
    resolveContractAmount(createForm[discountField]),
  )

  const paymentRecordsAddEnabled = computed(() => contractAmount.value > 0)

  const paymentRecordsAddHint = computed(() => {
    if (paymentRecordsAddEnabled.value) return ''
    return financeType === 'payable'
      ? '请先填写大于 0 的合同金额后，方可添加付款明细'
      : '请先填写大于 0 的合同金额后，方可添加收款明细'
  })

  function applyPaymentSync() {
    const synced = syncCreatePaymentFromContractAndRecords({
      contractAmount: contractAmount.value,
      discountAmount: discountAmount.value,
      paymentTotal: paymentRecordsTotal.value,
      financeType,
    })
    createForm[paidField] = synced.paidAmount
    createForm[statusField] = synced.status
  }

  watch(
    () => createForm[contractField],
    () => {
      if (!paymentRecordsAddEnabled.value && paymentRecords.value.length) {
        paymentRecords.value = []
      }
      applyPaymentSync()
    },
  )

  watch(() => createForm[discountField], applyPaymentSync)

  watch(paymentRecordsTotal, applyPaymentSync)

  function initPaymentFieldsOnReset() {
    createForm[paidField] = 0
    const pending = financeType === 'payable' ? '待付款' : '待收款'
    createForm[statusField] = pending
  }

  const paidAmountDisplay = computed(() =>
    formatCreatePaymentMoney(createForm[paidField]),
  )

  const balanceAmount = computed(() =>
    computeFinanceBalanceAmount(
      contractAmount.value,
      createForm[paidField],
      discountAmount.value,
    ),
  )

  const balanceDisplay = computed(() => formatCreatePaymentMoney(balanceAmount.value))

  return {
    contractAmount,
    paymentRecordsAddEnabled,
    paymentRecordsAddHint,
    applyPaymentSync,
    initPaymentFieldsOnReset,
    paidAmountDisplay,
    balanceAmount,
    balanceDisplay,
  }
}
