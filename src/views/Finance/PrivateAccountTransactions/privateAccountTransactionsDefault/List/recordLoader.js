import { getPrivateAccountTransactionsListAPI } from '@/apis/fin'

/** 私账列表列配置（与 List 页、详情页 query.columns 保持一致） */
export const PRIVATE_ACCOUNT_LIST_COLUMNS = [
  { prop: 'flow_no', label: '流水号', width: 168, showOverflowTooltip: true },
  { prop: 'business_date', label: '业务日期', width: 175, showOverflowTooltip: false },
  { prop: 'counterparty_name', label: '对方名称', width: 140, showOverflowTooltip: true },
  { prop: 'account_type', label: '账户类型', width: 96, showOverflowTooltip: false },
  { prop: 'account_name', label: '账户名称', width: 140, showOverflowTooltip: true },
  { prop: 'actual_object', label: '实际对象', width: 100, showOverflowTooltip: true },
  { prop: 'counterparty_type', label: '对方类型', width: 96, showOverflowTooltip: false },
  { prop: 'direction', label: '收支', width: 80, showOverflowTooltip: false },
  { prop: 'amount', label: '金额(元)', width: 110, showOverflowTooltip: false },
  { prop: 'balance', label: '余额(元)', width: 110, showOverflowTooltip: false },
  { prop: 'business_type', label: '业务类型', width: 110, showOverflowTooltip: false },
  { prop: 'business_desc', label: '业务事由', minWidth: 160, showOverflowTooltip: true },
  { prop: 'fund_status', label: '资金状态', width: 96, showOverflowTooltip: false },
  { prop: 'approval_status', label: '审批状态', width: 96, showOverflowTooltip: false },
  { prop: 'remark', label: '备注', width: 130, showOverflowTooltip: true },
  { prop: 'operator', label: '经办人', width: 96, showOverflowTooltip: true },
  { prop: 'approver', label: '审批人', width: 96, showOverflowTooltip: true },
  { prop: 'reconciliation_status', label: '对账状态', width: 96, showOverflowTooltip: false },
  { prop: 'created_at', label: '创建时间', width: 168, showOverflowTooltip: true },
]

/**
 * 按 id 从列表接口拉取单条私账往来（与 List 页列表同源）。
 * @returns {Promise<object|null>}
 */
export async function fetchPrivateAccountTransactionRow(namespaceId, recordId) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const id = recordId != null && String(recordId).trim() !== '' ? String(recordId) : ''
  if (!ns || !id) return null

  const res = await getPrivateAccountTransactionsListAPI(ns, 1, 1, { id })
  if (res?.code !== 200) {
    const err = new Error(res?.msg || '获取记录失败')
    err.response = { data: res }
    throw err
  }
  const row = Array.isArray(res.data) ? res.data[0] : null
  return row ?? null
}

export async function fetchPrivateAccountTransactionByFlowNo(namespaceId, flowNo) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const flow = flowNo != null && String(flowNo).trim() !== '' ? String(flowNo).trim() : ''
  if (!ns || !flow) return null

  const res = await getPrivateAccountTransactionsListAPI(ns, 1, 1, { flow_no: flow })
  if (res?.code !== 200) {
    const err = new Error(res?.msg || '获取记录失败')
    err.response = { data: res }
    throw err
  }
  const row = Array.isArray(res.data) ? res.data[0] : null
  return row ?? null
}

/**
 * 打开私账详情页（与 List.openRowDetail 传参方式一致）。
 */
export async function pushPrivateAccountDetailRoute(
  router,
  namespaceId,
  row,
  columnsConfig = PRIVATE_ACCOUNT_LIST_COLUMNS,
) {
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const rowId = row?.id
  if (!ns || rowId == null || rowId === '') {
    throw new Error('缺少空间或记录 id')
  }

  const rowData = (await fetchPrivateAccountTransactionRow(ns, rowId)) ?? row
  await router.push({
    name: 'PrivateAccountTransactionsDetail',
    params: { id: String(rowId) },
    query: buildPrivateAccountDetailQuery(rowData, columnsConfig, ns),
  })
  return rowData
}

/** 构建详情页路由 query（与 List.openRowDetail 一致） */
export function buildPrivateAccountDetailQuery(row, columnsConfig, namespaceId) {
  const cols = Array.isArray(columnsConfig) ? columnsConfig : []
  const rowId = row?.id
  return {
    id: rowId != null && rowId !== '' ? String(rowId) : '',
    namespace_id: namespaceId != null && namespaceId !== '' ? String(namespaceId) : '',
    rowData: encodeURIComponent(JSON.stringify(row || {})),
    columns: encodeURIComponent(JSON.stringify(cols)),
  }
}

/**
 * 按 id 拉取最新记录并 replace 到详情路由（与 List.openRowDetail 传参方式一致）。
 */
export async function refreshPrivateAccountDetailRoute(router, recordId, options = {}) {
  const { namespaceId, columns: columnsConfig = [] } = options
  const ns = namespaceId != null && String(namespaceId).trim() !== '' ? namespaceId : null
  const id = recordId != null && String(recordId).trim() !== '' ? String(recordId) : ''
  if (!ns || !id) {
    return { ok: false, msg: '缺少空间或记录 id' }
  }
  try {
    const row = await fetchPrivateAccountTransactionRow(ns, id)
    if (!row) {
      return { ok: false, msg: '未找到该记录' }
    }
    await router.replace({
      name: 'PrivateAccountTransactionsDetail',
      params: { id },
      query: buildPrivateAccountDetailQuery(row, columnsConfig, ns),
    })
    return { ok: true, row }
  } catch (e) {
    console.error('刷新私账详情失败:', e)
    return {
      ok: false,
      msg: e?.message || e?.response?.data?.msg || '刷新记录失败',
    }
  }
}
