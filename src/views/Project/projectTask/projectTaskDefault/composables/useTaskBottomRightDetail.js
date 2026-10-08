import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import {
  getProjectTaskDetailAPI,
  getProjectTaskCommentsAPI,
  createProjectTaskCommentAPI,
  deleteProjectTaskCommentAPI,
  updateProjectTaskDetailFieldsAPI,
} from '@/apis/project'
import { findParentDataInProcessTree } from './useProjectTaskTree'
import {
  aggregateDescendantTaskStats,
  bottomTreeNodeDisplayLabel,
  countDescendantTasks,
  findTaskNodeInTreeRoots,
  formatDateTime,
  getMentionState,
  msToLocalYmd,
  normalizeTaskTriStatus,
  normalizeCurrentTaskProgress,
  resolveCurrentTaskProgressForNode,
  applyTaskProgressByStatus,
  isTaskProgressEditable,
  taskProgressFieldHint,
  taskNodeHasDirectChildTasks,
  parsePlannedToMs,
  resolveBottomTaskDbId,
  structuralChildPhaseCount,
  applyTaskProgressPatchesToTreeRoots,
  rollupParentTaskStatusInTree,
  applyTaskStatusPatchesToTaskList,
  rollupTaskProgressPostOrderOnTree,
} from './taskBottomRightHelpers'
import {
  syncProjectTaskProgressRollup,
  syncProjectTaskProgressRollupBatch,
  applyTaskProgressPatchesToTaskList,
} from './syncProjectTaskProgress'
import {
  readPersistedTaskTreeSelection,
  writePersistedTaskTreeSelection,
} from './useTaskTreeSelectionPersist'

/**
 * 任务页右侧「详情」区：选中节点、任务详情拉取/保存、评论与 @ 提及、日期选择约束。
 * @param {object} deps
 * @param {import('vue').Ref<any[]>} deps.bottomTaskTreeData
 * @param {import('vue').Ref<string>} deps.projectPlannedStartDate
 * @param {import('vue').Ref<string>} deps.projectPlannedEndDate
 * @param {import('vue').Ref<any[]>} deps.projectUserAuthorizeOptions
 * @param {import('vue').Ref<any>} deps.selectedProjectId
 * @param {import('vue').ComputedRef<number | null>} deps.addTaskProjectId
 * @param {() => Promise<void>} deps.reloadProjectTasksOnly
 * @param {import('vue').Ref<any[]>} [deps.projectTaskList]
 */
export function useTaskBottomRightDetail(deps) {
  const userStore = useUserStore()
  const {
    bottomTaskTreeData,
    projectPlannedStartDate,
    projectPlannedEndDate,
    projectUserAuthorizeOptions,
    selectedProjectId,
    addTaskProjectId,
    reloadProjectTasksOnly,
    projectTaskList,
  } = deps

  const selectedBottomNode = ref(null)
  const selectedTreeNodeKey = ref(null)
  const taskCommentDraft = ref('')
  const taskDetailLoading = ref(false)
  const taskDetailSaving = ref(false)
  let taskDetailRequestSeq = 0

  const taskDetailStatusBaseline = ref('未开始')
  const taskDetailProgressBaseline = ref(null)
  const taskDetailLoadedTaskId = ref(null)
  const taskDetailStatusChangeInFlight = ref(false)
  const taskDetailProgressSaveInFlight = ref(false)
  let taskDetailHydrateDepth = 0

  function isTaskDetailHydrating() {
    return taskDetailHydrateDepth > 0 || taskDetailLoading.value || taskDetailSaving.value
  }

  function runWithTaskDetailHydrate(fn) {
    taskDetailHydrateDepth += 1
    try {
      return fn()
    } finally {
      taskDetailHydrateDepth -= 1
    }
  }

  function progressValuesEqual(a, b) {
    const na = normalizeCurrentTaskProgress(a)
    const nb = normalizeCurrentTaskProgress(b)
    if (na == null && nb == null) return true
    if (na == null || nb == null) return false
    return Math.abs(na - nb) < 0.0001
  }

  function setTaskDetailProgressBaseline(node) {
    if (!node || node.nodeType !== 'task') {
      taskDetailProgressBaseline.value = null
      return
    }
    taskDetailProgressBaseline.value = normalizeCurrentTaskProgress(node.current_task_progress)
  }

  function assigneeValueFromDetailRow(row) {
    const opts = projectUserAuthorizeOptions.value
    const name = row.assignee_name != null ? String(row.assignee_name).trim() : ''
    if (name) {
      const byName = opts.find((o) => o.label === name)
      if (byName) return byName.value
      return ''
    }
    const idRaw = row.assignee_id
    if (idRaw != null && String(idRaw).trim() !== '') {
      const s = String(idRaw).trim()
      const byVal = opts.find((o) => o.value === s)
      if (byVal) return byVal.value
      return s
    }
    return ''
  }

  function applyAuthorizeAssigneeToNode(node, selectedUserId) {
    if (!node) return
    const v = selectedUserId != null && String(selectedUserId).trim() !== '' ? String(selectedUserId).trim() : ''
    if (!v) {
      node.assignee_id = null
      node.assignee_name = null
      node.assignee = ''
      return
    }
    const opt = projectUserAuthorizeOptions.value.find((o) => o.value === v)
    if (opt) {
      node.assignee_id = opt.value
      node.assignee_name = opt.label
      node.assignee = opt.value
      return
    }
    node.assignee_id = v
    node.assignee_name = String(node.assignee_name ?? '').trim() || null
    node.assignee = v
  }

  function onTaskAssigneeSelectChange(val) {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return
    applyAuthorizeAssigneeToNode(node, val)
    void saveTaskDetailToServer()
  }

  function onTaskCurrentTaskProgressChange(val) {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return
    if (isTaskDetailHydrating() || taskDetailStatusChangeInFlight.value || taskDetailSaving.value) return
    if (!isTaskProgressEditable(node)) {
      // 执行状态变更等会联动改写进度并触发 @change，非用户手改，不提示
      runWithTaskDetailHydrate(() => {
        applyTaskProgressByStatus(node, getTaskRowsSnapshot())
        setTaskDetailProgressBaseline(node)
      })
      return
    }
    const next = normalizeCurrentTaskProgress(val)
    if (progressValuesEqual(next, taskDetailProgressBaseline.value)) return
    node.current_task_progress = next
    void saveTaskDetailToServer({ progressOnly: true })
  }

  function getTaskRowsSnapshot() {
    return projectTaskList?.value ?? []
  }

  function assertTaskDetailMsWithinPickerBounds(which, ms) {
    if (ms == null || ms === '') return true
    const t = Number(ms)
    if (!Number.isFinite(t)) return false
    const { lo, hi } = taskDetailPickerCrossBounds(which)
    if (lo != null && t < lo) return false
    if (hi != null && t > hi) return false
    return true
  }

  function onTaskPlannedStartDateChange(v) {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return
    const t = v ? Number(v) : null
    if (t != null && !assertTaskDetailMsWithinPickerBounds('start', t)) {
      ElMessage.warning('开始时间须在允许范围内，且不能晚于截止时间')
      return
    }
    node.startAt = t
    void saveTaskDetailToServer()
  }

  function onTaskPlannedEndDateChange(v) {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return
    const t = v ? Number(v) : null
    if (t != null && !assertTaskDetailMsWithinPickerBounds('end', t)) {
      ElMessage.warning('截止时间须在允许范围内，且不能早于开始时间')
      return
    }
    node.endAt = t
    void saveTaskDetailToServer()
  }

  function onTaskCollaboratorsChange() {
    void saveTaskDetailToServer()
  }

  function onTaskExecutionStatusChange() {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task' || taskDetailStatusChangeInFlight.value) return
    const tri = normalizeTaskTriStatus(node.status ?? node.task_status)
    node.status = tri
    node.task_status = tri
    taskDetailStatusChangeInFlight.value = true
    runWithTaskDetailHydrate(() => {
      applyTaskProgressByStatus(node, getTaskRowsSnapshot())
      setTaskDetailProgressBaseline(node)
    })
    void saveTaskDetailToServer({ statusChange: true }).finally(() => {
      taskDetailStatusChangeInFlight.value = false
    })
  }

  function parseParticipantIdsRaw(raw) {
    if (raw == null || raw === '') return []
    if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
    if (typeof raw === 'string') {
      const t = raw.trim()
      if (!t) return []
      try {
        const j = JSON.parse(t)
        if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean)
      } catch {
        /* ignore */
      }
      return t.split(/[,;，\s]+/).map((x) => x.trim()).filter(Boolean)
    }
    return []
  }

  function collaboratorsFromParticipantIdsRow(row) {
    const arr = parseParticipantIdsRaw(row.participant_ids)
    const opts = projectUserAuthorizeOptions.value
    const valueSet = new Set(opts.map((o) => o.value))
    const labelToValue = new Map(opts.map((o) => [o.label, o.value]))
    const out = []
    for (const x of arr) {
      const xs = String(x).trim()
      if (!xs) continue
      if (valueSet.has(xs)) out.push(xs)
      else if (labelToValue.has(xs)) out.push(labelToValue.get(xs))
      else {
        const byId = opts.find((o) => o.value === xs)
        if (byId) out.push(byId.value)
      }
    }
    return [...new Set(out)]
  }

  function syncCollaboratorsDerivedCsv(node) {
    if (!node || typeof node !== 'object') return
    const raw = Array.isArray(node.collaborators) ? node.collaborators : []
    const opts = projectUserAuthorizeOptions.value
    const idToLabel = new Map(
      opts.map((o) => {
        const id = String(o.value ?? '').trim()
        const lab = String(o.label ?? '').trim()
        return [id, lab || id]
      }),
    )
    const ids = []
    const names = []
    const seen = new Set()
    for (const x of raw) {
      const id = x != null ? String(x).trim() : ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      names.push(idToLabel.get(id) ?? id)
    }
    node.collaborators_ids = ids.join(',')
    node.collaborators_names = names.join(',')
  }

  function normalizePriorityFromRow(p) {
    const s = String(p ?? 'medium').trim().toLowerCase()
    if (s === 'low' || s === 'medium' || s === 'high' || s === 'urgent') return s
    const zh = String(p ?? '').trim()
    if (zh === '低') return 'low'
    if (zh === '中') return 'medium'
    if (zh === '高') return 'high'
    if (zh === '紧急') return 'urgent'
    return 'medium'
  }

  function applyProjectTaskDetailRowToBottomNode(node, row) {
    if (!node || !row || typeof row !== 'object') return
    const title = String(row.task_name ?? row.task_title ?? node.label ?? '').trim()
    if (title) {
      node.label = title
      node.process_name = title
      node.task_name = title
    }
    node.description = String(row.task_description ?? row.description ?? '')
    node.task_description = node.description
    node.current_task_progress = resolveCurrentTaskProgressForNode(
      node,
      row.current_task_progress,
      getTaskRowsSnapshot(),
    )
    const tri = normalizeTaskTriStatus(row.task_status ?? row.status)
    node.task_status = tri
    node.status = tri
    const sm = parsePlannedToMs(row.actual_start_date)
    const smDisp = sm != null ? sm : parsePlannedToMs(row.planned_start_date)
    const em = parsePlannedToMs(row.actual_end_date)
    const emDisp = em != null ? em : parsePlannedToMs(row.planned_end_date)
    node.startAt = smDisp != null ? smDisp : null
    node.endAt = emDisp != null ? emDisp : null
    node.planned_start_date = row.planned_start_date ?? ''
    node.planned_end_date = row.planned_end_date ?? ''
    node.actual_start_date = row.actual_start_date ?? ''
    node.actual_end_date = row.actual_end_date ?? ''
    node.priority = normalizePriorityFromRow(row.priority)
    node.collaborators = collaboratorsFromParticipantIdsRow(row)
    syncCollaboratorsDerivedCsv(node)
    const idNum = Number(row.id)
    if (Number.isFinite(idNum) && idNum > 0) {
      node._taskDbId = idNum
      node.dbTaskId = idNum
      node.id = `task-${idNum}`
    }
    Object.assign(node, {
      project_id: row.project_id,
      project_category_id: row.project_category_id,
      processes_id: row.processes_id,
      parent_task_id: row.parent_task_id,
      assignee_id: row.assignee_id,
      assignee_name: row.assignee_name,
      progress_percent: row.progress_percent,
      current_task_progress: node.current_task_progress,
      sort_order: row.sort_order,
    })
    const sel = assigneeValueFromDetailRow(row)
    node.assignee = sel
    if (sel) {
      applyAuthorizeAssigneeToNode(node, sel)
    }
    taskDetailStatusBaseline.value = tri
    setTaskDetailProgressBaseline(node)
    taskDetailLoadedTaskId.value = resolveBottomTaskDbId(node)
  }

  function buildTaskDetailUpdatePayload(node, project_id) {
    syncCollaboratorsDerivedCsv(node)
    const task_id = resolveBottomTaskDbId(node)
    const aid =
      node.assignee_id != null && String(node.assignee_id).trim() !== ''
        ? String(node.assignee_id).trim()
        : null
    const anRaw = node.assignee_name != null ? String(node.assignee_name).trim() : ''
    const csvIds = String(node.collaborators_ids ?? '').trim()
    const csvNames = String(node.collaborators_names ?? '').trim()
    const tri = normalizeTaskTriStatus(node.status ?? node.task_status)
    const rows = getTaskRowsSnapshot()
    const payload = {
      project_id,
      task_id,
      task_name: String(node.label ?? node.process_name ?? '').trim(),
      task_description: String(node.description ?? ''),
      actual_start_date: msToLocalYmd(node.startAt),
      actual_end_date: msToLocalYmd(node.endAt),
      task_status: tri,
      priority: normalizePriorityFromRow(node.priority),
      assignee_id: aid,
      assignee_name: anRaw || null,
      participant_ids: Array.isArray(node.collaborators) ? [...node.collaborators] : [],
      collaborators_ids: csvIds || null,
      collaborators_names: csvNames || null,
    }
    // 未开始/已完成且无子任务：进度由后端按状态落库，避免触发「仅进行中可改」校验
    if (taskNodeHasDirectChildTasks(node) || tri === '进行中') {
      const p = resolveCurrentTaskProgressForNode(node, node.current_task_progress, rows)
      if (p != null) payload.current_task_progress = p
    }
    return payload
  }

  const taskProgressEditable = computed(() => isTaskProgressEditable(selectedBottomNode.value))

  const taskProgressHint = computed(() => taskProgressFieldHint(selectedBottomNode.value))

  const bottomRightStructureStats = computed(() => {
    const node = selectedBottomNode.value
    if (!node || (node.nodeType !== 'process' && node.nodeType !== 'phase')) return null
    return aggregateDescendantTaskStats(node.children)
  })

  const selectedProcessPhaseCount = computed(() => {
    const node = selectedBottomNode.value
    if (node?.nodeType !== 'process') return 0
    return structuralChildPhaseCount(node)
  })

  function rebindSelectedTaskFromTree(taskDbId) {
    const tid = Number(taskDbId)
    if (!Number.isFinite(tid) || tid <= 0) return false
    const roots = bottomTaskTreeData.value
    if (!Array.isArray(roots) || !roots.length) return false
    const node = findTaskNodeInTreeRoots(roots, tid)
    if (!node) return false
    return runWithTaskDetailHydrate(() => {
      const prev = selectedBottomNode.value
      if (prev?.comments?.length && (!Array.isArray(node.comments) || !node.comments.length)) {
        node.comments = [...prev.comments]
      }
      const tri = normalizeTaskTriStatus(node.status ?? node.task_status)
      node.status = tri
      node.task_status = tri
      applyTaskProgressByStatus(node, getTaskRowsSnapshot())
      selectedBottomNode.value = node
      selectedTreeNodeKey.value = node.id ?? `task-${tid}`
      setTaskDetailProgressBaseline(node)
      taskDetailLoadedTaskId.value = tid
      return true
    })
  }

  function reselectTaskByDbId(taskDbId, options = {}) {
    const tid = Number(taskDbId)
    if (!Number.isFinite(tid) || tid <= 0) return false
    const cur = resolveBottomTaskDbId(selectedBottomNode.value)
    if (options.silent !== false && cur === tid && taskDetailLoadedTaskId.value === tid) {
      return rebindSelectedTaskFromTree(tid)
    }
    const roots = bottomTaskTreeData.value
    if (!Array.isArray(roots) || !roots.length) return false
    const node = findTaskNodeInTreeRoots(roots, tid)
    if (!node) return false
    onBottomTreeNodeClick(node, { forceFetch: options.forceFetch === true })
    return true
  }

  async function tryRestorePersistedSelection(projectId) {
    const saved = readPersistedTaskTreeSelection()
    if (!saved || String(saved.projectId) !== String(projectId ?? '')) return false
    await nextTick()
    return reselectTaskByDbId(saved.taskDbId)
  }

  watch(bottomTaskTreeData, (roots) => {
    if (taskDetailSaving.value || taskDetailProgressSaveInFlight.value) return
    const prev = selectedBottomNode.value
    const tid = prev?.nodeType === 'task' ? resolveBottomTaskDbId(prev) : null
    if (tid != null && Number.isFinite(tid) && Array.isArray(roots)) {
      const next = findTaskNodeInTreeRoots(roots, tid)
      if (next) {
        runWithTaskDetailHydrate(() => {
          if (prev?.comments?.length && (!Array.isArray(next.comments) || !next.comments.length)) {
            next.comments = [...prev.comments]
          }
          const tri = normalizeTaskTriStatus(next.status ?? next.task_status)
          next.status = tri
          next.task_status = tri
          applyTaskProgressByStatus(next, getTaskRowsSnapshot())
          selectedBottomNode.value = next
          selectedTreeNodeKey.value = next.id ?? `task-${tid}`
          setTaskDetailProgressBaseline(next)
        })
        if (taskDetailLoadedTaskId.value !== tid) {
          void fetchProjectTaskDetailForNode(next)
        }
        return
      }
    }
    const saved = readPersistedTaskTreeSelection()
    const pid = selectedProjectId.value
    if (saved && pid != null && String(saved.projectId) === String(pid) && Array.isArray(roots) && roots.length) {
      const restored = findTaskNodeInTreeRoots(roots, saved.taskDbId)
      if (restored) {
        onBottomTreeNodeClick(restored)
        return
      }
    }
    selectedBottomNode.value = null
    selectedTreeNodeKey.value = null
    taskDetailLoading.value = false
    taskDetailSaving.value = false
    taskDetailRequestSeq += 1
    taskDetailStatusBaseline.value = '未开始'
    taskDetailProgressBaseline.value = null
    taskDetailLoadedTaskId.value = null
  })

  function localDayStartMsFromStr(v) {
    if (v == null || v === '') return null
    const t = Date.parse(String(v))
    if (!Number.isFinite(t)) return null
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  function localDayEndMsFromStr(v) {
    if (v == null || v === '') return null
    const t = Date.parse(String(v))
    if (!Number.isFinite(t)) return null
    const d = new Date(t)
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }

  function startOfLocalDayMsFromTime(ms) {
    if (ms == null || ms === '') return null
    const n = Number(ms)
    if (!Number.isFinite(n)) return null
    const d = new Date(n)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  function endOfLocalDayMsFromTime(ms) {
    if (ms == null || ms === '') return null
    const n = Number(ms)
    if (!Number.isFinite(n)) return null
    const d = new Date(n)
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }

  function projectPlannedConstraintMs() {
    const lo = localDayStartMsFromStr(projectPlannedStartDate.value)
    const hi = localDayEndMsFromStr(projectPlannedEndDate.value)
    if (lo == null && hi == null) return null
    if (lo != null && hi != null && lo > hi) return null
    return { minMs: lo, maxMs: hi }
  }

  const taskDetailDateConstraint = computed(() => {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return null
    const roots = bottomTaskTreeData.value
    if (!Array.isArray(roots)) return null
    const parent = findParentDataInProcessTree(roots, node)
    if (parent?.nodeType === 'task') {
      const lo = parsePlannedToMs(parent.actual_start_date)
      const hi = parsePlannedToMs(parent.actual_end_date)
      if (lo == null || hi == null || lo > hi) return null
      return { minMs: lo, maxMs: hi }
    }
    return projectPlannedConstraintMs()
  })

  function taskDetailPickerCrossBounds(which) {
    const node = selectedBottomNode.value
    const c = taskDetailDateConstraint.value
    let lo = c?.minMs ?? null
    let hi = c?.maxMs ?? null
    if (!node || node.nodeType !== 'task') return { lo, hi }
    if (which === 'start' && node.endAt != null) {
      const e = Number(node.endAt)
      if (Number.isFinite(e)) hi = hi == null ? e : Math.min(hi, e)
    }
    if (which === 'end' && node.startAt != null) {
      const s = Number(node.startAt)
      if (Number.isFinite(s)) lo = lo == null ? s : Math.max(lo, s)
    }
    return { lo, hi }
  }

  function comparingDateToDate(cd) {
    if (cd == null) return null
    if (typeof cd.toDate === 'function') return cd.toDate()
    const v = cd.valueOf?.()
    if (typeof v === 'number' && Number.isFinite(v)) return new Date(v)
    return null
  }

  function buildLocalDateTimeMs(y, month, day, h, mi, s, ms) {
    return new Date(y, month, day, h, mi, s, ms).getTime()
  }

  function isTaskDetailDayDisabledForPicker(which, time) {
    const { lo, hi } = taskDetailPickerCrossBounds(which)
    if (lo == null && hi == null) return false
    const ds = startOfLocalDayMsFromTime(new Date(time).getTime())
    const de = endOfLocalDayMsFromTime(new Date(time).getTime())
    if (ds == null || de == null) return false
    if (lo != null && de < lo) return true
    if (hi != null && ds > hi) return true
    return false
  }

  function getTaskDetailDisabledHoursForPicker(which, role, comparingDate) {
    const d = comparingDateToDate(comparingDate)
    if (!d) return []
    const { lo, hi } = taskDetailPickerCrossBounds(which)
    if (lo == null && hi == null) return []
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const out = []
    for (let h = 0; h < 24; h++) {
      const t0 = buildLocalDateTimeMs(y, m, day, h, 0, 0, 0)
      const t1 = buildLocalDateTimeMs(y, m, day, h, 59, 59, 999)
      if (t1 < (lo ?? -Infinity) || t0 > (hi ?? Infinity)) out.push(h)
    }
    return out
  }

  function getTaskDetailDisabledMinutesForPicker(which, hour, role, comparingDate) {
    const d = comparingDateToDate(comparingDate)
    if (!d || typeof hour !== 'number') return []
    const { lo, hi } = taskDetailPickerCrossBounds(which)
    if (lo == null && hi == null) return []
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const out = []
    for (let mi = 0; mi < 60; mi++) {
      const t0 = buildLocalDateTimeMs(y, m, day, hour, mi, 0, 0)
      const t1 = buildLocalDateTimeMs(y, m, day, hour, mi, 59, 999)
      if (t1 < (lo ?? -Infinity) || t0 > (hi ?? Infinity)) out.push(mi)
    }
    return out
  }

  function getTaskDetailDisabledSecondsForPicker(which, hour, minute, role, comparingDate) {
    const d = comparingDateToDate(comparingDate)
    if (!d || typeof hour !== 'number' || typeof minute !== 'number') return []
    const { lo, hi } = taskDetailPickerCrossBounds(which)
    if (lo == null && hi == null) return []
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const out = []
    for (let s = 0; s < 60; s++) {
      const t0 = buildLocalDateTimeMs(y, m, day, hour, minute, s, 0)
      const t1 = buildLocalDateTimeMs(y, m, day, hour, minute, s, 999)
      if (t1 < (lo ?? -Infinity) || t0 > (hi ?? Infinity)) out.push(s)
    }
    return out
  }

  function resolveCommentAuthorName(userId) {
    const uid = userId != null && String(userId).trim() !== '' ? String(userId).trim() : ''
    if (!uid) return '—'
    const opt = projectUserAuthorizeOptions.value.find((o) => String(o.value) === uid)
    if (opt?.label) return opt.label
    const me = userStore.userInfo
    if (me?.id != null && String(me.id) === uid) {
      const n = me.account ?? me.user_name ?? me.username ?? me.name
      if (n != null && String(n).trim() !== '') return String(n).trim()
    }
    return uid
  }

  function mapTaskCommentRowsToTimeline(rows) {
    const list = Array.isArray(rows) ? rows : []
    return list.map((r) => {
      const uid = r.user_id ?? r.userId
      const createdRaw = r.created_at ?? r.createdAt
      const createdAt = parsePlannedToMs(createdRaw)
      return {
        id: r.id,
        user_id: uid,
        author: resolveCommentAuthorName(uid),
        content: String(r.content ?? ''),
        createdAt: createdAt != null ? createdAt : null,
      }
    })
  }

  function applyTaskCommentsToBottomNode(node, rows) {
    if (!node || typeof node !== 'object') return
    node.comments = mapTaskCommentRowsToTimeline(rows)
  }

  function extractMentionFieldsFromCommentContent(text) {
    const opts = [...projectUserAuthorizeOptions.value].sort(
      (a, b) => String(b.label ?? '').length - String(a.label ?? '').length,
    )
    const ids = []
    const names = []
    const seen = new Set()
    for (const opt of opts) {
      const label = String(opt.label ?? '').trim()
      const id = String(opt.value ?? '').trim()
      if (!label || !id || seen.has(id)) continue
      if (text.includes(`@${label}`)) {
        seen.add(id)
        ids.push(id)
        names.push(label)
      }
    }
    return {
      mention_user_ids: ids.length ? ids.join(',') : undefined,
      mention_user_names: names.length ? names.join(',') : undefined,
    }
  }

  async function loadTaskCommentsForNode(node) {
    const taskId = resolveBottomTaskDbId(node)
    if (!Number.isFinite(taskId)) return
    try {
      const res = await getProjectTaskCommentsAPI({ task_id: taskId })
      if (res?.code !== 200) return
      const cur = selectedBottomNode.value
      if (!cur || cur !== node || resolveBottomTaskDbId(cur) !== taskId) return
      applyTaskCommentsToBottomNode(cur, res.data)
    } catch {
      /* 忽略评论刷新失败 */
    }
  }

  async function fetchProjectTaskDetailForNode(node) {
    const taskId = resolveBottomTaskDbId(node)
    if (!Number.isFinite(taskId)) return
    const seq = ++taskDetailRequestSeq
    taskDetailLoading.value = true
    taskDetailLoadedTaskId.value = null
    try {
      const [detailRes, commentsRes] = await Promise.all([
        getProjectTaskDetailAPI({ task_id: taskId }),
        getProjectTaskCommentsAPI({ task_id: taskId }).catch(() => ({ code: 500, data: [] })),
      ])
      if (seq !== taskDetailRequestSeq) return
      if (detailRes?.code !== 200) {
        ElMessage.error(detailRes?.msg || '获取任务详情失败')
        return
      }
      const rows = Array.isArray(detailRes.data) ? detailRes.data : []
      const row0 = rows[0]
      if (!row0) {
        ElMessage.warning('未找到该任务详情')
        return
      }
      const cur = selectedBottomNode.value
      if (!cur || resolveBottomTaskDbId(cur) !== taskId) return
      runWithTaskDetailHydrate(() => {
        applyProjectTaskDetailRowToBottomNode(cur, row0)
      })
      if (commentsRes?.code === 200) {
        applyTaskCommentsToBottomNode(cur, commentsRes.data)
      } else {
        applyTaskCommentsToBottomNode(cur, [])
      }
      taskDetailLoadedTaskId.value = taskId
    } catch (e) {
      if (seq === taskDetailRequestSeq) {
        ElMessage.error(e?.message || '获取任务详情失败')
      }
    } finally {
      if (seq === taskDetailRequestSeq) {
        taskDetailLoading.value = false
      }
    }
  }

  function onBottomTreeNodeClick(data, options = {}) {
    const prevTaskId = resolveBottomTaskDbId(selectedBottomNode.value)
    const nextTaskId = resolveBottomTaskDbId(data)
    const sameTask =
      data?.nodeType === 'task' &&
      prevTaskId != null &&
      nextTaskId != null &&
      prevTaskId === nextTaskId

    selectedBottomNode.value = data
    selectedTreeNodeKey.value = data?.id ?? data?.step_id ?? bottomTreeNodeDisplayLabel(data)
    taskCommentDraft.value = ''
    mentionVisible.value = false
    if (data?.nodeType === 'task') {
      const tid = resolveBottomTaskDbId(data)
      const pid = selectedProjectId.value ?? data.project_id
      if (tid != null && pid != null && String(pid).trim() !== '') {
        writePersistedTaskTreeSelection(pid, tid)
      }
    }
    if (data.nodeType !== 'task') {
      taskDetailLoading.value = false
      taskDetailLoadedTaskId.value = null
      taskDetailProgressBaseline.value = null
    }
    if (data.nodeType === 'task') {
      if (data.status == null && data.task_status != null) {
        data.status = data.task_status
      }
      const tri = normalizeTaskTriStatus(data.status ?? data.task_status)
      data.status = tri
      data.task_status = tri
      taskDetailStatusBaseline.value = tri
      applyTaskProgressByStatus(data, getTaskRowsSnapshot())
      setTaskDetailProgressBaseline(data)
      if (!Array.isArray(data.collaborators)) {
        data.collaborators = []
      }
      syncCollaboratorsDerivedCsv(data)
      if (sameTask && !options.forceFetch && taskDetailLoadedTaskId.value === nextTaskId) {
        return
      }
      void fetchProjectTaskDetailForNode(data)
    }
  }

  function buildTaskRowOverrideFromNode(node, payload) {
    const taskId = resolveBottomTaskDbId(node)
    if (!Number.isFinite(taskId)) return null
    const tri = normalizeTaskTriStatus(payload?.task_status ?? node.status ?? node.task_status)
    const progress =
      payload?.current_task_progress != null
        ? normalizeCurrentTaskProgress(payload.current_task_progress)
        : resolveCurrentTaskProgressForNode(node, node.current_task_progress, getTaskRowsSnapshot())
    return {
      id: taskId,
      task_id: taskId,
      task_status: tri,
      status: tri,
      current_task_progress: progress,
    }
  }

  function warnParentProgressSyncFailures(failures) {
    if (!Array.isArray(failures) || !failures.length) return
    ElMessage.warning(
      failures.length === 1
        ? '父任务进度未能写入数据库，请稍后刷新页面'
        : `${failures.length} 个父任务进度未能写入数据库，请稍后刷新页面`,
    )
  }

  async function syncParentTaskProgressChain(changedTaskId, project_id, options = {}) {
    const result = await syncProjectTaskProgressRollup({
      projectId: project_id,
      changedTaskId,
      reloadProjectTasksOnly,
      getTaskRows: getTaskRowsSnapshot,
      taskListRef: projectTaskList,
      reloadBefore: options.reloadBefore !== false,
      reloadAfter: options.reloadAfter === true,
      parentsOnly: options.parentsOnly === true,
      rowOverrides: options.rowOverrides ?? null,
    })
    if (!options.quiet) warnParentProgressSyncFailures(result?.failures)
    return result
  }

  async function syncTaskProgressRollupBatch(changedTaskIds, project_id, options = {}) {
    const result = await syncProjectTaskProgressRollupBatch({
      projectId: project_id,
      changedTaskIds,
      reloadProjectTasksOnly,
      getTaskRows: getTaskRowsSnapshot,
      taskListRef: projectTaskList,
      reloadBefore: options.reloadBefore !== false,
      reloadAfter: options.reloadAfter === true,
      parentsOnly: options.parentsOnly === true,
      rowOverrides: options.rowOverrides ?? null,
    })
    if (!options.quiet) warnParentProgressSyncFailures(result?.failures)
    return result
  }

  function warnParentStatusSyncFailures(failures) {
    if (!Array.isArray(failures) || !failures.length) return
    ElMessage.warning(
      failures.length === 1
        ? '父任务状态未能写入数据库，请稍后刷新页面'
        : `${failures.length} 个父任务状态未能写入数据库，请稍后刷新页面`,
    )
  }

  async function syncParentTaskStatusFromTree(project_id) {
    const statusFixes = rollupParentTaskStatusInTree(bottomTaskTreeData.value)
    if (!statusFixes.length) return { statusFixes: [], failures: [] }
    const failures = []
    const results = await Promise.all(
      statusFixes.map((p) =>
        updateProjectTaskDetailFieldsAPI({
          project_id,
          task_id: p.task_id,
          task_status: p.task_status,
        }),
      ),
    )
    for (let i = 0; i < results.length; i += 1) {
      const res = results[i]
      if (res?.code !== 200) {
        failures.push({ patch: statusFixes[i], msg: res?.msg })
      }
    }
    applyTaskStatusPatchesToTaskList(projectTaskList, statusFixes)
    return { statusFixes, failures }
  }

  async function saveTaskDetailToServer(options = {}) {
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task' || taskDetailSaving.value || taskDetailLoading.value) return
    const taskId = resolveBottomTaskDbId(node)
    if (!Number.isFinite(taskId)) {
      ElMessage.warning('当前任务无数据库 ID，无法保存')
      return
    }
    const project_id = Number(node.project_id ?? addTaskProjectId.value)
    if (!Number.isFinite(project_id)) {
      ElMessage.warning('无法解析项目 ID')
      return
    }
    const currentTri = normalizeTaskTriStatus(node.status ?? node.task_status)
    const silentProgress = options.progressOnly === true

    if (silentProgress) taskDetailProgressSaveInFlight.value = true
    else taskDetailSaving.value = true
    try {
      const payload = buildTaskDetailUpdatePayload(node, project_id)
      const res = await updateProjectTaskDetailFieldsAPI(payload)
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || '保存任务失败')
        return
      }
      node.task_status = currentTri
      node.status = currentTri
      taskDetailStatusBaseline.value = currentTri
      setTaskDetailProgressBaseline(node)
      const rowOverride = buildTaskRowOverrideFromNode(node, payload)
      const selfPatch = rowOverride
        ? [
            {
              project_id,
              task_id: taskId,
              current_task_progress: rowOverride.current_task_progress,
            },
          ]
        : []
      if (selfPatch.length) {
        applyTaskProgressPatchesToTaskList(projectTaskList, selfPatch)
      }
      applyTaskStatusPatchesToTaskList(projectTaskList, [{ task_id: taskId, task_status: currentTri }])

      if (silentProgress) {
        const syncResult = await syncParentTaskProgressChain(taskId, project_id, {
          parentsOnly: true,
          reloadBefore: false,
          reloadAfter: false,
          rowOverrides: rowOverride ? [rowOverride] : null,
          quiet: true,
        })
        const allPatches = syncResult?.patches ?? []
        if (syncResult?.failures?.length) {
          warnParentProgressSyncFailures(syncResult.failures)
        }
        const ancestorPatches = allPatches.filter((p) => Number(p.task_id) !== taskId)
        if (ancestorPatches.length) {
          applyTaskProgressPatchesToTaskList(projectTaskList, ancestorPatches)
          applyTaskProgressPatchesToTreeRoots(bottomTaskTreeData.value, ancestorPatches)
          rollupTaskProgressPostOrderOnTree(bottomTaskTreeData.value)
        }
        if (options.statusChange === true) {
          const statusSync = await syncParentTaskStatusFromTree(project_id)
          if (statusSync.failures?.length) warnParentStatusSyncFailures(statusSync.failures)
        }
        return
      }

      const statusSync = await syncParentTaskStatusFromTree(project_id)
      if (statusSync.failures?.length) warnParentStatusSyncFailures(statusSync.failures)

      ElMessage.success('已保存')
      await syncParentTaskProgressChain(taskId, project_id, {
        parentsOnly: true,
        reloadBefore: true,
        reloadAfter: false,
        rowOverrides: rowOverride ? [rowOverride] : null,
        quiet: true,
      })
      await nextTick()
      rebindSelectedTaskFromTree(taskId)
    } catch (e) {
      const msg = e?.response?.data?.msg ?? e?.msg ?? e?.message
      ElMessage.error(msg || '保存任务失败')
    } finally {
      if (silentProgress) taskDetailProgressSaveInFlight.value = false
      else taskDetailSaving.value = false
    }
  }

  function onTaskDetailFormKeydown(e) {
    if (e.key !== 'Enter') return
    const node = selectedBottomNode.value
    if (!node || node.nodeType !== 'task') return
    if (taskDetailLoading.value || taskDetailSaving.value) return
    const t = e.target
    if (t?.closest?.('.main-bottom-right__comment-input')) return
    const descWrap = t?.closest?.('.main-bottom-right__field-task-desc')
    const descTa = descWrap?.querySelector?.('textarea')
    if (descTa && (t === descTa || descWrap?.contains(t))) {
      // 任务描述：Enter 换行；Ctrl/⌘ + Enter 保存
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        void saveTaskDetailToServer()
      }
      return
    }
    if ((t?.tagName || '').toUpperCase() === 'TEXTAREA') return
    e.preventDefault()
    void saveTaskDetailToServer()
  }

  const commentInputRef = ref(null)
  const taskCommentSubmitting = ref(false)
  const taskCommentDeleting = ref(false)
  const commentContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    comment: null,
  })
  const mentionVisible = ref(false)
  const mentionQuery = ref('')
  const mentionActiveIndex = ref(0)
  let mentionBlurHideTimer = null

  const mentionFilteredOptions = computed(() => {
    const q = mentionQuery.value
    const list = projectUserAuthorizeOptions.value
    if (!q) return list
    const lower = q.toLowerCase()
    return list.filter(
      (o) => o.label.includes(q) || o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower),
    )
  })

  const submitTaskComment = async () => {
    const node = selectedBottomNode.value
    const text = taskCommentDraft.value.trim()
    if (!node || node.nodeType !== 'task' || !text || taskCommentSubmitting.value) return

    const task_id = resolveBottomTaskDbId(node)
    const project_id = Number(node.project_id ?? selectedProjectId.value)
    const user_id = Number(userStore.userInfo?.id)
    if (!Number.isFinite(task_id)) {
      ElMessage.warning('当前任务无数据库 ID，无法发表评论')
      return
    }
    if (!Number.isFinite(project_id)) {
      ElMessage.warning('无法解析项目 ID')
      return
    }
    if (!Number.isFinite(user_id)) {
      ElMessage.warning('请先登录')
      return
    }

    const mentions = extractMentionFieldsFromCommentContent(text)
    taskCommentSubmitting.value = true
    try {
      const res = await createProjectTaskCommentAPI({
        task_id,
        project_id,
        user_id,
        content: text,
        ...mentions,
      })
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || '发表评论失败')
        return
      }
      taskCommentDraft.value = ''
      mentionVisible.value = false
      await loadTaskCommentsForNode(node)
    } catch (e) {
      ElMessage.error(e?.message || '发表评论失败')
    } finally {
      taskCommentSubmitting.value = false
    }
  }

  function getCommentTextarea() {
    const inst = commentInputRef.value
    if (!inst) return null
    return inst.textarea ?? inst.$refs?.textarea ?? inst.$el?.querySelector?.('textarea') ?? null
  }

  function registerCommentInput(inst) {
    commentInputRef.value = inst
  }

  function syncMentionPanel() {
    const ta = getCommentTextarea()
    if (!ta) {
      mentionVisible.value = false
      return
    }
    const caret = ta.selectionStart
    const state = getMentionState(taskCommentDraft.value, caret)
    if (!state) {
      mentionVisible.value = false
      return
    }
    mentionQuery.value = state.query
    mentionVisible.value = true
    mentionActiveIndex.value = 0
  }

  function onCommentUpdate(val) {
    taskCommentDraft.value = val
    nextTick(() => syncMentionPanel())
  }

  function scheduleHideMentionPanel() {
    clearTimeout(mentionBlurHideTimer)
    mentionBlurHideTimer = window.setTimeout(() => {
      mentionVisible.value = false
      mentionBlurHideTimer = null
    }, 180)
  }

  function cancelHideMentionPanel() {
    clearTimeout(mentionBlurHideTimer)
    mentionBlurHideTimer = null
  }

  function pickMention(opt) {
    cancelHideMentionPanel()
    const ta = getCommentTextarea()
    if (!ta || !opt) return
    const text = taskCommentDraft.value
    const caret = ta.selectionStart
    const state = getMentionState(text, caret)
    if (!state) return
    const insertText = `@${opt.label} `
    const before = text.slice(0, state.start)
    const after = text.slice(caret)
    taskCommentDraft.value = before + insertText + after
    mentionVisible.value = false
    nextTick(() => {
      ta.focus()
      const pos = before.length + insertText.length
      ta.setSelectionRange(pos, pos)
    })
  }

  function onCommentCaretMove() {
    nextTick(() => syncMentionPanel())
  }

  function canDeleteTaskComment(comment) {
    if (!comment?.id) return false
    const me = Number(userStore.userInfo?.id)
    const author = Number(comment.user_id)
    return Number.isFinite(me) && Number.isFinite(author) && me === author
  }

  function closeCommentContextMenu() {
    commentContextMenu.visible = false
    commentContextMenu.comment = null
  }

  function onCommentContextMenu(e, comment) {
    if (!canDeleteTaskComment(comment)) return
    e.preventDefault()
    commentContextMenu.visible = true
    commentContextMenu.x = e.clientX
    commentContextMenu.y = e.clientY
    commentContextMenu.comment = comment
  }

  async function deleteTaskCommentFromContextMenu() {
    const c = commentContextMenu.comment
    const node = selectedBottomNode.value
    closeCommentContextMenu()
    if (!c?.id || !node || node.nodeType !== 'task' || taskCommentDeleting.value) return

    const user_id = Number(userStore.userInfo?.id)
    if (!Number.isFinite(user_id)) {
      ElMessage.warning('请先登录')
      return
    }

    try {
      await ElMessageBox.confirm('确定删除这条评论吗？', '删除评论', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }

    taskCommentDeleting.value = true
    try {
      const res = await deleteProjectTaskCommentAPI({
        comment_id: Number(c.id),
        user_id,
      })
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || '删除评论失败')
        return
      }
      ElMessage.success('已删除')
      await loadTaskCommentsForNode(node)
    } catch (e) {
      ElMessage.error(e?.message || '删除评论失败')
    } finally {
      taskCommentDeleting.value = false
    }
  }

  function onCommentKeydown(e) {
    const ta = getCommentTextarea()
    const caret = ta?.selectionStart ?? 0
    const state = getMentionState(taskCommentDraft.value, caret)
    const list = mentionFilteredOptions.value

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void submitTaskComment()
      return
    }

    if (state && mentionVisible.value) {
      if (list.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          mentionActiveIndex.value = (mentionActiveIndex.value + 1) % list.length
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          mentionActiveIndex.value = (mentionActiveIndex.value - 1 + list.length) % list.length
          return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          pickMention(list[mentionActiveIndex.value])
          return
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        mentionVisible.value = false
        return
      }
    }
  }

  return {
    selectedBottomNode,
    selectedTreeNodeKey,
    bottomRightStructureStats,
    selectedProcessPhaseCount,
    projectUserAuthorizeOptions,
    taskDetailLoading,
    taskDetailSaving,
    taskCommentDraft,
    taskCommentSubmitting,
    taskCommentDeleting,
    commentContextMenu,
    mentionVisible,
    mentionFilteredOptions,
    mentionActiveIndex,
    formatDateTime,
    normalizeTaskTriStatus,
    countDescendantTasks,
    onBottomTreeNodeClick,
    reselectTaskByDbId,
    rebindSelectedTaskFromTree,
    syncTaskProgressRollupBatch,
    tryRestorePersistedSelection,
    onTaskAssigneeSelectChange,
    onTaskCurrentTaskProgressChange,
    syncParentTaskProgressChain,
    taskProgressEditable,
    taskProgressHint,
    onTaskPlannedStartDateChange,
    onTaskPlannedEndDateChange,
    onTaskCollaboratorsChange,
    onTaskExecutionStatusChange,
    isTaskDetailDayDisabledForPicker,
    getTaskDetailDisabledHoursForPicker,
    getTaskDetailDisabledMinutesForPicker,
    getTaskDetailDisabledSecondsForPicker,
    onTaskDetailFormKeydown,
    onCommentUpdate,
    onCommentKeydown,
    scheduleHideMentionPanel,
    onCommentCaretMove,
    pickMention,
    submitTaskComment,
    registerCommentInput,
    canDeleteTaskComment,
    onCommentContextMenu,
    closeCommentContextMenu,
    deleteTaskCommentFromContextMenu,
  }
}
