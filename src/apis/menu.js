import request from '@/utils/http'

// 获取侧边菜单，按项目和用户过滤
export const getMenuListAPI = (namespace_id, user_id) => {
  return request({
    url: '/menu/list',
    method: 'GET',
    params: {
      namespace_id,
      user_id,
    },
  })
}

