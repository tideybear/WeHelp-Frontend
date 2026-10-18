import request from '@/utils/http'

/** 客户列表 */
export const getCrmCustomerListAPI = (params) => {
  return request({
    url: '/crm/list',
    method: 'GET',
    params,
  })
}

/** 客户详情 */
export const getCrmCustomerDetailAPI = (id) => {
  return request({
    url: `/crm/detail/${id}`,
    method: 'GET',
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
export const updateCrmCustomerAPI = (id, data) => {
  return request({
    url: `/crm/update/${id}`,
    method: 'PUT',
    data,
  })
}

/** 删除客户 */
export const deleteCrmCustomerAPI = (id) => {
  return request({
    url: `/crm/delete/${id}`,
    method: 'DELETE',
  })
}
