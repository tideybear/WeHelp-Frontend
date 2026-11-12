// 封装所有和用户相关的接口函数
import request from '@/utils/http'

export const loginAPI = ({ account, password }) => {
  return request({
    url: '/login',
    method: 'POST',
    data: {
      account,
      password
    }
  })
}

export const getUserListAPI = ({ namespace_id }) => {
  return request({
    url: '/user/list',
    params: { namespace_id },
  })
}

/** 根据 id 获取用户详情 */
export const getUserDetailAPI = ({ id }) => {
  return request({
    url: '/user/detail',
    method: 'GET',
    params: { id },
  })
}