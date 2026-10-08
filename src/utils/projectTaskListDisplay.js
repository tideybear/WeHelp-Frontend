import { formatDateOnly } from '@/utils/formatDate'
import {
  normalizeTaskTriStatus,
  computeParentProgressFromTaskRows,
  resolveTaskProgressPercentFromSource,
} from '@/views/Project/projectTask/projectTaskDefault/composables/taskBottomRightHelpers'

const STATUS_SORT_ORDER = {
  进行中: 0,
  未开始: 1,
  已完成: 2,
}

function parseTaskId(row) {
  const n = Number(row?.id)
  return Number.isFinite(n) ? n : null
}

function parseParentTaskId(row) {
  const raw = row?.parent_task_id
  if (raw == null || raw === '' || Number(raw) === 0) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parsePlannedEndMs(row) {
  const s = formatDateOnly(row?.planned_end_date)
  if (!s) return null
  const t = Date.parse(`${s}T00:00:00`)
  return Number.isFinite(t) ? t : null
}

function compareTaskRows(a, b) {
  const sa = STATUS_SORT_ORDER[normalizeTaskTriStatus(a?.task_status)] ?? 9
  const sb = STATUS_SORT_ORDER[normalizeTaskTriStatus(b?.task_status)] ?? 9
  if (sa !== sb) return sa - sb

  const da = parsePlannedEndMs(a)
  const db = parsePlannedEndMs(b)
  if (da !== db) {
    if (da == null) return 1
    if (db == null) return -1
    return da - db
  }

  const sortA = Number(a?.sort_order)
  const sortB = Number(b?.sort_order)
  if (Number.isFinite(sortA) && Number.isFinite(sortB) && sortA !== sortB) {
    return sortA - sortB
  }
  return (parseTaskId(a) ?? 0) - (parseTaskId(b) ?? 0)
}

/** @param {'assignee' | 'dueDate' | 'status' | null | undefined} field @param {'asc' | 'desc' | null | undefined} order */
function compareTaskRowsForUserSort(a, b, field, order) {
  if (!field || !order) return compareTaskRows(a, b)

  const dir = order === 'desc' ? -1 : 1
  let cmp = 0

  if (field === 'assignee') {
    const aa = String(a?.assignee_name ?? '').trim() || '—'
    const ab = String(b?.assignee_name ?? '').trim() || '—'
    cmp = aa.localeCompare(ab, 'zh-CN')
  } else if (field === 'dueDate') {
    const da = parsePlannedEndMs(a)
    const db = parsePlannedEndMs(b)
    if (da == null && db == null) cmp = 0
    else if (da == null) cmp = 1
    else if (db == null) cmp = -1
    else cmp = da - db
  } else if (field === 'status') {
    const sa = STATUS_SORT_ORDER[normalizeTaskTriStatus(a?.task_status)] ?? 9
    const sb = STATUS_SORT_ORDER[normalizeTaskTriStatus(b?.task_status)] ?? 9
    cmp = sa - sb
  }

  if (cmp !== 0) return cmp * dir
  return compareTaskRows(a, b)
}

function isRowActive(row) {
  const del = row?.is_deleted ?? row?.is_delete
  if (del === 1 || del === true || del === '1') return false
  return true
}

function toDisplayRow(row, { isChild, hasChildren, allRows }) {
  const status = normalizeTaskTriStatus(row?.task_status)
  const id = parseTaskId(row)
  const progress = hasChildren && id != null
    ? computeParentProgressFromTaskRows(id, allRows)
    : resolveTaskProgressPercentFromSource(row)

  return {
    id: parseTaskId(row),
    title: String(row?.task_name ?? '').trim() || '未命名任务',
    assignee: String(row?.assignee_name ?? '').trim() || '—',
    dueDate: formatDateOnly(row?.planned_end_date) || '—',
    status,
    progress,
    isChild: Boolean(isChild),
    hasChildren: Boolean(hasChildren),
  }
}

/**
 * 将 v_project_tasks 行按父任务分组、组内排序后展平为详情页表格行。
 * 默认排序：进行中 → 未开始 → 已完成，同状态按计划结束时间升序。
 * @param {Array} rows
 * @param {{ field?: 'assignee' | 'dueDate' | 'status' | null, order?: 'asc' | 'desc' | null }} [sortOptions]
 */
export function buildProjectDetailTaskDisplayList(rows, sortOptions = null) {
  const list = (Array.isArray(rows) ? rows : []).filter(isRowActive)
  const field = sortOptions?.field ?? null
  const order = sortOptions?.order ?? null
  const siblingCompare = (a, b) => compareTaskRowsForUserSort(a, b, field, order)
  const byId = new Map()
  const childrenByParent = new Map()

  for (const row of list) {
    const id = parseTaskId(row)
    if (id == null) continue
    byId.set(id, row)
    const pid = parseParentTaskId(row)
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid).push(row)
  }

  const roots = (childrenByParent.get(null) || []).filter((r) => {
    const pid = parseParentTaskId(r)
    return pid == null || !byId.has(pid)
  })

  const out = []
  let displayIndex = 0

  function appendSubtree(taskRow, depth) {
    const id = parseTaskId(taskRow)
    if (id == null) return

    const rawChildren = childrenByParent.get(id) || []
    const sortedChildren = [...rawChildren].sort(siblingCompare)
    const hasChildren = sortedChildren.length > 0

    displayIndex += 1
    out.push({
      ...toDisplayRow(taskRow, { isChild: depth > 0, hasChildren, allRows: list }),
      displayIndex,
    })

    for (const child of sortedChildren) {
      appendSubtree(child, depth + 1)
    }
  }

  const sortedRoots = [...roots].sort(siblingCompare)
  for (const root of sortedRoots) {
    appendSubtree(root, 0)
  }

  return out
}

export function projectDetailTaskRowClassName({ row }) {
  if (row?.hasChildren) return 'project-task-row--has-children'
  if (row?.isChild) return 'project-task-row--child'
  return ''
}
