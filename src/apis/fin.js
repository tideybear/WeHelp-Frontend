import request from '@/utils/http'

const buildParamsFromArgs = (...args) => {
  if (!args.length) return {}

  // 支持 getFinFilterAPI({ namespace_id: 1, page: 1 })
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    return args[0]
  }

  // 支持 getFinFilterAPI('namespace_id', 1, 'page', 1)
  if (args.length % 2 !== 0) {
    throw new Error('可变参数必须是偶数个，格式为 key, value 成对传入')
  }

  const params = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('参数 key 必须是非空字符串')
    }
    params[key] = value
  }
  return params
}

// 获取银行流水列表
export const getBankStatementsListAPI = (
  namespace_id,
  page = 1,
  page_size = 100,
  filters = {},
) => {
  return request({
    url: '/fin/bankstatements/list',
    method: 'GET',
    params: cleanParams({
      namespace_id,
      page,
      page_size,
      ...filters,
    }),
  })
}

const cleanParams = (params = {}) => {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
}

// 银行模块通用筛选
// 支持三种调用方式：
// 1) getFinFilterAPI({ namespace_id, page, page_size, direction })
// 2) getFinFilterAPI(namespace_id, { direction, counterparty_name }, page, page_size)
// 3) getFinFilterAPI('namespace_id', 1, 'direction', '借', 'page', 1)
export const getFinFilterAPI = (...args) => {
  let params = {}

  // 方式2：namespace_id + filters(+分页)
  if (typeof args[0] === 'string' || typeof args[0] === 'number') {
    const [namespaceId, filters = {}, page = 1, pageSize = 100] = args
    params = {
      namespace_id: namespaceId,
      page,
      page_size: pageSize,
      ...(typeof filters === 'object' && filters !== null ? filters : {})
    }
  } else {
    // 方式1/3：对象 or 可变 key/value
    params = buildParamsFromArgs(...args)
  }
  return request({
    url: '/fin/filter',
    method: 'GET',
    params: cleanParams(params)
  })
}

// 删除银行流水记录
// TODO: 根据后端实际接口调整 url、method 和参数字段
export const deleteBankStatementAPI = (payload) => {
  return request({
    url: '/fin/bankstatements/delete',
    method: 'POST',
    data: payload
  })
}

// 更新银行流水记录
// TODO: 根据后端实际接口调整 url、method 和参数字段
export const updateBankStatementAPI = (payload) => {
  return request({
    url: '/fin/bankstatements/update',
    method: 'POST',
    data: payload
  })
}

// 上传银行流水文件（FormData 勿手动设 Content-Type，否则缺少 boundary 会导致后端收不到文件）
export const uploadBankStatementAPI = (formData) => {
  return request({
    url: '/fin/bankstatements/upload',
    method: 'POST',
    data: formData,
  })
}

/**
 * 私账往来流水列表
 * @param {string|number} namespace_id
 * @param {number} page
 * @param {number} page_size
 * @param {object} [filters] id, counterparty_type, direction, business_type, fund_status, approval_status
 */
/** 私账往来枚举（业务类型等与后端一致） */
export const getPrivateAccountTransactionsEnumsAPI = () => {
  return request({
    url: '/fin/private_account_transactions/enums',
    method: 'GET',
  })
}

export const getPrivateAccountTransactionsListAPI = (
  namespace_id,
  page = 1,
  page_size = 100,
  filters = {},
) => {
  return request({
    url: '/fin/private_account_transactions/list',
    method: 'GET',
    params: cleanParams({
      namespace_id,
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 按空间全量重算私账 balance（改表精度或修复历史数据后使用） */
export const recalcPrivateAccountBalanceAPI = (namespace_id) => {
  return request({
    url: '/fin/private_account_transactions/recalc_balance',
    method: 'POST',
    data: { namespace_id },
  })
}

/** 私账金额合计：预计=筛选项内已通过；实际=筛选项内已通过且资金已收/已付/已核销（收入+、支出-） */
export const getPrivateAccountAmountSummaryAPI = (namespace_id, filters = {}) => {
  return request({
    url: '/fin/private_account_transactions/amount_summary',
    method: 'GET',
    params: cleanParams({
      namespace_id,
      ...filters,
    }),
  })
}

/** 私账往来新增：body 为 { namespace_id, data: { 字段... } } */
export const createPrivateAccountTransactionAPI = (payload) => {
  return request({
    url: '/fin/private_account_transactions/create',
    method: 'POST',
    data: payload,
  })
}

/** 私账往来软删除（is_deleted = 1） */
export const deletePrivateAccountTransactionAPI = (payload) => {
  return request({
    url: '/fin/private_account_transactions/delete',
    method: 'POST',
    data: payload,
  })
}

/** 私账往来更新：body 为 { namespace_id, id, data: { 字段: 值 } }，兼容旧版仅传顶层 direction */
export const updatePrivateAccountTransactionAPI = (payload) => {
  return request({
    url: '/fin/private_account_transactions/update',
    method: 'POST',
    data: payload,
  })
}

/** 报销明细列表（namespace_id 必填，与私账列表一致） */
export const getReimbursementDetailsListAPI = (
  namespace_id,
  page = 1,
  page_size = 100,
  filters = {},
) => {
  return request({
    url: '/fin/reimbursement_details/list',
    method: 'GET',
    params: cleanParams({
      namespace_id,
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 报销明细单条查询 */
export const getReimbursementDetailAPI = (id) => {
  return request({
    url: '/fin/reimbursement_details/get',
    method: 'GET',
    params: { id },
  })
}

/** 报销明细新增 */
export const createReimbursementDetailAPI = (payload) => {
  return request({
    url: '/fin/reimbursement_details/create',
    method: 'POST',
    data: payload,
  })
}

/** 报销明细更新 */
export const updateReimbursementDetailAPI = (payload) => {
  return request({
    url: '/fin/reimbursement_details/update',
    method: 'POST',
    data: payload,
  })
}

/** 报销明细关联私账流水（写入 related_flow_no） */
export const linkReimbursementDetailFlowAPI = (payload) => {
  return request({
    url: '/fin/reimbursement_details/link_flow',
    method: 'POST',
    data: payload,
  })
}

/** 报销明细解除私账流水关联（清空 related_flow_no） */
export const unlinkReimbursementDetailFlowAPI = (payload) => {
  return request({
    url: '/fin/reimbursement_details/unlink_flow',
    method: 'POST',
    data: payload,
  })
}

/** 报销明细软删除 */
export const deleteReimbursementDetailAPI = (payload) => {
  return request({
    url: '/fin/reimbursement_details/delete',
    method: 'POST',
    data: payload,
  })
}