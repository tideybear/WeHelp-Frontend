import request from '@/utils/http'

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )

/** 客户列表 */
export const getCrmCustomerListAPI = (page = 1, page_size = 100, namespace_id, filters = {}) => {
  return request({
    url: '/crm/list',
    method: 'GET',
    params: cleanParams({
      page,
      page_size,
      namespace_id,
      ...filters,
    }),
  })
}

/** 客户详情 */
export const getCrmCustomerDetailAPI = (id) => {
  return request({
    url: '/crm/customers/detail',
    method: 'GET',
    params: { id },
  })
}

/** 新增客户 */
export const createCrmCustomerAPI = (data) => {
  return request({
    url: '/crm/customers/create',
    method: 'POST',
    data,
  })
}

/** 更新客户 */
export const updateCrmCustomerAPI = (data) => {
  return request({
    url: '/crm/customers/update',
    method: 'POST',
    data,
  })
}

/** 删除客户 */
export const deleteCrmCustomerAPI = (data) => {
  return request({
    url: '/crm/customers/delete',
    method: 'POST',
    data,
  })
}
