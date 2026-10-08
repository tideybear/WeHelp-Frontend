import { computed, ref, watch } from 'vue'
import {
  getProjectDetailAPI,
  getProjectTasksAPI,
  getProjectUserAuthorize,
} from '@/apis/project'
import {
  extractProjectTaskListRows,
  isProjectTaskRowDeleted,
  mergeDetailProcessesWithTaskForests,
} from './useProjectTaskTree'
import { parseProjectProcessesField } from './parseProjectProcessesField'
import { reconcileParentTaskProgressToDatabase } from './syncProjectTaskProgress'

function mapProjectUserAuthorizeRows(rows) {
  if (!Array.isArray(rows)) return []
  const out = []
  const seen = new Set()
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const uid = r.user_id ?? r.userId ?? r.id
    if (uid == null || uid === '') continue
    const value = String(uid).trim()
    if (!value || seen.has(value)) continue
    if (Number(value) === 1) continue
    seen.add(value)
    const nameRaw = r.name ?? r.user_name ?? r.username ?? r.label ?? ''
    const label = String(nameRaw).trim() || value
    out.push({ label, value })
  }
  return out
}

function categoryNameFromDetailRow(row) {
  if (!row) return ''
  const v = row.categoryname ?? row.categoryName ?? row.category_name
  if (v == null || v === '') return ''
  return String(v).trim()
}

function categoryIdFromDetailRow(row) {
  if (!row) return null
  const v = row.category_id ?? row.categoryId
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 任务页：选中项目后的详情 / 任务列表 / 授权用户等数据与刷新。
 * @param {import('vue').Ref} selectedProjectIdRef
 */
export function useProjectTaskWorkspace(selectedProjectIdRef) {
  const projectUserAuthorizeOptions = ref([])
  const projectTaskList = ref([])
  const projectDetailCategoryName = ref('')
  const projectDetailCategoryId = ref(null)
  const projectPlannedStartDate = ref('')
  const projectPlannedEndDate = ref('')
  const projectDetailProcesses = ref([])

  async function reconcileTaskProgressWithDatabase(project_id) {
    if (!Number.isFinite(project_id)) return
    try {
      await reconcileParentTaskProgressToDatabase({
        projectId: project_id,
        getTaskRows: () => projectTaskList.value,
        taskListRef: projectTaskList,
        reloadBefore: false,
      })
    } catch {
      /* 对齐失败不阻断页面加载 */
    }
  }

  async function loadProjectDetailAndTasks() {
    projectDetailCategoryName.value = ''
    projectDetailCategoryId.value = null
    projectPlannedStartDate.value = ''
    projectPlannedEndDate.value = ''
    projectDetailProcesses.value = []
    projectTaskList.value = []
    projectUserAuthorizeOptions.value = []
    const raw = selectedProjectIdRef.value
    if (raw == null || raw === '') return
    const project_id = Number(raw)
    if (!Number.isFinite(project_id)) return
    try {
      const [detailRes, tasksRes, authRes] = await Promise.all([
        getProjectDetailAPI({ project_id }),
        getProjectTasksAPI({ project_id }),
        getProjectUserAuthorize({ project_id }).catch(() => ({ code: 500, data: [] })),
      ])
      if (authRes?.code === 200 && Array.isArray(authRes.data)) {
        projectUserAuthorizeOptions.value = mapProjectUserAuthorizeRows(authRes.data)
      } else {
        projectUserAuthorizeOptions.value = []
      }
      if (detailRes?.code === 200) {
        const rows = Array.isArray(detailRes.data) ? detailRes.data : []
        const row0 = rows[0]
        if (row0) {
          projectDetailCategoryName.value = categoryNameFromDetailRow(row0)
          projectDetailCategoryId.value = categoryIdFromDetailRow(row0)
          projectPlannedStartDate.value =
            row0.planned_start_date ?? row0.plannedStartDate ?? row0.plan_start_date ?? ''
          projectPlannedEndDate.value =
            row0.planned_end_date ?? row0.plannedEndDate ?? row0.plan_end_date ?? ''
          projectDetailProcesses.value = parseProjectProcessesField(row0?.processes ?? row0?.Processes)
        }
      }
      const taskRows = extractProjectTaskListRows(tasksRes)
      projectTaskList.value =
        taskRows != null ? taskRows.filter((r) => !isProjectTaskRowDeleted(r)) : []
      await reconcileTaskProgressWithDatabase(project_id)
    } catch {
      projectDetailCategoryName.value = ''
      projectDetailCategoryId.value = null
      projectPlannedStartDate.value = ''
      projectPlannedEndDate.value = ''
      projectDetailProcesses.value = []
      projectTaskList.value = []
      projectUserAuthorizeOptions.value = []
    }
  }

  /** 删除成功后立即从本地列表剔除（避免接口/视图缓存导致已删任务仍展示） */
  function removeTasksFromList(taskIds) {
    const idSet = new Set(
      (Array.isArray(taskIds) ? taskIds : [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n)),
    )
    if (!idSet.size) return
    projectTaskList.value = (projectTaskList.value || []).filter((r) => {
      const id = Number(r?.id ?? r?.task_id ?? r?.task_pk)
      return !idSet.has(id)
    })
  }

  async function reloadProjectTasksOnly() {
    const raw = selectedProjectIdRef.value
    if (raw == null || raw === '') return
    const project_id = Number(raw)
    if (!Number.isFinite(project_id)) return
    try {
      const tasksRes = await getProjectTasksAPI({ project_id })
      const taskRows = extractProjectTaskListRows(tasksRes)
      projectTaskList.value =
        taskRows != null ? taskRows.filter((r) => !isProjectTaskRowDeleted(r)) : []
      await reconcileTaskProgressWithDatabase(project_id)
    } catch {
      projectTaskList.value = []
    }
  }

  const mergedProcessTaskTree = computed(() =>
    mergeDetailProcessesWithTaskForests(projectDetailProcesses.value, projectTaskList.value),
  )

  watch(
    selectedProjectIdRef,
    () => {
      void loadProjectDetailAndTasks()
    },
    { immediate: true },
  )

  return {
    projectUserAuthorizeOptions,
    projectTaskList,
    projectDetailCategoryName,
    projectDetailCategoryId,
    projectPlannedStartDate,
    projectPlannedEndDate,
    projectDetailProcesses,
    mergedProcessTaskTree,
    loadProjectDetailAndTasks,
    reloadProjectTasksOnly,
    removeTasksFromList,
  }
}
