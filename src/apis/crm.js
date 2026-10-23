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

/**客户兰联系人列表 */
export const getCrmCustomerContactListAPI = (params) => {
  return request({
    url: '/crm/contacts',
    method: 'GET',
    params,
  })
}


/** 新增客户联系人 */
export const createCrmCustomerContactAPI = (data) => {
  return request({
    url: '/crm/contacts/create',
    method: 'POST',
    data,
  })
}

/** 更新客户联系人 */
export const updateCrmCustomerContactAPI = (id, data) => {
  return request({
    url: `/crm/contacts/update/${id}`,
    method: 'PUT',
    data,
  })
}

/** 删除客户联系人 */
export const deleteCrmCustomerContactAPI = (id) => {
  return request({
    url: `/crm/contacts/delete/${id}`, 
    method: 'DELETE',
  })
}

/**客户跟进记录列表 */
export const getCrmCustomerFollowUpRecordAPI = (params) => {
  return request({
    url: '/crm/follow-up-records',
    method: 'GET',
    params,
  })
}

/** 新增客户跟进记录 */
export const createCrmFollowUpRecordAPI = (data) => {
  return request({
    url: '/crm/follow-up-records/create',
    method: 'POST',
    data,
  })
}

/** 更新客户跟进记录 */
export const updateCrmFollowUpRecordAPI = (id, data) => {
  return request({
    url: `/crm/follow-up-records/update/${id}`,
    method: 'PUT',
    data,
  })
}

/** 删除客户跟进记录 */
export const deleteCrmFollowUpRecordAPI = (id) => {
  return request({
    url: `/crm/follow-up-records/delete/${id}`,
    method: 'DELETE',
  })
}

/**客户需求记录列表 */
export const getCrmCustomerProductsAPI = (params) => {
  return request({
    url: '/crm/customer/products',
    method: 'GET',
    params,
  })
}

/** 新增客户需求记录 */
export const createCrmCustomerProductsAPI = (data) => {
  return request({
    url: '/crm/customer/products/create',
    method: 'POST',
    data,
  })
}

/** 更新客户需求记录 */
export const updateCrmCustomerProductsAPI = (id, data) => {
  return request({
    url: `/crm/customer/products/update/${id}`,
    method: 'PUT',
    data,
  })
}

/** 删除客户需求记录 */
export const deleteCrmCustomerProductsAPI = (id) => {
  return request({
    url: `/crm/customer/products/delete/${id}`,
    method: 'DELETE',
  })
}