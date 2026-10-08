import {
  computeParentProgressFromDirectChildren,
  taskNodeHasDirectChildTasks,
} from './taskBottomRightHelpers'

const DAY_MS = 86400000

/** 后序遍历：有子任务的任务节点用子任务加权进度覆盖库内可能过期的值 */
function rollupTaskNodeProgressPostOrder(nodes) {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length) {
      rollupTaskNodeProgressPostOrder(node.children)
    }
    if (node?.nodeType === 'task' && taskNodeHasDirectChildTasks(node)) {
      node.current_task_progress = computeParentProgressFromDirectChildren(node)
    }
  }
}

export function taskStatusTagType(status) {
  if (status === '进行中') return 'success'
  if (status === '未开始') return 'warning'
  if (status === '已完成') return 'info'
  return 'info'
}

function parseJsonArray(val) {
  if (val == null || val === '') return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val)
      return Array.isArray(j) ? j : []
    } catch {
      return []
    }
  }
  return []
}

function dbRowToTaskNode(row, tpl) {
  const idNum = Number(row.id ?? row.task_id ?? row.task_pk ?? row.ID)
  if (!Number.isFinite(idNum)) return null
  const phaseId = String(row.phase_id ?? row.phaseId ?? '')
  const title = row.task_name ?? row.task_title ?? row.name ?? '未命名任务'
  const startAt = row.start_at != null ? Number(row.start_at) : row.startAt != null ? Number(row.startAt) : Date.now()
  const endAt = row.end_at != null ? Number(row.end_at) : row.endAt != null ? Number(row.endAt) : startAt + 7 * DAY_MS
  return {
    id: `dbt-${idNum}`,
    dbTaskId: idNum,
    label: String(title),
    nodeType: 'task',
    phaseId,
    categoryName: tpl.categoryName,
    status: String(row.status ?? '待执行'),
    runnable: true,
    description: String(row.description ?? ''),
    assignee: row.assignee != null && String(row.assignee) !== '' ? String(row.assignee) : '',
    priority: String(row.priority ?? 'medium'),
    startAt,
    endAt,
    collaborators: parseJsonArray(row.collaborators),
    comments: parseJsonArray(row.comments),
    children: [],
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
  }
}

function buildChildrenForPhase(phaseRows, tpl) {
  const nodes = phaseRows.map((r) => dbRowToTaskNode(r, tpl)).filter(Boolean)
  const byId = new Map(nodes.map((n) => [n.dbTaskId, n]))
  const childIds = new Set()
  for (const r of phaseRows) {
    const pid = r.parent_task_id ?? r.parentTaskId
    if (pid == null || pid === '' || Number(pid) === 0) continue
    const idNum = Number(r.id ?? r.task_id ?? r.task_pk ?? r.ID)
    const n = byId.get(idNum)
    const pNode = byId.get(Number(pid))
    if (n && pNode) {
      if (!pNode.children) pNode.children = []
      pNode.children.push(n)
      childIds.add(idNum)
    }
  }
  const roots = nodes.filter((n) => !childIds.has(n.dbTaskId))
  const sortRecursive = (arr) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    for (const x of arr) {
      if (x.children?.length) sortRecursive(x.children)
    }
  }
  sortRecursive(roots)
  return roots
}

/**
 * 同一阶段（或任意一批行）内，按数据库 id 与 parent_task_id 组成嵌套 JSON 树。
 * 节点形状：{ id, parent_task_id, title, sort_order, children }
 */
export function flatProjectTaskRowsToJsonTreeByParentId(rows) {
  const list = Array.isArray(rows) ? rows : []
  const idNum = (r) => Number(r.id ?? r.task_id ?? r.task_pk ?? r.ID)
  const parentNum = (r) => {
    const p = r.parent_task_id ?? r.parentTaskId
    if (p == null || p === '' || Number(p) === 0) return null
    const n = Number(p)
    return Number.isFinite(n) ? n : null
  }
  const nodes = new Map()
  for (const r of list) {
    const id = idNum(r)
    if (!Number.isFinite(id)) continue
    const title = String(r.title ?? r.task_title ?? r.name ?? '')
    const sortOrder = Number(r.sort_order ?? r.sortOrder ?? 0)
    nodes.set(id, {
      id,
      parent_task_id: parentNum(r),
      title,
      sort_order: sortOrder,
      children: [],
    })
  }
  const roots = []
  for (const [, node] of nodes) {
    const p = node.parent_task_id
    if (p != null && nodes.has(p)) {
      nodes.get(p).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRecursive = (arr) => {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    for (const x of arr) {
      if (x.children?.length) sortRecursive(x.children)
    }
  }
  sortRecursive(roots)
  return roots
}

/** 与 merge 分组一致，供侧栏 JSON 等复用 */
export function normPhaseKey(row) {
  const raw = row.phase_id ?? row.phaseId ?? row.phase ?? ''
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return String(n)
  return s
}

/** 任务行是否已软删（与后端 is_deleted / is_delete 一致） */
export function isProjectTaskRowDeleted(row) {
  if (!row || typeof row !== 'object') return false
  const v = row.is_deleted ?? row.isDeleted ?? row.is_delete ?? row.isDelete
  if (v == null || v === '') return false
  return v === 1 || v === '1' || v === true
}

/**
 * axios 拦截器已返回 `response.data`，此处兼容：
 * - 直接为数组
 * - `{ code, data: [] }` / `{ data: [] }`
 * - `list` / `rows` / `tasks` 等常见字段
 */
export function extractProjectTaskListRows(res) {
  const pick = (arr) => (Array.isArray(arr) ? arr.filter((r) => !isProjectTaskRowDeleted(r)) : null)
  if (Array.isArray(res)) return pick(res)
  if (!res || typeof res !== 'object') return null
  const inner = res.data ?? res.list ?? res.rows ?? res.result ?? res.tasks
  return pick(inner)
}

/**
 * 与详情 processes、任务行上的流程实例对齐（用于把任务挂到对应流程节点下）。
 * 兼容：Processes_id、processes_id、project_processes_id 等。
 */
export function normProcessesLinkKey(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const v =
    obj.Processes_id ??
    obj.processes_id ??
    obj.process_id ??
    obj.project_processes_id ??
    obj.projectProcessesId
  if (v != null && v !== '') return String(v).trim()
  const fallback = obj.id ?? obj.step_id ?? obj.phase_id ?? obj.phaseId
  if (fallback == null || fallback === '') return ''
  return String(fallback).trim()
}

/** 在合并后的流程树数据中查找 `target` 的直接父节点（引用相等）；无则 null */
export function findParentDataInProcessTree(roots, target) {
  if (!target || !Array.isArray(roots)) return null
  for (const node of roots) {
    if (!node) continue
    const ch = node.children
    if (Array.isArray(ch)) {
      for (const c of ch) {
        if (c === target) return node
      }
      const deeper = findParentDataInProcessTree(ch, target)
      if (deeper != null) return deeper
    }
  }
  return null
}

function coerceDbProcessesId(key) {
  if (key == null || key === '') return null
  const s = String(key).trim()
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return n
  return s
}

/**
 * 根据当前树数据（拖放完成后与 tree 一致）计算任务的 `parent_task_id` 与流程实例 id（与库列 `processes_id` 对齐）。
 */
export function computeTaskReparentFromTreeData(treeRoots, taskData) {
  if (!taskData || taskData.nodeType !== 'task') return null
  const taskDbId = Number(taskData._taskDbId)
  if (!Number.isFinite(taskDbId)) return null
  const parentData = findParentDataInProcessTree(treeRoots, taskData)
  let parent_task_id = null
  if (parentData?.nodeType === 'task') {
    const pid = Number(parentData._taskDbId)
    if (Number.isFinite(pid)) parent_task_id = pid
  }
  let scopeKey = ''
  let cur = parentData
  while (cur) {
    if (cur.nodeType !== 'task') {
      const k = normProcessesLinkKey(cur)
      if (k) {
        scopeKey = k
        break
      }
    }
    cur = findParentDataInProcessTree(treeRoots, cur)
  }
  let processes_id = coerceDbProcessesId(scopeKey)
  if (processes_id == null) {
    processes_id = coerceDbProcessesId(
      taskData.processes_id ?? taskData.project_processes_id ?? taskData.projectProcessesId,
    )
  }
  return { taskId: taskDbId, parent_task_id, processes_id }
}

/**
 * 拖放完成后，收集与当前任务同父级下的任务兄弟节点顺序（用于写库 sort_order，从 1 递增）。
 */
export function collectSiblingTaskSortOrders(treeRoots, taskData) {
  if (!taskData || taskData.nodeType !== 'task') return []
  const parentData = findParentDataInProcessTree(treeRoots, taskData)
  let siblings = []
  if (parentData && Array.isArray(parentData.children)) {
    siblings = parentData.children.filter((c) => c?.nodeType === 'task')
  } else {
    const wantParent = taskData.parent_task_id ?? taskData.parentTaskId
    const wantNum =
      wantParent == null || wantParent === '' || Number(wantParent) === 0
        ? null
        : Number(wantParent)
    const found = []
    function walk(nodes) {
      if (!Array.isArray(nodes)) return
      for (const n of nodes) {
        if (n?.nodeType === 'task') {
          const p = n.parent_task_id ?? n.parentTaskId
          const pNum = p == null || p === '' || Number(p) === 0 ? null : Number(p)
          if (pNum === wantNum) found.push(n)
        }
        if (Array.isArray(n?.children) && n.children.length) walk(n.children)
      }
    }
    walk(treeRoots)
    siblings = found
  }
  return siblings
    .map((n, idx) => ({
      task_id: Number(n._taskDbId),
      sort_order: idx + 1,
    }))
    .filter((x) => Number.isFinite(x.task_id) && x.task_id > 0)
}

/** 树节点拖放完成后的保存载荷（层级 + 同级 sort_order） */
export function computeTaskDropPayload(treeRoots, draggingNode, dropNode, dropType) {
  if (!draggingNode?.data || dropType === 'none') return null
  const reparent = computeTaskReparentFromTreeData(treeRoots, draggingNode.data)
  if (!reparent) return null
  const sibling_sort_orders = collectSiblingTaskSortOrders(treeRoots, draggingNode.data)
  const dropNodeIsTask = dropNode?.data?.nodeType === 'task'
  const reorderAmongSiblings =
    (dropType === 'prev' || dropType === 'next') &&
    sibling_sort_orders.length > 1 &&
    dropNodeIsTask
  return {
    ...reparent,
    sibling_sort_orders,
    drop_type: dropType,
    reorder_among_siblings: reorderAmongSiblings,
  }
}

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 树上节点：对齐 DB 的流程实例 id，避免 `bt-` / `task-` 等前端树 id 误判为流程键 */
function processScopeKeyForTreeNode(node) {
  if (!node || typeof node !== 'object') return ''
  const direct =
    node.Processes_id ??
    node.processes_id ??
    node.project_processes_id ??
    node.projectProcessesId
  if (direct != null && String(direct).trim() !== '') return String(direct).trim()
  const fb = node.phase_id ?? node.phaseId ?? node.step_id ?? node.stepId
  if (fb != null && String(fb).trim() !== '') return String(fb).trim()
  const nk = normProcessesLinkKey(node)
  if (nk && !/^bt-/i.test(nk) && !/^task-/i.test(nk)) return nk
  return ''
}

function walkNearestProcessScopeFromNode(treeRoots, startNode) {
  let cur = startNode
  while (cur) {
    if (cur.nodeType !== 'task') {
      const k = processScopeKeyForTreeNode(cur)
      if (k) return k
    }
    cur = findParentDataInProcessTree(treeRoots, cur)
  }
  return ''
}

/**
 * 「添加任务」：根据选中的树节点解析 `parent_task_id`、`project_category_id`、`project_processes_id`（与库列 processes_id 对应，供创建接口使用）。
 * @param {unknown} fallbackProjectCategoryId 项目详情 category_id，节点上未带分类时使用
 */
export function resolveAddTaskContext(treeRoots, selectedData, fallbackProjectCategoryId) {
  if (!selectedData || typeof selectedData !== 'object') return null
  const fbCat = numOrNull(fallbackProjectCategoryId)

  if (selectedData.nodeType === 'task') {
    const tid = Number(selectedData._taskDbId)
    if (!Number.isFinite(tid)) return null
    const fromRow = coerceDbProcessesId(
      selectedData.processes_id ??
        selectedData.project_processes_id ??
        selectedData.projectProcessesId,
    )
    const fromTree =
      fromRow ??
      coerceDbProcessesId(processScopeKeyForTreeNode(selectedData)) ??
      coerceDbProcessesId(
        walkNearestProcessScopeFromNode(
          treeRoots,
          findParentDataInProcessTree(treeRoots, selectedData),
        ),
      )
    const pcid = numOrNull(
      selectedData.project_category_id ??
        selectedData.projectCategoryId ??
        selectedData.category_id ??
        fbCat,
    )
    return {
      parent_task_id: tid,
      project_category_id: pcid,
      project_processes_id: fromTree,
    }
  }

  if (selectedData.nodeType !== 'task') {
    const scopeRaw = walkNearestProcessScopeFromNode(treeRoots, selectedData)
    const pcid = numOrNull(
      selectedData.project_category_id ??
        selectedData.category_id ??
        selectedData.projectCategoryId ??
        fbCat,
    )
    return {
      parent_task_id: null,
      project_category_id: pcid,
      project_processes_id: coerceDbProcessesId(scopeRaw),
    }
  }

  return null
}

/**
 * 将 `/project/tasks` 行按 id + parent_task_id 组成森林（根为多条），节点带 `nodeType: 'task'`、`process_name` 供树展示。
 */
export function taskApiRowsToForestRoots(rows) {
  const list = Array.isArray(rows) ? rows.filter((r) => !isProjectTaskRowDeleted(r)) : []
  const idNum = (r) => Number(r.id ?? r.task_id ?? r.task_pk ?? r.ID)
  const parentNum = (r) => {
    const p = r.parent_task_id ?? r.parentTaskId
    if (p == null || p === '' || Number(p) === 0) return null
    const n = Number(p)
    return Number.isFinite(n) ? n : null
  }
  const nodes = new Map()
  for (const r of list) {
    const id = idNum(r)
    if (!Number.isFinite(id)) continue
    nodes.set(id, {
      ...r,
      id: `task-${id}`,
      _taskDbId: id,
      nodeType: 'task',
      process_name: String(r.task_name ?? r.task_title ?? r.title ?? r.name ?? '未命名任务'),
      children: [],
    })
  }
  const childIds = new Set()
  for (const r of list) {
    const id = idNum(r)
    if (!Number.isFinite(id)) continue
    const p = parentNum(r)
    if (p != null && nodes.has(p)) {
      const node = nodes.get(id)
      const parentNode = nodes.get(p)
      if (node && parentNode) {
        parentNode.children.push(node)
        childIds.add(id)
      }
    }
  }
  const roots = [...nodes.values()].filter((n) => !childIds.has(n._taskDbId))
  const sortRec = (arr) => {
    if (!Array.isArray(arr)) return
    arr.sort((a, b) => Number(a.sort_order ?? a.sortOrder ?? 0) - Number(b.sort_order ?? b.sortOrder ?? 0))
    for (const x of arr) {
      if (x.children?.length) sortRec(x.children)
    }
  }
  sortRec(roots)
  return roots
}

/**
 * 先按 parent_task_id 组任务树，再按 `normProcessesLinkKey` 与详情 `processes` 节点上的 Processes_id 等对齐挂到对应节点 `children`。
 * 无 processes 时退回仅任务森林。
 */
/** 从流程树中移除已软删任务节点（合并后兜底） */
export function stripDeletedTaskNodesFromTree(nodes) {
  if (!Array.isArray(nodes)) return []
  const out = []
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const isTask = n.nodeType === 'task' || n._taskDbId != null
    if (isTask && isProjectTaskRowDeleted(n)) continue
    const children = stripDeletedTaskNodesFromTree(n.children)
    out.push({ ...n, children })
  }
  return out
}

export function mergeDetailProcessesWithTaskForests(processRoots, taskRows) {
  const taskForestRoots = taskApiRowsToForestRoots(taskRows)
  const groups = new Map()
  for (const tr of taskForestRoots) {
    const k = normProcessesLinkKey(tr) || '__orphan__'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(tr)
  }

  let procs = []
  try {
    procs = JSON.parse(JSON.stringify(Array.isArray(processRoots) ? processRoots : []))
  } catch {
    procs = []
  }

  if (!procs.length) {
    return taskForestRoots
  }

  function dfs(node) {
    if (!node || node.nodeType === 'task') return
    if (Array.isArray(node.children)) {
      for (const c of [...node.children]) {
        if (c && c.nodeType !== 'task') dfs(c)
      }
    }
    const key = normProcessesLinkKey(node)
    if (key && groups.has(key)) {
      const extra = groups.get(key)
      groups.delete(key)
      if (!node.children) node.children = []
      node.children.push(...extra)
    }
  }

  for (const p of procs) {
    dfs(p)
  }

  const rest = []
  for (const [, arr] of groups) {
    rest.push(...arr)
  }
  if (rest.length && procs[0]) {
    if (!procs[0].children) procs[0].children = []
    procs[0].children.push(...rest)
  }

  return stripDeletedTaskNodesFromTree(procs)
}

/** GET `/project/category`：拦截器已解包，兼容 `{ code, data }` 或直接数组 */
export function extractProjectCategoryListRows(res) {
  if (Array.isArray(res)) return res
  if (!res || typeof res !== 'object') return []
  if (res.code != null && res.code !== 200) return []
  const inner = res.data
  return Array.isArray(inner) ? inner : []
}

function parsePlannedToMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : null
}

function normProcessKeyFromRow(row) {
  const v = row.project_processes_id ?? row.projectProcessesId
  if (v == null || v === '') return '__default__'
  return String(v).trim()
}

function normStepKeyFromRow(row) {
  const raw = row.step_id ?? row.stepId ?? row.phase_id ?? row.phaseId ?? row.phase ?? ''
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return String(n)
  return s
}

function normStepKeyFromCategoryStep(step) {
  const raw = step.step_id ?? step.stepId
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return String(n)
  return s
}

function dbApiTaskRowToTreeNode(row, ctx) {
  const idNum = Number(row.id ?? row.task_id ?? row.task_pk ?? row.ID)
  if (!Number.isFinite(idNum)) return null
  const phaseId = normStepKeyFromRow(row)
  const title = row.task_name ?? row.task_title ?? row.title ?? row.name ?? '未命名任务'
  const status = String(row.task_status ?? row.status ?? '待执行')
  const startAt = parsePlannedToMs(row.planned_start_date) ?? Date.now()
  const endAt = parsePlannedToMs(row.planned_end_date) ?? startAt + 7 * DAY_MS
  const assignee =
    row.assignee_name != null && String(row.assignee_name) !== ''
      ? String(row.assignee_name)
      : row.assignee_id != null && String(row.assignee_id) !== ''
        ? String(row.assignee_id)
        : row.assignee != null && String(row.assignee) !== ''
          ? String(row.assignee)
          : 'zhang'
  return {
    id: `dbt-${idNum}`,
    dbTaskId: idNum,
    label: String(title),
    nodeType: 'task',
    phaseId,
    projectProcessesId: normProcessKeyFromRow(row) === '__default__' ? null : normProcessKeyFromRow(row),
    categoryName: ctx.categoryName,
    status,
    runnable: true,
    description: String(row.task_description ?? row.description ?? ''),
    current_task_progress:
      row.current_task_progress == null || row.current_task_progress === ''
        ? null
        : Number(row.current_task_progress),
    assignee,
    priority: String(row.priority ?? 'medium'),
    startAt,
    endAt,
    collaborators: parseJsonArray(row.collaborators ?? row.participant_ids),
    comments: parseJsonArray(row.comments),
    children: [],
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
  }
}

function buildChildrenForApiTaskRows(phaseRows, ctx) {
  const nodes = phaseRows.map((r) => dbApiTaskRowToTreeNode(r, ctx)).filter(Boolean)
  const byId = new Map(nodes.map((n) => [n.dbTaskId, n]))
  const childIds = new Set()
  for (const r of phaseRows) {
    const pid = r.parent_task_id ?? r.parentTaskId
    if (pid == null || pid === '' || Number(pid) === 0) continue
    const idNum = Number(r.id ?? r.task_id ?? r.task_pk ?? r.ID)
    const n = byId.get(idNum)
    const pNode = byId.get(Number(pid))
    if (n && pNode) {
      if (!pNode.children) pNode.children = []
      pNode.children.push(n)
      childIds.add(idNum)
    }
  }
  const roots = nodes.filter((n) => !childIds.has(n.dbTaskId))
  const sortRecursive = (arr) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    for (const x of arr) {
      if (x.children?.length) sortRecursive(x.children)
    }
  }
  sortRecursive(roots)
  rollupTaskNodeProgressPostOrder(roots)
  return roots
}

function distinctProcessKeys(taskRows) {
  const set = new Set()
  for (const r of taskRows) {
    set.add(normProcessKeyFromRow(r))
  }
  return [...set].sort((a, b) => {
    if (a === '__default__') return -1
    if (b === '__default__') return 1
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a && String(nb) === b) return na - nb
    return String(a).localeCompare(String(b))
  })
}

function fallbackStepNodesFromRows(taskRows, ctx, procKey) {
  const list = taskRows.filter((r) => normProcessKeyFromRow(r) === procKey)
  const stepSet = new Set()
  for (const r of list) {
    const sk = normStepKeyFromRow(r)
    stepSet.add(sk || '__noid__')
  }
  const keys = [...stepSet].filter((k) => k !== '')
  const noId = stepSet.has('__noid__')
  keys.sort((a, b) => {
    const minOrd = (sk) => {
      const rs = list.filter((r) => (normStepKeyFromRow(r) || '__noid__') === sk)
      const m = Math.min(...rs.map((x) => Number(x.sort_order ?? x.sortOrder ?? 0)))
      return Number.isFinite(m) ? m : 0
    }
    return minOrd(a) - minOrd(b) || String(a).localeCompare(String(b))
  })
  const ordered = [...keys]
  if (noId) ordered.push('__noid__')
  return ordered.map((sk) => {
    const phaseRows = list.filter((r) => (normStepKeyFromRow(r) || '__noid__') === sk)
    const label = sk === '__noid__' ? '未分步' : `步骤 ${sk}`
    return {
      id: `bt-cat-${ctx.categoryId}-p-${procKey}-fb-${encodeURIComponent(sk)}`,
      label,
      nodeType: 'phase',
      phaseId: sk === '__noid__' ? '' : sk,
      categoryName: ctx.categoryName,
      children: buildChildrenForApiTaskRows(phaseRows, ctx),
    }
  })
}

/**
 * 按大类步骤（GET /project/category）与任务行的 project_processes_id、step_id（无则回退 phase_id）组树。
 * - 单一 project_processes_id：顶层为各 step（phase 节点），其下为 parent_task_id 子树。
 * - 多个 project_processes_id：顶层为「流程」节点，其下为各 step，再下为任务子树。
 */
export function mergeDbTasksByCategoryProcessStep({
  categoryName = '',
  categoryId = null,
  categorySteps = [],
  taskRows = [],
}) {
  const list = Array.isArray(taskRows) ? taskRows : []
  const steps = Array.isArray(categorySteps)
    ? [...categorySteps].sort(
        (a, b) => Number(a.step_order ?? a.stepOrder ?? 0) - Number(b.step_order ?? b.stepOrder ?? 0),
      )
    : []
  const ctx = {
    categoryName: String(categoryName ?? ''),
    categoryId: categoryId == null || categoryId === '' ? '' : String(categoryId),
  }
  const procKeys = distinctProcessKeys(list)
  const multiProc = procKeys.length > 1

  const stepIdSetFromTemplate = new Set(steps.map((s) => normStepKeyFromCategoryStep(s)).filter(Boolean))

  const buildPhasesForProcess = (procKey) => {
    if (steps.length) {
      const nodes = steps.map((step) => {
        const sid = normStepKeyFromCategoryStep(step)
        const stepName = String(step.step_name ?? step.stepName ?? '未命名步骤')
        const phaseRows = list.filter(
          (r) => normProcessKeyFromRow(r) === procKey && normStepKeyFromRow(r) === sid,
        )
        const idSuffix = multiProc ? `p-${procKey}-s-${sid || 'x'}` : `s-${sid || 'x'}`
        return {
          id: `bt-cat-${ctx.categoryId}-${idSuffix}`,
          label: stepName,
          nodeType: 'phase',
          phaseId: step.step_id ?? step.stepId ?? sid,
          categoryName: ctx.categoryName,
          children: buildChildrenForApiTaskRows(phaseRows, ctx),
        }
      })
      const orphanRows = list.filter((r) => {
        if (normProcessKeyFromRow(r) !== procKey) return false
        const sk = normStepKeyFromRow(r)
        return !sk || !stepIdSetFromTemplate.has(sk)
      })
      if (orphanRows.length) {
        nodes.push({
          id: `bt-cat-${ctx.categoryId}-p-${procKey}-orphan`,
          label: '未匹配步骤',
          nodeType: 'phase',
          phaseId: '__orphan__',
          categoryName: ctx.categoryName,
          children: buildChildrenForApiTaskRows(orphanRows, ctx),
        })
      }
      return nodes
    }
    return fallbackStepNodesFromRows(list, ctx, procKey)
  }

  if (!multiProc) {
    const pk = procKeys[0] ?? '__default__'
    return buildPhasesForProcess(pk)
  }

  return procKeys.map((procKey) => ({
    id: `bt-cat-${ctx.categoryId}-proc-${encodeURIComponent(procKey)}`,
    label: procKey === '__default__' ? '默认流程' : `流程 #${procKey}`,
    nodeType: 'process',
    projectProcessesId: procKey === '__default__' ? null : procKey,
    categoryName: ctx.categoryName,
    children: buildPhasesForProcess(procKey),
  }))
}

/** 将底部树节点压成 Element Plus 文档式 `{ id, label, children }[]`（递归） */
export function treeNodesToLabelChildrenData(nodes) {
  if (!Array.isArray(nodes)) return []
  return nodes.map((n) => ({
    id: n.id,
    label: n.label,
    children: treeNodesToLabelChildrenData(n.children ?? []),
  }))
}

/**
 * 同一批任务行内，按 `id` / `parent_task_id` 组成 Element Plus 文档式树：`{ id, label, children }[]`。
 * `id` 用于 `node-key`；叶子仅含 `label` 与 `children`（空数组可无子）。
 */
export function buildTaskLabelChildrenTreeByParentId(rows) {
  const list = Array.isArray(rows) ? rows : []
  const rowId = (r) => Number(r.id ?? r.task_id ?? r.task_pk ?? r.ID)
  const parentId = (r) => {
    const p = r.parent_task_id ?? r.parentTaskId
    if (p == null || p === '' || Number(p) === 0) return null
    const n = Number(p)
    return Number.isFinite(n) ? n : null
  }
  const labelOf = (r) => String(r.title ?? r.task_title ?? r.name ?? '未命名任务')

  const nodes = new Map()
  for (const r of list) {
    const id = rowId(r)
    if (!Number.isFinite(id)) continue
    nodes.set(id, {
      id,
      label: labelOf(r),
      _pid: parentId(r),
      children: [],
    })
  }
  const roots = []
  for (const [, node] of nodes) {
    const p = node._pid
    if (p != null && nodes.has(p)) {
      nodes.get(p).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortKey = (nid) => {
    const r = list.find((x) => rowId(x) === nid)
    return r ? Number(r.sort_order ?? r.sortOrder ?? 0) : 0
  }
  const sortRecursive = (arr) => {
    arr.sort((a, b) => sortKey(a.id) - sortKey(b.id))
    for (const x of arr) {
      if (x.children?.length) sortRecursive(x.children)
    }
  }
  sortRecursive(roots)
  const strip = (arr) => {
    for (const n of arr) {
      delete n._pid
      if (n.children?.length) strip(n.children)
    }
  }
  strip(roots)
  return roots
}

/**
 * 全项目任务：顶层为各阶段（类似文档里「一级 1 / 一级 2」），`children` 为该阶段下按 id/parent 挂好的 label 树。
 * 无流程模版时，退化为整表一棵 label 森林。
 */
export function buildProjectTasksElTreeLabelData(tpl, rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!tpl || !Array.isArray(tpl.process) || !tpl.process.length) {
    return buildTaskLabelChildrenTreeByParentId(list)
  }
  const processList = tpl.process
  const byPhase = new Map()
  for (const r of list) {
    const ph = normPhaseKey(r)
    if (!byPhase.has(ph)) byPhase.set(ph, [])
    byPhase.get(ph).push(r)
  }
  const stepKeys = new Set(processList.map((s) => String(s.id)))
  const orphans = []
  for (const [ph, bucket] of byPhase) {
    if (!ph || !stepKeys.has(ph)) orphans.push(...bucket)
  }
  const firstStepId = String(processList[0].id)
  if (orphans.length && firstStepId) {
    const existingFirst = byPhase.get(firstStepId) || []
    byPhase.set(firstStepId, [...existingFirst, ...orphans])
    for (const ph of [...byPhase.keys()]) {
      if (!ph || !stepKeys.has(ph)) byPhase.delete(ph)
    }
  }
  return processList.map((step) => {
    const phaseId = String(step.id)
    let phaseRows = byPhase.get(phaseId) || []
    const n = Number(phaseId)
    if (!phaseRows.length && Number.isFinite(n) && byPhase.has(String(n))) {
      phaseRows = byPhase.get(String(n)) || []
    }
    return {
      id: `phase-${tpl.categoryName}-${step.id}`,
      label: String(step.name),
      children: buildTaskLabelChildrenTreeByParentId(phaseRows),
    }
  })
}

/** 将 project_tasks 行合并进流程模版阶段树 */
export function mergeDbTasksWithTemplate(tpl, rows) {
  if (!tpl) return []
  const processList = Array.isArray(tpl.process) ? tpl.process : []
  if (!processList.length) return []

  const list = Array.isArray(rows) ? rows : []
  const byPhase = new Map()
  for (const r of list) {
    const ph = normPhaseKey(r)
    if (!byPhase.has(ph)) byPhase.set(ph, [])
    byPhase.get(ph).push(r)
  }

  const stepKeys = new Set(processList.map((s) => String(s.id)))
  const orphans = []
  for (const [ph, bucket] of byPhase) {
    if (!ph || !stepKeys.has(ph)) {
      orphans.push(...bucket)
    }
  }
  const firstStepId = String(processList[0].id)
  if (orphans.length && firstStepId) {
    const existingFirst = byPhase.get(firstStepId) || []
    const mergedFirst = [...existingFirst, ...orphans]
    byPhase.set(firstStepId, mergedFirst)
    for (const ph of [...byPhase.keys()]) {
      if (!ph || !stepKeys.has(ph)) byPhase.delete(ph)
    }
  }

  return processList.map((step) => {
    const phaseId = String(step.id)
    let phaseRows = byPhase.get(phaseId) || []
    const n = Number(phaseId)
    if (!phaseRows.length && Number.isFinite(n) && byPhase.has(String(n))) {
      phaseRows = byPhase.get(String(n)) || []
    }
    return {
      id: `bt-cat-${tpl.categoryName}-ph-${step.id}`,
      label: step.name,
      nodeType: 'phase',
      phaseId: step.id,
      categoryName: tpl.categoryName,
      children: buildChildrenForPhase(phaseRows, tpl),
    }
  })
}
