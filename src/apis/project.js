import request from '@/utils/http'



export const getProjectListAPI = (params) => {
  return request({
    url: '/project/list',
    method: 'GET',
    params,
  })
}

/**
 * 新增项目（只需项目名称，其余字段由后端默认值补齐）
 *
 * @param {object} data
 * @param {number|string} data.user_id 用户 ID
 * @param {number|string} data.namespace_id 空间 ID
 * @param {string} data.project_name 项目名称
 */
export const createProjectAPI = (data) => {
  return request({
    url: '/project/create',
    method: 'POST',
    data,
  })
}
