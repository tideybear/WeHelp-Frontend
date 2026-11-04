import request from '@/utils/http'

/** 报销列表 */
export const getFinReimbursementListAPI = (params) => {
  return request({
    url: '/fin/reimbursement-details/list',
    method: 'GET',
    params,
  })
}

/** 新增报销明细 */
export const createFinReimbursementAPI = (data) => {
  return request({
    url: '/fin/reimbursement-details/create',
    method: 'POST',
    data,
  })
}
