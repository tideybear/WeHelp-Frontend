import request from '@/utils/http'

export const getNamespaceListAPI = ({ userid }) => {
    return request({
      url: '/namespace/list',
      params: {
        userid
      }
    })
 }
  
  