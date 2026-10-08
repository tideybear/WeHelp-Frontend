/** 任务详情右栏：纯函数与常量（无 Vue 依赖） */

export const TASK_PRIORITY_OPTIONS = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
]

export const TASK_STATUS_OPTIONS = [
  { label: '未开始', value: '未开始' },
  { label: '进行中', value: '进行中' },
  { label: '已完成', value: '已完成' },
]

export function formatDateTime(ms) {
  if (ms == null || ms === '') return '—'
  const d = new Date(Number(ms))
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 计划日期提交库：YYYY-MM-DD（本地日历日） */
export function msToLocalYmd(ms) {
  if (ms == null || ms === '') return null
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  const d = new Date(n)
  if (Number.isNaN(d.getTime())) return null
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 光标是否在一段未结束的 @提及 内（@ 至光标之间无空白） */
export function getMentionState(text, caret) {
  if (caret == null || caret < 0) return null
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at === -1) return null
  const segment = before.slice(at + 1, caret)
  if (/[\s\u3000]/.test(segment)) return null
  return { start: at, query: segment }
}

/** 统计阶段下任务节点总数（含多级子任务） */
export function countDescendantTasks(nodes) {
  if (!nodes?.length) return 0
  let n = 0
  for (const node of nodes) {
    if (node.nodeType === 'task') {
      n += 1
      n += countDescendantTasks(node.children)
    }
  }
  return n
}

export function parsePlannedToMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : null
}

export function taskDetailStartMs(data) {
  const a = parsePlannedToMs(data?.actual_start_date)
  if (a != null) return a
  const p = parsePlannedToMs(data?.planned_start_date)
  if (p != null) return p
  const s = data?.startAt
  return typeof s === 'number' && Number.isFinite(s) ? s : null
}

export function taskDetailEndMs(data) {
  const a = parsePlannedToMs(data?.actual_end_date)
  if (a != null) return a
  const p = parsePlannedToMs(data?.planned_end_date)
  if (p != null) return p
  const e = data?.endAt
  return typeof e === 'number' && Number.isFinite(e) ? e : null
}

/** 将刚保存的任务快照合并进列表（返回新数组，便于就地更新父链） */
export function mergeTaskRowOverrides(taskRows, overrides) {
  if (!Array.isArray(overrides) || !overrides.length) {
    return Array.isArray(taskRows) ? taskRows.map((r) => ({ ...r })) : []
  }
  const map = new Map()
  for (const o of overrides) {
    const id = Number(o?.id ?? o?.task_id)
    if (Number.isFinite(id)) map.set(id, o)
  }
  if (!map.size) return Array.isArray(taskRows) ? taskRows.map((r) => ({ ...r })) : []
  return (Array.isArray(taskRows) ? taskRows : []).map((row) => {
    const id = Number(row?.id ?? row?.task_id)
    const patch = map.get(id)
    return patch ? { ...row, ...patch } : { ...row }
  })
}

/** 任务进度 0~100，非法或空返回 null */
export function normalizeCurrentTaskProgress(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

/** @deprecated 使用 normalizeCurrentTaskProgress */
export const normalizeCurrentProjectProgress = normalizeCurrentTaskProgress

/** 当前节点是否存在直接子任务（任务类型子节点） */
export function taskNodeHasDirectChildTasks(node) {
  const children = node?.children
  if (!Array.isArray(children) || !children.length) return false
  return children.some((c) => {
    if (!c || typeof c !== 'object') return false
    return c.nodeType === 'task' || c._taskDbId != null || c.dbTaskId != null
  })
}

export function getDirectChildTaskNodes(node) {
  const children = node?.children
  if (!Array.isArray(children)) return []
  return children.filter((c) => {
    if (!c || typeof c !== 'object') return false
    return c.nodeType === 'task' || c._taskDbId != null || c.dbTaskId != null
  })
}

/** 单条任务行/节点的有效进度（未开始=0，已完成=100，进行中取 current_task_progress） */
export function resolveTaskProgressPercentFromSource(source) {
  const tri = normalizeTaskTriStatus(source?.task_status ?? source?.status)
  if (tri === '未开始') return 0
  if (tri === '已完成') return 100
  const v = normalizeCurrentTaskProgress(source?.current_task_progress)
  return v != null ? v : 0
}

/**
 * 有子任务时：父进度 = Σ(子任务进度 / 子任务数)，例如 4 个子任务各权重 25%。
 */
export function computeParentProgressFromDirectChildren(node) {
  const kids = getDirectChildTaskNodes(node)
  if (!kids.length) return 0
  const n = kids.length
  let total = 0
  for (const child of kids) {
    total += resolveTaskProgressPercentFromSource(child) / n
  }
  return Math.min(100, Math.max(0, Math.round(total * 100) / 100))
}

/** 基于扁平任务列表计算某父任务的加权进度 */
export function computeParentProgressFromTaskRows(parentTaskId, taskRows) {
  const pid = Number(parentTaskId)
  if (!Number.isFinite(pid)) return 0
  const children = (Array.isArray(taskRows) ? taskRows : []).filter((r) => {
    const p = Number(r?.parent_task_id ?? r?.parentTaskId)
    return Number.isFinite(p) && p === pid
  })
  if (!children.length) return 0
  const n = children.length
  let total = 0
  for (const row of children) {
    total += resolveTaskProgressPercentFromSource(row) / n
  }
  return Math.min(100, Math.max(0, Math.round(total * 100) / 100))
}

const PROGRESS_MATCH_EPS = 0.01

/** 库内 current_task_progress 与按子任务加权结果不一致的父任务补丁 */
export function collectStoredParentProgressMismatches(projectId, taskRows) {
  const rows = Array.isArray(taskRows) ? taskRows : []
  const project_id = Number(projectId)
  if (!Number.isFinite(project_id)) return []

  const patches = []
  for (const row of rows) {
    const id = Number(row?.id ?? row?.task_id)
    if (!Number.isFinite(id)) continue
    const childCount = rows.filter((r) => {
      const p = Number(r?.parent_task_id ?? r?.parentTaskId)
      return Number.isFinite(p) && p === id
    }).length
    if (childCount <= 0) continue

    const computed = computeParentProgressFromTaskRows(id, rows)
    const stored = normalizeCurrentTaskProgress(row?.current_task_progress)
    const storedEff = stored != null ? stored : computed
    if (Math.abs(storedEff - computed) < PROGRESS_MATCH_EPS) continue

    patches.push({
      project_id,
      task_id: id,
      current_task_progress: computed,
    })
  }
  return patches
}

/**
 * 自变更任务向上逐级汇总父任务进度（每层写回 rows 后再算上一层，保证祖父任务正确）。
 */
export function collectParentProgressPatches(projectId, taskRows, changedTaskId) {
  const rows = Array.isArray(taskRows) ? taskRows : []
  const pid0 = Number(changedTaskId)
  const project_id = Number(projectId)
  if (!Number.isFinite(pid0) || !Number.isFinite(project_id)) return []

  const byId = new Map()
  for (const r of rows) {
    const id = Number(r?.id ?? r?.task_id)
    if (Number.isFinite(id)) byId.set(id, r)
  }

  const patches = []
  let row = byId.get(pid0)
  let parentId = row?.parent_task_id ?? row?.parentTaskId
  while (parentId != null && parentId !== '' && Number(parentId) !== 0) {
    const pid = Number(parentId)
    if (!Number.isFinite(pid)) break
    const childCount = rows.filter((r) => {
      const p = Number(r?.parent_task_id ?? r?.parentTaskId)
      return Number.isFinite(p) && p === pid
    }).length
    if (childCount > 0) {
      const progress = computeParentProgressFromTaskRows(pid, rows)
      patches.push({
        project_id,
        task_id: pid,
        current_task_progress: progress,
      })
      const parentRow = byId.get(pid)
      if (parentRow) {
        parentRow.current_task_progress = progress
      }
    }
    row = byId.get(pid)
    if (!row) break
    parentId = row?.parent_task_id ?? row?.parentTaskId
  }
  return patches
}

/** 根据若干任务 id，收集其全部祖先任务 id（用于删除/拖拽后重算父链进度） */
export function collectAncestorTaskIdsFromRows(taskRows, startTaskIds) {
  const rows = Array.isArray(taskRows) ? taskRows : []
  const byId = new Map()
  for (const r of rows) {
    const id = Number(r?.id ?? r?.task_id)
    if (Number.isFinite(id)) byId.set(id, r)
  }
  const out = new Set()
  const starts = (Array.isArray(startTaskIds) ? startTaskIds : []).map(Number)
  for (const sid of starts) {
    if (!Number.isFinite(sid) || sid <= 0) continue
    let row = byId.get(sid)
    let parentId = row?.parent_task_id ?? row?.parentTaskId
    while (parentId != null && parentId !== '' && Number(parentId) !== 0) {
      const pid = Number(parentId)
      if (!Number.isFinite(pid)) break
      out.add(pid)
      row = byId.get(pid)
      parentId = row?.parent_task_id ?? row?.parentTaskId
    }
  }
  return [...out]
}

/** 按执行状态与子任务规则解析应展示/入库的任务进度 */
export function resolveCurrentTaskProgressForNode(node, rawFromRow, taskRows) {
  const hasKids = taskNodeHasDirectChildTasks(node)
  if (hasKids) {
    const tid = resolveBottomTaskDbId(node)
    if (Array.isArray(taskRows) && tid != null) {
      const fromRows = computeParentProgressFromTaskRows(tid, taskRows)
      if (fromRows != null) return fromRows
    }
    return computeParentProgressFromDirectChildren(node)
  }
  const tri = normalizeTaskTriStatus(node?.status ?? node?.task_status)
  if (tri === '未开始') return 0
  if (tri === '已完成') return 100
  const v = normalizeCurrentTaskProgress(rawFromRow ?? node?.current_task_progress)
  return v != null ? v : 0
}

/** 仅「进行中」且无直接子任务时可编辑任务进度 */
export function isTaskProgressEditable(node) {
  if (!node || node.nodeType !== 'task') return false
  const tri = normalizeTaskTriStatus(node.status ?? node.task_status)
  if (tri !== '进行中') return false
  return !taskNodeHasDirectChildTasks(node)
}

export function taskProgressFieldHint(node) {
  if (!node || node.nodeType !== 'task') return ''
  const tri = normalizeTaskTriStatus(node.status ?? node.task_status)
  if (tri === '未开始') return '未开始时固定为 0%'
  if (tri === '已完成') return '已完成时固定为 100%'
  if (taskNodeHasDirectChildTasks(node)) {
    const n = getDirectChildTaskNodes(node).length
    return n > 0 ? `按 ${n} 个子任务加权汇总（各占 ${(100 / n).toFixed(1)}%）` : ''
  }
  return '0~100，修改后自动保存'
}

/** 根据当前状态写回节点上的 current_task_progress */
export function applyTaskProgressByStatus(node, taskRows) {
  if (!node || node.nodeType !== 'task') return
  node.current_task_progress = resolveCurrentTaskProgressForNode(
    node,
    node.current_task_progress,
    taskRows,
  )
}

/** 与底部树、接口对齐：仅三态 */
export function normalizeTaskTriStatus(raw) {
  const t = String(raw ?? '').trim()
  if (t === '进行中') return '进行中'
  if (t === '已完成' || t === '已结束') return '已完成'
  if (t === '未开始' || t === '待执行' || t === '') return '未开始'
  return '未开始'
}

/** 由子任务（已归一为三态）推导父任务状态：全未开始→未开始；全已完成→已完成；其余→进行中 */
export function derivedParentStatusFromChildTriStatuses(statuses) {
  if (!statuses.length) return null
  if (statuses.every((s) => s === '未开始')) return '未开始'
  if (statuses.every((s) => s === '已完成')) return '已完成'
  return '进行中'
}

/**
 * 后序遍历：由直接子任务状态汇总父任务状态，并就地更新树节点。
 * @returns {{ task_id: number, task_status: string }[]}
 */
export function rollupParentTaskStatusInTree(roots) {
  const patchMap = new Map()

  function mergePatch(tid, partial) {
    if (!Number.isFinite(tid) || tid <= 0) return
    const prev = patchMap.get(tid)
    if (prev) Object.assign(prev, partial)
    else patchMap.set(tid, { task_id: tid, ...partial })
  }

  function postOrder(node) {
    if (!node || typeof node !== 'object') return
    const ch = node.children
    if (Array.isArray(ch)) {
      for (const c of ch) postOrder(c)
    }
    if (node.nodeType !== 'task') return

    const taskKidsDirect = Array.isArray(node.children)
      ? node.children.filter((c) => c?.nodeType === 'task')
      : []
    if (!taskKidsDirect.length) return

    const prevStatusTri = normalizeTaskTriStatus(node.task_status ?? node.status)
    const childTri = taskKidsDirect.map((c) => normalizeTaskTriStatus(c.task_status ?? c.status))
    const derived = derivedParentStatusFromChildTriStatuses(childTri)
    if (!derived) return

    node.task_status = derived
    node.status = derived
    const tid = resolveBottomTaskDbId(node)
    if (derived !== prevStatusTri && tid != null) {
      mergePatch(tid, { task_status: derived })
    }
  }

  if (!Array.isArray(roots)) return []
  for (const r of roots) postOrder(r)
  return [...patchMap.values()]
}

/** 将状态补丁写回扁平任务列表 */
export function applyTaskStatusPatchesToTaskList(taskListRef, patches) {
  if (!taskListRef || !Array.isArray(patches) || !patches.length) return
  const list = taskListRef.value
  if (!Array.isArray(list)) return
  const byId = new Map(
    patches
      .filter((p) => p?.task_status != null)
      .map((p) => [Number(p.task_id), normalizeTaskTriStatus(p.task_status)]),
  )
  for (const row of list) {
    const id = Number(row?.id ?? row?.task_id)
    if (!byId.has(id)) continue
    const tri = byId.get(id)
    row.task_status = tri
    row.status = tri
  }
}

/** 流程/阶段节点下：子孙任务数量、三态分布、计划起止（取所有任务最早开始、最晚结束） */
export function aggregateDescendantTaskStats(children) {
  const byStatus = { 未开始: 0, 进行中: 0, 已完成: 0 }
  let total = 0
  let minStart = null
  let maxEnd = null
  function walk(nodes) {
    if (!nodes?.length) return
    for (const node of nodes) {
      if (node?.nodeType === 'task') {
        total += 1
        const st = normalizeTaskTriStatus(node.task_status ?? node.status)
        if (st in byStatus) byStatus[st] += 1
        const sm = taskDetailStartMs(node)
        const em = taskDetailEndMs(node)
        if (sm != null) minStart = minStart == null ? sm : Math.min(minStart, sm)
        if (em != null) maxEnd = maxEnd == null ? em : Math.max(maxEnd, em)
        walk(node.children)
      } else if (node?.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(children ?? [])
  let plannedRangeText = '—'
  if (minStart != null && maxEnd != null) {
    plannedRangeText = `${formatDateTime(minStart)} ~ ${formatDateTime(maxEnd)}`
  } else if (minStart != null) {
    plannedRangeText = `${formatDateTime(minStart)} 起`
  } else if (maxEnd != null) {
    plannedRangeText = `至 ${formatDateTime(maxEnd)}`
  }
  return { total, byStatus, plannedRangeText }
}

export function structuralChildPhaseCount(node) {
  if (!node?.children?.length) return 0
  return node.children.filter((c) => c?.nodeType === 'phase').length
}

/** 后序遍历任务树：有子任务的节点按子节点重新加权进度（与列表汇总一致） */
export function rollupTaskProgressPostOrderOnTree(roots) {
  if (!Array.isArray(roots)) return
  function postOrder(nodes) {
    for (const n of nodes ?? []) {
      if (Array.isArray(n?.children) && n.children.length) postOrder(n.children)
      if (n?.nodeType === 'task' && taskNodeHasDirectChildTasks(n)) {
        n.current_task_progress = computeParentProgressFromDirectChildren(n)
      }
    }
  }
  postOrder(roots)
}

/** 将进度补丁就地写入任务树节点（不替换树根，避免 el-tree 重绘缩放） */
export function applyTaskProgressPatchesToTreeRoots(roots, patches) {
  if (!Array.isArray(roots) || !Array.isArray(patches) || !patches.length) return
  const byId = new Map(
    patches.map((p) => [Number(p.task_id), p.current_task_progress]),
  )
  function walk(nodes) {
    for (const n of nodes ?? []) {
      if (n?.nodeType === 'task') {
        const id = resolveBottomTaskDbId(n)
        if (id != null && byId.has(id)) {
          n.current_task_progress = byId.get(id)
        }
      }
      if (Array.isArray(n?.children) && n.children.length) walk(n.children)
    }
  }
  walk(roots)
}

/** 从合并后的新树拷贝任务节点的进度/状态到现有树（结构不变时） */
export function patchTaskFieldsFromMergedTree(targetRoots, sourceRoots) {
  if (!Array.isArray(targetRoots) || !Array.isArray(sourceRoots)) return
  const byId = new Map()
  function collect(nodes) {
    for (const n of nodes ?? []) {
      if (n?.nodeType === 'task') {
        const id = resolveBottomTaskDbId(n)
        if (id != null) byId.set(id, n)
      }
      if (Array.isArray(n?.children) && n.children.length) collect(n.children)
    }
  }
  collect(sourceRoots)
  function apply(nodes) {
    for (const n of nodes ?? []) {
      if (n?.nodeType === 'task') {
        const id = resolveBottomTaskDbId(n)
        const src = id != null ? byId.get(id) : null
        if (src) {
          n.current_task_progress = src.current_task_progress
          const st = src.task_status ?? src.status
          if (st != null && String(st).trim() !== '') {
            const tri = normalizeTaskTriStatus(st)
            n.task_status = tri
            n.status = tri
          }
        }
      }
      if (Array.isArray(n?.children) && n.children.length) apply(n.children)
    }
  }
  apply(targetRoots)
}

/** 底部树任务节点对应的数据库任务 id（合并树常见 `_taskDbId` / `dbTaskId` / `task-数字`） */
export function resolveBottomTaskDbId(data) {
  if (!data || typeof data !== 'object') return null
  const a = Number(data._taskDbId)
  if (Number.isFinite(a) && a > 0) return a
  const b = Number(data.dbTaskId)
  if (Number.isFinite(b) && b > 0) return b
  const raw = data.id
  if (typeof raw === 'string') {
    const m = raw.match(/^task-(\d+)$/) || raw.match(/^dbt-(\d+)$/)
    if (m) {
      const n = Number(m[1])
      return Number.isFinite(n) && n > 0 ? n : null
    }
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 收集树中所有任务节点的数据库 id */
export function collectTaskDbIdsInTree(nodes, out = new Set()) {
  if (!Array.isArray(nodes)) return out
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const tid = resolveBottomTaskDbId(n)
    if (tid != null) out.add(tid)
    if (Array.isArray(n.children) && n.children.length) collectTaskDbIdsInTree(n.children, out)
  }
  return out
}

/** 从树中移除指定数据库 id 的任务节点（保留流程结构，就地更新） */
export function removeTaskNodesByDbIds(nodes, taskIds) {
  const idSet = new Set(
    (Array.isArray(taskIds) ? taskIds : [])
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0),
  )
  if (!idSet.size || !Array.isArray(nodes)) return Array.isArray(nodes) ? nodes : []

  function walk(list) {
    if (!Array.isArray(list)) return []
    const out = []
    for (const n of list) {
      if (!n || typeof n !== 'object') continue
      const tid = resolveBottomTaskDbId(n)
      if (tid != null && idSet.has(tid)) continue
      out.push({ ...n, children: walk(n.children) })
    }
    return out
  }

  return walk(nodes)
}

/** 流程/阶段节点与任务行对齐用的链接键（与 useProjectTaskTree.normProcessesLinkKey 一致） */
function resolveProcessesLinkKey(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const v =
    obj.Processes_id ??
    obj.processes_id ??
    obj.process_id ??
    obj.project_processes_id ??
    obj.projectProcessesId
  if (v != null && String(v).trim() !== '') return String(v).trim()
  const fallback = obj.step_id ?? obj.phase_id ?? obj.phaseId
  if (fallback == null || fallback === '') return ''
  return String(fallback).trim()
}

/** el-tree node-key：优先已有 id，否则按流程键 / 任务 id 生成稳定键 */
export function resolveTreeNodeKey(node) {
  if (!node || typeof node !== 'object') return null
  const raw = node.id
  if (raw != null && raw !== '') return raw
  const link = resolveProcessesLinkKey(node)
  if (link) return `proc-${link}`
  const tid = resolveBottomTaskDbId(node)
  if (tid != null) return `task-${tid}`
  return null
}

function isBottomTreeTaskNode(n) {
  if (!n || typeof n !== 'object') return false
  if (n.nodeType === 'task') return true
  return resolveBottomTaskDbId(n) != null
}

/**
 * 为 processes 合并树补全 node-key 与 nodeType，避免无 id 的流程节点阻断路径搜索与 el-tree 展开。
 */
export function ensureTreeNodeKeys(nodes, keyPrefix = 'root') {
  if (!Array.isArray(nodes)) return
  nodes.forEach((node, index) => {
    if (!node || typeof node !== 'object') return
    if (node.id == null || node.id === '') {
      const link = resolveProcessesLinkKey(node)
      if (link) node.id = `proc-${keyPrefix}-${link}`
      else if (isBottomTreeTaskNode(node)) {
        const tid = resolveBottomTaskDbId(node)
        if (tid != null) node.id = `task-${tid}`
      } else {
        node.id = `${keyPrefix}-n-${index}`
      }
    }
    if (!node.nodeType) {
      if (isBottomTreeTaskNode(node)) node.nodeType = 'task'
      else if (node.step_name != null || node.step_id != null || node.phase_id != null) node.nodeType = 'phase'
      else node.nodeType = 'process'
    }
    ensureTreeNodeKeys(node.children, String(node.id))
  })
}

/** 从根到目标任务节点的 node-key 路径（用于展开 el-tree） */
export function collectTreePathKeysToTask(roots, taskDbId) {
  const tid = Number(taskDbId)
  if (!Number.isFinite(tid) || tid <= 0) return null

  function walk(nodes, path) {
    if (!Array.isArray(nodes)) return null
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue
      const nodeKey = resolveTreeNodeKey(n)
      const nextPath = nodeKey != null ? [...path, nodeKey] : path
      if (isBottomTreeTaskNode(n) && resolveBottomTaskDbId(n) === tid) {
        return nodeKey != null ? nextPath : null
      }
      const hit = walk(n.children, nextPath)
      if (hit) return hit
    }
    return null
  }

  return walk(roots, [])
}

/** 在底部树数据中按数据库任务 id 查找任务节点（刷新列表后用于恢复选中） */
export function findTaskNodeInTreeRoots(roots, taskId) {
  if (!Array.isArray(roots) || !Number.isFinite(taskId)) return null
  for (const n of roots) {
    if (isBottomTreeTaskNode(n) && resolveBottomTaskDbId(n) === taskId) return n
    const hit = findTaskNodeInTreeRoots(n?.children, taskId)
    if (hit) return hit
  }
  return null
}

export function bottomTreeNodeDisplayLabel(data) {
  if (data == null) return ''
  if (typeof data !== 'object') return String(data)
  return String(data.label ?? data.name ?? data.step_name ?? data.process_name ?? data.title ?? '')
}
