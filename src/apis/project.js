import request from '@/utils/http'

/**
 * 项目列表（与后端 `/project/list` 一致）
 * @param {{ namespace_id: number, user_id: number,project_id: number }} params — projectid 对接当前命名空间/空间 ID；userid 为当前用户 id
 */
export const getProjectListAPI = ({ namespace_id , user_id }) => {
    return request({
      url: '/project/list',
      params: {
        namespace_id,
        user_id
      }
    })
  }


/** 首页任务看板 GET `/project/tasks/dashboard?namespace_id=&user_id=` */
export const getProjectTasksDashboardAPI = ({ namespace_id, user_id }) => {
  return request({
    url: '/project/tasks/dashboard',
    params: { namespace_id, user_id },
  })
}

/** 项目任务树 GET `/project/tasks?project_id=` */
export const getProjectTasksAPI = ({ project_id }) => {
  return request({
    url: '/project/tasks',
    params: { project_id },
  })
}

/** 更新任务层级：parent_task_id、processes_id、sibling_sort_orders（平级拖放排序） */
export const updateProjectTaskHierarchyAPI = (data) => {
  return request({
    url: '/project/tasks/update',
    method: 'POST',
    data,
  })
}

/** 更新任务详情（名称、描述、实际起止、状态、优先级、负责人、协同人等，不含评论） POST `/project/tasks/update-detail` */
export const updateProjectTaskDetailFieldsAPI = (data) => {
  return request({
    url: '/project/tasks/update-detail',
    method: 'POST',
    data,
  })
}

/** 软删除任务 POST `/project/tasks/delete`（is_deleted / is_delete = 1，含子任务） */
export const deleteProjectTaskAPI = (data) => {
  return request({
    url: '/project/tasks/delete',
    method: 'POST',
    data,
  })
}

/** 新建项目任务 POST `/project/tasks/create` */
export const createProjectTaskAPI = (data) => {
  return request({
    url: '/project/tasks/create',
    method: 'POST',
    data,
  })
}

/** 项目详情 GET `/project/detail?project_id=` */
export const getProjectDetailAPI = ({ project_id }) => {
  return request({
    url: '/project/detail',
    params: {
      project_id,
    },
  })
}

/** @deprecated 拼写错误，请使用 getProjectDetailAPI */
export const getProjectDetaillAPI = getProjectDetailAPI


/**
 * 新建项目
 * @param {{ namespace_id: number, user_id: number, name: string, project_manager?: string, category_id?: number | null, authorize_user_ids?: number[] }} data
 */
export const createProjectAPI = (data) => {
  return request({
    url: '/project/create',
    method: 'POST',
    data,
  })
}

export const updateProjectStatusAPI = (data) => {
  return request({
    url: '/project/status',
    method: 'POST',
    data,
  })
}

export const updateProjectDatesAPI = (data) => {
  return request({
    url: '/project/dates',
    method: 'POST',
    data,
  })
}

/** 更新项目编号、名称、负责人、描述、category_id 等（按需传字段） */
export const updateProjectInfoAPI = (data) => {
  return request({
    url: '/project/info',
    method: 'POST',
    data,
  })
}

/** 项目类型列表（下拉）GET `/project/categories` */
export const getProjectCategoriesListAPI = () => {
  return request({
    url: '/project/categories',
  })
}

export const getProjectCategoryAPI = ({ category_id }) => {
  return request({
    url: '/project/category',
    params: { category_id },
  })
}

export const getProjectTaskAPI = ({ project_id }) => {
  return request({
    url: '/project/tasks',
    params: { project_id },
  })
}

/** 单条任务详情 GET `/project/tasks/detail?task_id=` */
export const getProjectTaskDetailAPI = ({ task_id }) => {
  return request({
    url: '/project/tasks/detail',
    params: { task_id },
  })
}

/** 任务评论时间线 GET `/project/tasks/comments?task_id=`（按 created_at 升序） */
export const getProjectTaskCommentsAPI = ({ task_id }) => {
  return request({
    url: '/project/tasks/comments',
    params: { task_id },
  })
}

/** 发表评论 POST `/project/tasks/comments` */
export const createProjectTaskCommentAPI = (data) => {
  return request({
    url: '/project/tasks/comments',
    method: 'POST',
    data,
  })
}

/** 删除评论（软删）POST `/project/tasks/comments/delete` */
export const deleteProjectTaskCommentAPI = (data) => {
  return request({
    url: '/project/tasks/comments/delete',
    method: 'POST',
    data,
  })
}

export const getProjectUserAuthorize = ({ project_id }) => {
  return request({
    url: '/project/user/authorize',
    params: { project_id },
  })
}

/** 是否可管理项目 GET `/project/manage-permission` */
export const getProjectManagePermissionAPI = ({ project_id, operator_user_id }) => {
  return request({
    url: '/project/manage-permission',
    params: { project_id, operator_user_id },
  })
}

/**
 * 项目管理保存（基本信息 + 成员）
 * @param {{ project_id: number, operator_user_id: number, namespace_id?: number, project_code?: string, project_name?: string, project_manager?: string, category_id?: number | null, description?: string, authorize_user_ids?: number[] }} data
 */
export const saveProjectManageAPI = (data) => {
  return request({
    url: '/project/manage',
    method: 'POST',
    data,
  })
}