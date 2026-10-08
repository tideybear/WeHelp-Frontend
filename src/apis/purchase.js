import request from '@/utils/http'

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )

/** 供应商列表（v_suppliers_info） */
export const getSuppliersListAPI = (page = 1, page_size = 100, filters = {}) => {
  return request({
    url: '/purchase/suppliers/list',
    method: 'GET',
    params: cleanParams({
      page,
      page_size,
      ...filters,
    }),
  })
}

/** 供应商详情 */
export const getSupplierDetailAPI = (id) => {
  return request({
    url: '/purchase/suppliers/detail',
    method: 'GET',
    params: { id },
  })
}

/** 新增供应商 */
export const createSupplierAPI = (data) => {
  return request({
    url: '/purchase/suppliers/create',
    method: 'POST',
    data,
  })
}

/** 更新供应商 */
export const updateSupplierAPI = (data) => {
  return request({
    url: '/purchase/suppliers/update',
    method: 'POST',
    data,
  })
}

/** 删除供应商 */
export const deleteSupplierAPI = (data) => {
  return request({
    url: '/purchase/suppliers/delete',
    method: 'POST',
    data,
  })
}
