import request from '@/utils/http'

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )

/** 应付账款列表（v_finance_payables） */
export const getFinancePayablesListAPI = (page = 1, page_size = 100, filters = {}) => {
  return request({
    url: '/finance/payables/list',
    method: 'GET',
    params: cleanParams({
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 应付账款详情 */
export const getFinancePayableDetailAPI = (id) => {
  return request({
    url: '/finance/payables/detail',
    method: 'GET',
    params: { id },
  })
}

/** 新增应付账款 */
export const createFinancePayableAPI = (data) => {
  return request({
    url: '/finance/payables/create',
    method: 'POST',
    data,
  })
}

/** 更新应付账款 */
export const updateFinancePayableAPI = (data) => {
  return request({
    url: '/finance/payables/update',
    method: 'POST',
    data,
  })
}

/** 删除应付账款（软删除） */
export const deleteFinancePayableAPI = (data) => {
  return request({
    url: '/finance/payables/delete',
    method: 'POST',
    data,
  })
}
