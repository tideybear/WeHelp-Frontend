import request from '@/utils/http'

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )

/** 应收账款列表（v_finance_receivables） */
export const getFinanceReceivablesListAPI = (page = 1, page_size = 100, filters = {}) => {
  return request({
    url: '/finance/receivables/list',
    method: 'GET',
    params: cleanParams({
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 应收账款详情 */
export const getFinanceReceivableDetailAPI = (id) => {
  return request({
    url: '/finance/receivables/detail',
    method: 'GET',
    params: { id },
  })
}

/** 新增应收账款 */
export const createFinanceReceivableAPI = (data) => {
  return request({
    url: '/finance/receivables/create',
    method: 'POST',
    data,
  })
}

/** 更新应收账款 */
export const updateFinanceReceivableAPI = (data) => {
  return request({
    url: '/finance/receivables/update',
    method: 'POST',
    data,
  })
}

/** 删除应收账款（软删除） */
export const deleteFinanceReceivableAPI = (data) => {
  return request({
    url: '/finance/receivables/delete',
    method: 'POST',
    data,
  })
}
