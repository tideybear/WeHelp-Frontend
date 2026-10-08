import request from '@/utils/http'

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )

/** 客户列表（v_customers_info） */
export const getCustomersListAPI = (page = 1, page_size = 100, filters = {}) => {
  return request({
    url: '/sales/customers/list',
    method: 'GET',
    params: cleanParams({
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 客户详情 */
export const getCustomerDetailAPI = (id) => {
  return request({
    url: '/sales/customers/detail',
    method: 'GET',
    params: { id },
  })
}

/** 新增客户 */
export const createCustomerAPI = (data) => {
  return request({
    url: '/sales/customers/create',
    method: 'POST',
    data,
  })
}

/** 更新客户 */
export const updateCustomerAPI = (data) => {
  return request({
    url: '/sales/customers/update',
    method: 'POST',
    data,
  })
}

/** 删除客户 */
export const deleteCustomerAPI = (data) => {
  return request({
    url: '/sales/customers/delete',
    method: 'POST',
    data,
  })
}
