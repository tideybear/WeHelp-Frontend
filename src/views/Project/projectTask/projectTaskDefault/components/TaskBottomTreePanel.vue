<script setup>
import {
  collectTreePathKeysToTask,
  ensureTreeNodeKeys,
  findTaskNodeInTreeRoots,
} from '../composables/taskBottomRightHelpers'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computeTaskDropPayload, taskStatusTagType } from '../composables/useProjectTaskTree'
import { parseProjectProcessesField } from '../composables/parseProjectProcessesField'
import {
  collectTaskDbIdsInTree,
  countDescendantTasks,
  patchTaskFieldsFromMergedTree,
  removeTaskNodesByDbIds,
  resolveBottomTaskDbId,
} from '../composables/taskBottomRightHelpers'

defineOptions({ name: 'TaskBottomTreePanel' })

const treeData = defineModel('treeData', {
  type: Array,
  default: () => [],
})

const props = defineProps({
  /** getProjectDetailAPI 返回的 `processes`：数组，或 JSON 数组字符串；每一项为树根，子级沿用 `children` */
  processes: {
    type: [Array, String, null],
    default: null,
  },
  categoryName: {
    type: String,
    default: '',
  },
  emptyDescription: {
    type: String,
    default: '',
  },
  currentNodeKey: {
    type: [String, Number],
    default: null,
  },
  /** 从详情页跳入时需展开并滚动的任务 id */
  pendingFocusTaskDbId: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits([
  'node-click',
  'add',
  'task-reparent',
  'parent-task-time-fixes',
  'task-delete',
  'tree-task-focused',
])

const treeRef = ref(null)
const expandedKeys = ref([])
/** 跳转定位时强制 remount，使 default-expanded-keys 在数据重建后生效 */
const treeMountKey = ref(0)

function ancestorKeysForTask(roots, taskDbId) {
  const pathKeys = collectTreePathKeysToTask(roots, taskDbId)
  if (!pathKeys || pathKeys.length <= 1) return []
  return pathKeys.slice(0, -1)
}

function isPendingFocusTask(taskDbId) {
  const pending = Number(props.pendingFocusTaskDbId)
  const tid = Number(taskDbId)
  return Number.isFinite(pending) && pending > 0 && pending === tid
}

/** 展开到指定任务并滚动到可视区域（带重试，避免树刚重建时 getNode 未就绪） */
async function expandToTaskDbId(taskDbId, attempt = 0) {
  const tid = Number(taskDbId)
  if (!Number.isFinite(tid) || tid <= 0) return false
  const roots = treeData.value
  if (!Array.isArray(roots) || !roots.length) return false
  if (!findTaskNodeInTreeRoots(roots, tid)) return false

  const pathKeys = collectTreePathKeysToTask(roots, tid)
  if (!pathKeys?.length) return false

  const ancestors = pathKeys.slice(0, -1)
  const leafKey = pathKeys[pathKeys.length - 1]
  const needRemount = ancestors.length > 0 && isPendingFocusTask(tid) && attempt === 0

  if (ancestors.length) {
    expandedKeys.value = [...ancestors]
    if (needRemount) {
      treeMountKey.value += 1
      await nextTick()
      await nextTick()
    }
  }

  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(resolve))

  const tree = treeRef.value
  if (!tree) {
    if (attempt < 16) {
      await new Promise((r) => setTimeout(r, 50))
      return expandToTaskDbId(taskDbId, attempt + 1)
    }
    return false
  }

  let expandedCount = 0
  for (const key of ancestors) {
    const node = tree.getNode(key)
    if (node) {
      if (!node.expanded) node.expand()
      expandedCount += 1
    }
  }

  if (ancestors.length && expandedCount < ancestors.length && attempt < 16) {
    await new Promise((r) => setTimeout(r, 50))
    return expandToTaskDbId(taskDbId, attempt + 1)
  }

  tree.setCurrentKey(leafKey)
  await nextTick()
  const rootEl = tree.$el
  const currentEl = rootEl?.querySelector?.('.el-tree-node.is-current')
  currentEl?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  return expandedCount >= ancestors.length || !ancestors.length
}

async function tryApplyPendingFocusTask() {
  const tid = Number(props.pendingFocusTaskDbId)
  if (!Number.isFinite(tid) || tid <= 0) return
  if (!Array.isArray(treeData.value) || !treeData.value.length) return
  if (!findTaskNodeInTreeRoots(treeData.value, tid)) return

  await expandToTaskDbId(tid)
  emit('tree-task-focused', tid)
}

defineExpose({ expandToTaskDbId, tryApplyPendingFocusTask })

const taskContextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  data: null,
})

function closeTaskContextMenu() {
  taskContextMenu.value.visible = false
  taskContextMenu.value.data = null
}

function isTaskTreeNode(data) {
  if (!data || typeof data !== 'object') return false
  if (data.nodeType === 'task') return true
  return resolveBottomTaskDbId(data) != null
}

function onTreeNodeContextMenu(e, data) {
  if (!isTaskTreeNode(data)) return
  e.preventDefault()
  closeTaskContextMenu()
  taskContextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    data,
  }
}

function onContextMenuDelete() {
  const data = taskContextMenu.value.data
  closeTaskContextMenu()
  onTaskDeleteCommand(data)
}

function onTaskDeleteCommand(data) {
  if (!isTaskTreeNode(data)) return
  const taskId = resolveBottomTaskDbId(data)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    ElMessage.warning('无法识别任务 ID，无法删除')
    return
  }
  const childCount = countDescendantTasks(data.children)
  emit('task-delete', { taskId, taskName: nodeText(data), childCount })
}

function onDocumentKeydown(e) {
  if (e.key === 'Escape' && taskContextMenu.value.visible) closeTaskContextMenu()
}

function onDocumentScrollDismiss() {
  if (taskContextMenu.value.visible) closeTaskContextMenu()
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('scroll', onDocumentScrollDismiss, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('scroll', onDocumentScrollDismiss, true)
})

/** 仅允许拖动任务节点，避免拖动流程结构 */
function bottomTreeAllowDrag(node) {
  return node?.data?.nodeType === 'task'
}

function onTreeNodeDrop(draggingNode, dropNode, dropType) {
  const payload = computeTaskDropPayload(treeData.value, draggingNode, dropNode, dropType)
  if (payload) emit('task-reparent', payload)
}

/** 禁止拖到根结点「外侧」：非根节点不能用 prev/next 与第一层节点换位（变成顶层） */
function bottomTreeAllowDrop(draggingNode, dropNode, type) {
  if (!draggingNode || !dropNode) return false
  const dLevel = dropNode.level
  const gLevel = draggingNode.level
  if ((type === 'prev' || type === 'next') && dLevel === 1 && gLevel > 1) {
    return false
  }
  return true
}

function cloneRoots(roots) {
  try {
    return JSON.parse(JSON.stringify(roots))
  } catch {
    return []
  }
}

function parsePlannedToMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : null
}

function taskNodeStartMs(data) {
  const a = parsePlannedToMs(data?.actual_start_date)
  if (a != null) return a
  const p = parsePlannedToMs(data?.planned_start_date)
  if (p != null) return p
  const s = data?.startAt
  return typeof s === 'number' && Number.isFinite(s) ? s : null
}

function taskNodeEndMs(data) {
  const a = parsePlannedToMs(data?.actual_end_date)
  if (a != null) return a
  const p = parsePlannedToMs(data?.planned_end_date)
  if (p != null) return p
  const e = data?.endAt
  return typeof e === 'number' && Number.isFinite(e) ? e : null
}

function toLocalYmd(ms) {
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 业务仅三种：未开始 / 进行中 / 已完成；接口旧值待执行、空等归一为未开始 */
function normalizeTaskTriStatus(raw) {
  const t = String(raw ?? '').trim()
  if (t === '进行中') return '进行中'
  if (t === '已完成' || t === '已结束') return '已完成'
  if (t === '未开始' || t === '待执行' || t === '') return '未开始'
  return '未开始'
}

/** 由子任务（已归一为三态）推导父任务状态：全未开始→未开始；全已完成→已完成；其余（含全进行中、混合）→进行中 */
function derivedParentStatusFromChildTriStatuses(statuses) {
  if (!statuses.length) return null
  if (statuses.every((s) => s === '未开始')) return '未开始'
  if (statuses.every((s) => s === '已完成')) return '已完成'
  return '进行中'
}

/** 当前任务节点下所有子孙任务（不含自身）的最早开始、最晚结束（毫秒） */
function descendantTaskTimesMinMax(node) {
  let minS = null
  let maxE = null
  function walk(children) {
    if (!Array.isArray(children)) return
    for (const c of children) {
      if (c?.nodeType === 'task') {
        const s = taskNodeStartMs(c)
        const e = taskNodeEndMs(c)
        if (s != null) minS = minS == null ? s : Math.min(minS, s)
        if (e != null) maxE = maxE == null ? e : Math.max(maxE, e)
        walk(c.children)
      } else {
        walk(c?.children)
      }
    }
  }
  walk(node.children)
  return { minS, maxE }
}

/**
 * 后序遍历：若有子任务时间超出父任务范围，则将父任务起止扩展为子孙中最早开始 / 最晚结束（计划+实际字段与树上一致）；
 * 直接子任务的 task_status/status 按三态汇总；与库不一致时产出补丁供写库。
 * @returns {{ task_id: number, planned_start_date?: string, planned_end_date?: string, actual_start_date?: string, actual_end_date?: string, task_status?: string }[]}
 */
function applyParentTaskRollupFromChildren(roots) {
  const patchMap = new Map()

  function mergeTaskPatch(tid, partial) {
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

    const taskKidsDirect = Array.isArray(node.children) ? node.children.filter((c) => c?.nodeType === 'task') : []
    const { minS, maxE } = descendantTaskTimesMinMax(node)

    if (!taskKidsDirect.length && minS == null && maxE == null) return

    const pS = taskNodeStartMs(node)
    const pE = taskNodeEndMs(node)
    const tid = resolveBottomTaskDbId(node)

    if (Number.isFinite(tid) && tid > 0) {
      if (minS != null && (pS == null || minS < pS)) {
        const ys = toLocalYmd(minS)
        node.startAt = minS
        node.planned_start_date = ys
        node.actual_start_date = ys
        mergeTaskPatch(tid, { planned_start_date: ys, actual_start_date: ys })
      }
      if (maxE != null && (pE == null || maxE > pE)) {
        const ye = toLocalYmd(maxE)
        node.endAt = maxE
        node.planned_end_date = ye
        node.actual_end_date = ye
        mergeTaskPatch(tid, { planned_end_date: ye, actual_end_date: ye })
      }
    }

    const prevStatusTri = normalizeTaskTriStatus(node.task_status ?? node.status)
    if (taskKidsDirect.length) {
      const childTri = taskKidsDirect.map((c) => normalizeTaskTriStatus(c.task_status ?? c.status))
      const derived = derivedParentStatusFromChildTriStatuses(childTri)
      if (derived) {
        node.task_status = derived
        node.status = derived
        if (derived !== prevStatusTri && Number.isFinite(tid) && tid > 0) {
          mergeTaskPatch(tid, { task_status: derived })
        }
      }
    }
  }
  if (!Array.isArray(roots)) return []
  for (const r of roots) postOrder(r)
  return [...patchMap.values()]
}

function displayTaskStatus(data) {
  if (data == null || typeof data !== 'object') return '—'
  return normalizeTaskTriStatus(data.task_status ?? data.status)
}

function syncTreeFromProcesses(raw) {
  const roots = parseProjectProcessesField(raw)
  const prevIds = collectTaskDbIdsInTree(treeData.value)
  const nextIds = collectTaskDbIdsInTree(roots)
  const removed = [...prevIds].filter((id) => !nextIds.has(id))
  const added = [...nextIds].filter((id) => !prevIds.has(id))
  const onlyTaskRemoval =
    removed.length > 0 && added.length === 0 && treeData.value.length > 0
  const sameTaskSet =
    removed.length === 0 &&
    added.length === 0 &&
    treeData.value.length > 0 &&
    prevIds.size > 0 &&
    prevIds.size === nextIds.size &&
    [...prevIds].every((id) => nextIds.has(id))

  if (sameTaskSet) {
    patchTaskFieldsFromMergedTree(treeData.value, roots)
    const fixes = applyParentTaskRollupFromChildren(treeData.value)
    if (fixes.length) emit('parent-task-time-fixes', fixes)
    void tryApplyPendingFocusTask()
    return
  }

  let nextTree
  if (onlyTaskRemoval) {
    nextTree = removeTaskNodesByDbIds(treeData.value, removed)
  } else {
    nextTree = cloneRoots(roots)
  }
  ensureTreeNodeKeys(nextTree)
  const fixes = applyParentTaskRollupFromChildren(nextTree)
  const focusTid = Number(props.pendingFocusTaskDbId)
  if (Number.isFinite(focusTid) && focusTid > 0) {
    expandedKeys.value = ancestorKeysForTask(nextTree, focusTid)
  }
  treeData.value = nextTree
  if (fixes.length) emit('parent-task-time-fixes', fixes)
  void tryApplyPendingFocusTask()
}

watch(
  () => props.processes,
  (raw) => {
    syncTreeFromProcesses(raw)
    void tryApplyPendingFocusTask()
  },
  { immediate: true },
)

watch(
  () => props.pendingFocusTaskDbId,
  () => {
    void tryApplyPendingFocusTask()
  },
)

watch(
  () => treeData.value,
  () => {
    if (props.pendingFocusTaskDbId != null && props.pendingFocusTaskDbId !== '') {
      void tryApplyPendingFocusTask()
    }
  },
)

function nodeText(data) {
  if (data == null) return '—'
  if (typeof data !== 'object') return String(data)
  const keys = [
    'process_name',
    'processName',
    'label',
    'name',
    'step_name',
    'stepName',
    'title',
    'text',
    'value',
    'task_name',
    'taskName',
  ]
  for (const k of keys) {
    const v = data[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return '—'
}
</script>

<template>
  <div class="task-bottom-tree-panel project-task-main project-task-page__main-bottom-left">
    <div class="task-bottom-tree-panel__head main-bottom-left__head">
      <div class="main-bottom-left__title-row">
        <span class="main-bottom-left__title">任务列表</span>
        <span v-if="categoryName" class="main-bottom-left__badge">{{ categoryName }}</span>
      </div>
      <el-button
        v-if="treeData.length"
        type="primary"
        link
        size="small"
        class="main-bottom-left__add-btn"
        title="添加任务"
        :icon="Plus"
        @click="emit('add')"
      />
    </div>
    <div class="main-bottom-left__scroll">
      <el-tree
        v-if="treeData.length"
        :key="treeMountKey"
        ref="treeRef"
        class="main-bottom-tree"
        :data="treeData"
        node-key="id"
        :default-expanded-keys="expandedKeys"
        :props="{ label: 'process_name', children: 'children' }"
        :current-node-key="currentNodeKey"
        highlight-current
        :expand-on-click-node="false"
        @node-click="(data) => emit('node-click', data)"
        @node-contextmenu="onTreeNodeContextMenu"
        draggable
        :allow-drag="bottomTreeAllowDrag"
        :allow-drop="bottomTreeAllowDrop"
        @node-drop="onTreeNodeDrop"
      >
        <template #default="{ data }">
          <span
            v-if="isTaskTreeNode(data)"
            class="main-bottom-tree__row main-bottom-tree__row--task"
          >
            <span class="main-bottom-tree__label" :title="nodeText(data)">
              {{ nodeText(data) }}
            </span>
            <el-tag
              class="main-bottom-tree__status-tag"
              size="small"
              :type="taskStatusTagType(displayTaskStatus(data))"
              disable-transitions
            >
              {{ displayTaskStatus(data) }}
            </el-tag>
          </span>
          <span v-else class="main-bottom-tree__row">
            <span class="main-bottom-tree__label" :title="nodeText(data)">
              {{ nodeText(data) }}
            </span>
          </span>
        </template>
      </el-tree>
      <el-empty v-else class="main-bottom-left__empty" :description="emptyDescription" :image-size="72" />
    </div>

    <Teleport to="body">
      <div
        v-if="taskContextMenu.visible"
        class="task-tree-context-menu__backdrop"
        @mousedown="closeTaskContextMenu"
        @click="closeTaskContextMenu"
        @contextmenu.prevent="closeTaskContextMenu"
        @wheel="closeTaskContextMenu"
      />
      <ul
        v-if="taskContextMenu.visible"
        class="task-tree-context-menu"
        :style="{ left: `${taskContextMenu.x}px`, top: `${taskContextMenu.y}px` }"
        @mousedown.stop
        @click.stop
        @contextmenu.stop.prevent
      >
        <li class="task-tree-context-menu__item" @mousedown.stop @click="onContextMenuDelete">删除</li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.task-bottom-tree-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-bottom-tree-panel__head {
  flex-shrink: 0;
  margin-bottom: 10px;
}

.main-bottom-left__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.main-bottom-left__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.main-bottom-left__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.main-bottom-left__badge {
  flex-shrink: 0;
  padding: 0 8px;
  height: 22px;
  line-height: 22px;
  font-size: 12px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.main-bottom-left__add-btn {
  flex-shrink: 0;
}

.main-bottom-left__scroll {
  flex: 1 1 0%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.main-bottom-left__empty {
  padding: 24px 8px;
}

.main-bottom-tree {
  width: 100%;
  min-width: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 14px;

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 32px;
    padding: 4px 0;
    border-radius: 6px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  :deep(.el-tree-node__expand-icon) {
    flex-shrink: 0;
  }
}

.main-bottom-tree__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  width: 100%;
}

.main-bottom-tree__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.main-bottom-tree__status-tag {
  flex-shrink: 0;
  max-width: 8em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.main-bottom-tree__row--task {
  cursor: context-menu;
}
</style>

<style lang="scss">
.task-tree-context-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 2999;
  background: transparent;
}

.task-tree-context-menu {
  position: fixed;
  z-index: 3000;
  margin: 0;
  padding: 5px 0;
  min-width: 120px;
  list-style: none;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
}

.task-tree-context-menu__item {
  padding: 5px 16px;
  font-size: 14px;
  line-height: 22px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-color-danger);
  }
}
</style>
