import { updateProjectTaskDetailFieldsAPI } from '@/apis/project'
import {
  collectParentProgressPatches,
  collectStoredParentProgressMismatches,
  computeParentProgressFromTaskRows,
  mergeTaskRowOverrides,
  resolveTaskProgressPercentFromSource,
} from './taskBottomRightHelpers'

function taskRowId(row) {
  return Number(row?.id ?? row?.task_id)
}

export { mergeTaskRowOverrides }

function rowHasDirectChildren(taskId, taskRows) {
  const pid = Number(taskId)
  if (!Number.isFinite(pid)) return false
  return (Array.isArray(taskRows) ? taskRows : []).some((r) => {
    const p = Number(r?.parent_task_id ?? r?.parentTaskId)
    return Number.isFinite(p) && p === pid
  })
}

/** 变更任务自身 + 祖先父任务的 current_task_progress 补丁（去重） */
export function collectTaskProgressPatches(projectId, taskRows, changedTaskId, options = {}) {
  const { parentsOnly = false, rowOverrides = null } = options
  const tid = Number(changedTaskId)
  const project_id = Number(projectId)
  if (!Number.isFinite(tid) || !Number.isFinite(project_id)) return []

  const rows = mergeTaskRowOverrides(taskRows, rowOverrides)
  const patchByTaskId = new Map()

  if (!parentsOnly) {
    const byId = new Map()
    for (const r of rows) {
      const id = taskRowId(r)
      if (Number.isFinite(id)) byId.set(id, r)
    }
    const row = byId.get(tid)
    if (row) {
      const progress = rowHasDirectChildren(tid, rows)
        ? computeParentProgressFromTaskRows(tid, rows)
        : resolveTaskProgressPercentFromSource(row)
      patchByTaskId.set(tid, {
        project_id,
        task_id: tid,
        current_task_progress: progress,
      })
      row.current_task_progress = progress
    }
  }

  for (const patch of collectParentProgressPatches(project_id, rows, tid)) {
    patchByTaskId.set(patch.task_id, patch)
  }
  return [...patchByTaskId.values()]
}

/** 多个变更任务合并后的进度补丁（去重） */
export function collectTaskProgressPatchesForMany(projectId, taskRows, changedTaskIds, options = {}) {
  const ids = [...new Set((Array.isArray(changedTaskIds) ? changedTaskIds : []).map(Number))]
    .filter((id) => Number.isFinite(id) && id > 0)
  const map = new Map()
  for (const id of ids) {
    for (const patch of collectTaskProgressPatches(projectId, taskRows, id, {
      ...options,
      rowOverrides: options.rowOverrides ?? null,
    })) {
      map.set(patch.task_id, patch)
    }
  }
  return [...map.values()]
}

/** 将补丁写回扁平任务列表（就地更新，避免替换数组触发整树重建） */
export function applyTaskProgressPatchesToTaskList(taskListRef, patches) {
  if (!taskListRef || !Array.isArray(patches) || !patches.length) return
  const list = taskListRef.value
  if (!Array.isArray(list)) return
  const byId = new Map(
    patches.map((p) => [Number(p.task_id), p.current_task_progress]),
  )
  for (const row of list) {
    const id = taskRowId(row)
    if (byId.has(id)) row.current_task_progress = byId.get(id)
  }
}

async function writeTaskProgressPatches(patches) {
  if (!patches.length) return []
  const results = await Promise.all(
    patches.map((patch) => updateProjectTaskDetailFieldsAPI(patch)),
  )
  const failures = []
  for (let i = 0; i < results.length; i += 1) {
    const res = results[i]
    if (res?.code !== 200) {
      failures.push({ patch: patches[i], msg: res?.msg })
      console.warn('同步任务进度失败:', res?.msg, patches[i])
    }
  }
  return failures
}

/**
 * 汇总进度并写入库。
 * @param {object} opts
 * @param {boolean} [opts.reloadBefore=true] 写库前是否拉取任务列表
 * @param {boolean} [opts.reloadAfter=false] 写库后是否再拉取（默认用本地列表补丁即可）
 * @param {boolean} [opts.parentsOnly=false] 仅同步父链（当前任务已在 save 中写入时设为 true）
 * @param {object[]} [opts.rowOverrides] 刚写入库的任务行快照，用于父任务汇总时覆盖 reload 的滞后数据
 */
export async function syncProjectTaskProgressRollup({
  projectId,
  changedTaskId,
  reloadProjectTasksOnly,
  getTaskRows,
  taskListRef,
  reloadBefore = true,
  reloadAfter = false,
  parentsOnly = false,
  rowOverrides = null,
}) {
  const project_id = Number(projectId)
  const tid = Number(changedTaskId)
  if (!Number.isFinite(project_id) || !Number.isFinite(tid)) return { patches: [], failures: [] }

  if (reloadBefore && typeof reloadProjectTasksOnly === 'function') {
    await reloadProjectTasksOnly()
  }
  const baseRows = typeof getTaskRows === 'function' ? getTaskRows() : []
  const patches = collectTaskProgressPatches(project_id, baseRows, tid, {
    parentsOnly,
    rowOverrides,
  })
  if (!patches.length) return { patches: [], failures: [] }

  const failures = await writeTaskProgressPatches(patches)
  if (taskListRef) applyTaskProgressPatchesToTaskList(taskListRef, patches)
  if (reloadAfter && typeof reloadProjectTasksOnly === 'function') {
    await reloadProjectTasksOnly()
  }
  return { patches, failures }
}

/** 批量变更：一次拉取、合并补丁、一次写库 */
export async function syncProjectTaskProgressRollupBatch({
  projectId,
  changedTaskIds,
  reloadProjectTasksOnly,
  getTaskRows,
  taskListRef,
  reloadBefore = true,
  reloadAfter = false,
  parentsOnly = false,
  rowOverrides = null,
}) {
  const project_id = Number(projectId)
  if (!Number.isFinite(project_id)) return { patches: [], failures: [] }

  if (reloadBefore && typeof reloadProjectTasksOnly === 'function') {
    await reloadProjectTasksOnly()
  }
  const baseRows = typeof getTaskRows === 'function' ? getTaskRows() : []
  const patches = collectTaskProgressPatchesForMany(project_id, baseRows, changedTaskIds, {
    parentsOnly,
    rowOverrides,
  })
  if (!patches.length) return { patches: [], failures: [] }

  const failures = await writeTaskProgressPatches(patches)
  if (taskListRef) applyTaskProgressPatchesToTaskList(taskListRef, patches)
  if (reloadAfter && typeof reloadProjectTasksOnly === 'function') {
    await reloadProjectTasksOnly()
  }
  return { patches, failures }
}

/**
 * 将库中父任务 current_task_progress 与当前子任务加权结果对齐（修复页面与库不一致）。
 */
export async function reconcileParentTaskProgressToDatabase({
  projectId,
  reloadProjectTasksOnly,
  getTaskRows,
  taskListRef,
  reloadBefore = false,
}) {
  const project_id = Number(projectId)
  if (!Number.isFinite(project_id)) return { patches: [], failures: [] }

  if (reloadBefore && typeof reloadProjectTasksOnly === 'function') {
    await reloadProjectTasksOnly()
  }
  const rows = typeof getTaskRows === 'function' ? getTaskRows() : []
  const patches = collectStoredParentProgressMismatches(project_id, rows)
  if (!patches.length) return { patches: [], failures: [] }

  const failures = await writeTaskProgressPatches(patches)
  if (taskListRef) applyTaskProgressPatchesToTaskList(taskListRef, patches)
  return { patches, failures }
}
