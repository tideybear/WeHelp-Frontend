import { getBankStatementsListAPI } from '@/apis/fin'

/** 银行流水列表列配置（与 List 页、详情页 query.columns 保持一致） */
export const BANK_STATEMENT_LIST_COLUMNS = [
  { prop: 'flow_no', label: '流水号', width: 168, showOverflowTooltip: true },
  { prop: 'bank_name', label: '银行', width: 100, fixed: false, showOverflowTooltip: true },
  { prop: 'voucher_no', label: '凭证号', width: 150, fixed: false, showOverflowTooltip: false },
  { prop: 'voucher_type', label: '凭证种类', width: 100, fixed: false, showOverflowTooltip: true },
  { prop: 'our_account_no', label: '本方账号', width: 150, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_account_no', label: '对方账号', width: 150, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_bank_no', label: '对方行号', width: 120, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_bank_name', label: '对方行名', width: 140, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_name', label: '对方单位名称', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'group_sub_account', label: '集团子账户', width: 120, fixed: false, showOverflowTooltip: true },
  { prop: 'transaction_time', label: '交易时间', width: 300, fixed: false, showOverflowTooltip: true },
  { prop: 'direction', label: '借/贷方向', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'debit_amount', label: '借方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'credit_amount', label: '贷方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'balance', label: '余额(元)', width: 180, fixed: false, showOverflowTooltip: false },
  { prop: 'abstract_text', label: '摘要', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'purpose', label: '用途', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'personalized_info', label: '个性化信息', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'created_at', label: '记录创建时间', width: 200, fixed: false, showOverflowTooltip: true },
]

export async function fetchBankStatementRow(namespaceId, recordId) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const id = recordId != null && String(recordId).trim() !== '' ? String(recordId) : ''
  if (!ns || !id) return null

  const res = await getBankStatementsListAPI(ns, 1, 1, { id })
  if (res?.code !== 200) {
    const err = new Error(res?.msg || '获取记录失败')
    err.response = { data: res }
    throw err
  }
  const row = Array.isArray(res.data) ? res.data[0] : null
  return row ?? null
}

export async function fetchBankStatementByFlowNo(namespaceId, flowNo) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const flow = flowNo != null && String(flowNo).trim() !== '' ? String(flowNo).trim() : ''
  if (!ns || !flow) return null

  const res = await getBankStatementsListAPI(ns, 1, 1, { flow_no: flow })
  if (res?.code !== 200) {
    const err = new Error(res?.msg || '获取记录失败')
    err.response = { data: res }
    throw err
  }
  const row = Array.isArray(res.data) ? res.data[0] : null
  return row ?? null
}

export function buildBankStatementDetailQuery(row, columnsConfig, namespaceId) {
  const cols = Array.isArray(columnsConfig) ? columnsConfig : []
  const rowId = row?.id
  return {
    id: rowId != null && rowId !== '' ? String(rowId) : '',
    namespace_id: namespaceId != null && namespaceId !== '' ? String(namespaceId) : '',
    rowData: encodeURIComponent(JSON.stringify(row || {})),
    columns: encodeURIComponent(JSON.stringify(cols)),
  }
}

export async function pushBankStatementDetailRoute(
  router,
  namespaceId,
  row,
  columnsConfig = BANK_STATEMENT_LIST_COLUMNS,
) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const rowId = row?.id
  if (!ns || rowId == null || rowId === '') {
    throw new Error('缺少空间或记录 id')
  }

  const rowData = (await fetchBankStatementRow(ns, rowId)) ?? row
  await router.push({
    path: `/finance/bank/statements/detail/${encodeURIComponent(String(rowId))}`,
    query: buildBankStatementDetailQuery(rowData, columnsConfig, ns),
  })
  return rowData
}
