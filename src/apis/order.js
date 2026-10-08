import request from '@/utils/http'

/*
params: {
  orderState:0,
  page:1,
  pageSize:2
}
*/


export const getUserOrder = (params) => {
  return request({
    url: '/member/order',
    method: 'GET',
    params
  })
}


export const getOrderListAPI = (namespace_id, data_authorize_lv, page = 1, page_size = 100, data_sources = []) => {
  // 允许传数组或逗号分隔字符串
  const sourcesParam = Array.isArray(data_sources)
    ? data_sources.filter(Boolean).join(',')
    : data_sources

  return request({
    url: '/order/list',
    method: 'GET',
    params:{
      namespace_id: namespace_id,
      data_authorize_lv: data_authorize_lv,
      page,
      page_size,
      data_sources: sourcesParam
    }
  })
}


export const get_orderFilterAPI = (params) => {
  return request({
    url: '/order/filter',
    method: 'GET',
    params
  })
}
