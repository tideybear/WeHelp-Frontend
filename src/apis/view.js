import request from '@/utils/http'

// 获取侧边菜单，按项目和用户过滤
export const get_viewList = (namespace_id) => {
  return request({
    url: '/view/list',
    method: 'GET',
    params: {
      namespace_id,
    },
  })
}
