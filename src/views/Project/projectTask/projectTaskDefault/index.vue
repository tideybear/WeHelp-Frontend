<script setup>
import { computed, nextTick, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import TaskProjectSidebar from './components/TaskProjectSidebar.vue'
import TaskProjectGantt from './components/TaskProjectGantt.vue'
import TaskBottomTreePanel from './components/TaskBottomTreePanel.vue'
import TaskBottomDetailPanel from './components/TaskBottomDetailPanel.vue'
import TaskAddPositionDialog from './components/TaskAddPositionDialog.vue'
import { useProjectTaskWorkspace } from './composables/useProjectTaskWorkspace'
import { useTaskBottomRightDetail } from './composables/useTaskBottomRightDetail'
import { TASK_BOTTOM_DETAIL_CONTEXT_KEY } from './composables/taskBottomDetailInjectionKey'
import {
  readPersistedTaskTreeSelection,
  writePersistedTaskTreeSelection,
  clearPersistedTaskTreeSelection,
} from './composables/useTaskTreeSelectionPersist'
import {
  resolveBottomTaskDbId,
  collectAncestorTaskIdsFromRows,
} from './composables/taskBottomRightHelpers'
import {
  updateProjectTaskDetailFieldsAPI,
  updateProjectTaskHierarchyAPI,
  deleteProjectTaskAPI,
} from '@/apis/project'

const route = useRoute()
const persistedInit = readPersistedTaskTreeSelection()

function projectIdFromRouteQuery() {
  const raw = route.query.projectId
  if (raw == null || raw === '') return null
  return String(raw)
}

function taskIdFromRouteQuery() {
  const raw = route.query.taskId
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

const selectedProjectId = ref(projectIdFromRouteQuery() ?? persistedInit?.projectId ?? null)
const selectedProject = ref(null)
const restoredPersistedTaskOnce = ref(false)
const pendingFocusTaskId = ref(taskIdFromRouteQuery())
const bottomTreePanelRef = ref(null)

const {
  projectUserAuthorizeOptions,
  projectTaskList,
  projectDetailCategoryName,
  projectDetailCategoryId,
  projectPlannedStartDate,
  projectPlannedEndDate,
  mergedProcessTaskTree,
  loadProjectDetailAndTasks,
  reloadProjectTasksOnly,
  removeTasksFromList,
} = useProjectTaskWorkspace(selectedProjectId)

const addTaskProjectId = computed(() => {
  const raw = selectedProjectId.value
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

const bottomTreeEmptyText = computed(() => {
  if (!selectedProject.value) return '请先选择项目'
  return '当前项目详情中无 processes 步骤数据'
})

function onTaskSidebarSelectedProject(row) {
  selectedProject.value = row
}

const bottomTaskTreeData = ref([])

async function onTaskCreated(payload) {
  await loadProjectDetailAndTasks()
  const taskId = Number(payload?.taskId)
  const project_id = Number(payload?.project_id ?? addTaskProjectId.value)
  if (!Number.isFinite(taskId) || !Number.isFinite(project_id)) return
  await br.syncParentTaskProgressChain(taskId, project_id, { reloadBefore: false })
  await nextTick()
  br.reselectTaskByDbId(taskId, { forceFetch: true })
}

const br = useTaskBottomRightDetail({
  bottomTaskTreeData,
  projectPlannedStartDate,
  projectPlannedEndDate,
  projectUserAuthorizeOptions,
  projectTaskList,
  selectedProjectId,
  addTaskProjectId,
  reloadProjectTasksOnly,
})

provide(TASK_BOTTOM_DETAIL_CONTEXT_KEY, {
  ...br,
  projectDetailCategoryName,
  selectedProjectId,
})

const { onBottomTreeNodeClick, selectedTreeNodeKey, tryRestorePersistedSelection } = br

async function onTreeTaskFocused(taskId) {
  const tid = Number(taskId)
  const pid = selectedProjectId.value
  if (!Number.isFinite(tid) || pid == null || pid === '') return

  await nextTick()
  await bottomTreePanelRef.value?.expandToTaskDbId?.(tid)
  await nextTick()
  const ok = br.reselectTaskByDbId(tid, { forceFetch: true })
  if (ok) {
    await bottomTreePanelRef.value?.expandToTaskDbId?.(tid)
    writePersistedTaskTreeSelection(pid, tid)
    pendingFocusTaskId.value = null
    restoredPersistedTaskOnce.value = true
  }
}

watch(
  [bottomTaskTreeData, pendingFocusTaskId, () => mergedProcessTaskTree.value?.length],
  async ([tree, focusTid]) => {
    if (focusTid == null || !Array.isArray(tree) || !tree.length) return
    await nextTick()
    await bottomTreePanelRef.value?.tryApplyPendingFocusTask?.()
  },
)

/** 路由带 taskId 时兜底展开（含 pending 被误清、仅 session 恢复选中的情况） */
watch(
  () => [route.query.taskId, bottomTaskTreeData.value?.length],
  async () => {
    const tid = taskIdFromRouteQuery()
    if (tid == null) return
    if (!Array.isArray(bottomTaskTreeData.value) || !bottomTaskTreeData.value.length) return
    await nextTick()
    await bottomTreePanelRef.value?.expandToTaskDbId?.(tid)
  },
  { flush: 'post' },
)

watch(
  () => [route.query.projectId, route.query.taskId],
  () => {
    const qPid = projectIdFromRouteQuery()
    const qTid = taskIdFromRouteQuery()
    if (qPid != null) selectedProjectId.value = qPid
    if (qTid != null) {
      pendingFocusTaskId.value = qTid
      restoredPersistedTaskOnce.value = false
    }
  },
)

watch(
  [selectedProjectId, pendingFocusTaskId],
  async ([pid, focusTid]) => {
    if (pid == null || pid === '' || focusTid != null) return
    if (restoredPersistedTaskOnce.value) return
    if (!Array.isArray(bottomTaskTreeData.value) || !bottomTaskTreeData.value.length) return
    const ok = await tryRestorePersistedSelection(pid)
    if (ok) {
      const saved = readPersistedTaskTreeSelection()
      if (saved?.taskDbId != null) {
        await nextTick()
        await bottomTreePanelRef.value?.expandToTaskDbId?.(saved.taskDbId)
      }
      restoredPersistedTaskOnce.value = true
    }
  },
)

watch(selectedProjectId, (pid, prev) => {
  if (prev != null && String(pid) !== String(prev)) {
    restoredPersistedTaskOnce.value = false
    if (taskIdFromRouteQuery() == null) {
      pendingFocusTaskId.value = null
    }
  }
})

let parentTaskTreeFixInFlight = false

async function onParentTaskTimeFixes(patches) {
  if (!Array.isArray(patches) || !patches.length || parentTaskTreeFixInFlight) return
  const project_id = Number(selectedProjectId.value)
  if (!Number.isFinite(project_id)) return
  parentTaskTreeFixInFlight = true
  try {
    await Promise.all(
      patches.map((p) => {
        const { task_id, ...rest } = p
        return updateProjectTaskDetailFieldsAPI({
          project_id,
          task_id,
          ...rest,
        })
      }),
    )
    await reloadProjectTasksOnly()
    const fixTaskIds = [
      ...new Set(
        patches
          .map((p) => Number(p?.task_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ]
    if (fixTaskIds.length) {
      await br.syncTaskProgressRollupBatch(fixTaskIds, project_id, { reloadBefore: false })
    }
    await nextTick()
    const tid = resolveBottomTaskDbId(br.selectedBottomNode.value)
    if (tid != null) br.rebindSelectedTaskFromTree(tid)
  } catch (e) {
    ElMessage.error(e?.message ?? '任务树与数据库同步失败')
  } finally {
    parentTaskTreeFixInFlight = false
  }
}

function resolveDeleteTaskError(e) {
  const status = e?.response?.status
  if (status === 404) {
    return '删除接口未找到，请在 backend 目录重启后端：python3 main.py'
  }
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error') {
    return '无法连接后端，请确认已启动 python3 main.py（端口 5001）'
  }
  return e?.response?.data?.msg ?? e?.message ?? '删除失败'
}

async function onBottomTreeTaskDelete({ taskId, taskName, childCount = 0 }) {
  const raw = selectedProjectId.value
  if (raw == null || raw === '') {
    ElMessage.warning('请先选择项目')
    return
  }
  const project_id = Number(raw)
  if (!Number.isFinite(project_id)) return
  const tid = Number(taskId)
  if (!Number.isFinite(tid) || tid <= 0) {
    ElMessage.warning('无法识别任务 ID')
    return
  }
  const label = String(taskName ?? '').trim() || `任务 #${tid}`
  const nChild = Number(childCount)
  const confirmMsg =
    Number.isFinite(nChild) && nChild > 0
      ? `确认删除任务「${label}」及其 ${nChild} 个子任务？删除后任务列表中将不再显示。`
      : `确认删除任务「${label}」？删除后任务列表中将不再显示。`
  try {
    await ElMessageBox.confirm(confirmMsg, '删除任务', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    ElMessage.info('已取消删除')
    return
  }
  try {
    const res = await deleteProjectTaskAPI({ project_id, task_id: tid })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除失败')
      return
    }
    const deletedIds = Array.isArray(res?.data?.deleted_ids) ? res.data.deleted_ids.map(Number) : [tid]
    const rowsBeforeDelete = [...(projectTaskList.value || [])]
    const parentIdsToSync = collectAncestorTaskIdsFromRows(rowsBeforeDelete, deletedIds)
    removeTasksFromList(deletedIds)
    await reloadProjectTasksOnly()
    if (parentIdsToSync.length) {
      await br.syncTaskProgressRollupBatch(parentIdsToSync, project_id, { reloadBefore: false })
    }
    ElMessage.success(
      deletedIds.length > 1 ? `已删除 ${deletedIds.length} 个任务` : res?.msg || '已删除',
    )
    const cur = resolveBottomTaskDbId(br.selectedBottomNode.value)
    if (cur != null && deletedIds.includes(cur)) {
      br.selectedBottomNode.value = null
      br.selectedTreeNodeKey.value = null
      clearPersistedTaskTreeSelection()
    }
  } catch (e) {
    ElMessage.error(resolveDeleteTaskError(e))
  }
}

async function onBottomTreeTaskReparent(payload) {
  const raw = selectedProjectId.value
  if (raw == null || raw === '' || !payload) return
  const project_id = Number(raw)
  if (!Number.isFinite(project_id)) return
  const tid = Number(payload.taskId)
  const rowsBefore = projectTaskList.value || []
  const oldRow = rowsBefore.find((r) => Number(r?.id ?? r?.task_id) === tid)
  const oldParentId = oldRow?.parent_task_id ?? oldRow?.parentTaskId
  try {
    const res = await updateProjectTaskHierarchyAPI({
      project_id,
      task_id: payload.taskId,
      parent_task_id: payload.parent_task_id,
      processes_id: payload.processes_id,
      sibling_sort_orders: payload.sibling_sort_orders,
    })
    if (res?.code === 200) {
      ElMessage.success(payload.reorder_among_siblings ? '排序已保存' : '任务已保存')
      await reloadProjectTasksOnly()
      const syncIds = [
        tid,
        oldParentId,
        payload.parent_task_id,
      ]
        .map((x) => Number(x))
        .filter((id) => Number.isFinite(id) && id > 0)
      if (syncIds.length) {
        await br.syncTaskProgressRollupBatch([...new Set(syncIds)], project_id, {
          reloadBefore: false,
        })
      }
      await nextTick()
      if (Number.isFinite(tid)) br.reselectTaskByDbId(tid)
      return
    }
    ElMessage.error(res?.msg || '保存任务失败')
  } catch (e) {
    ElMessage.error(e?.message || '保存任务失败')
  }
}

const addTaskDialogVisible = ref(false)

function openAddTaskDialog() {
  addTaskDialogVisible.value = true
}
</script>

<template>
  <div class="project-task-page">
    <el-row class="project-task-page__row" :gutter="12">
      <el-col :span="4" class="project-task-page__col">
        <TaskProjectSidebar
          v-model:selected-project-id="selectedProjectId"
          @update:selected-project="onTaskSidebarSelectedProject"
        />
      </el-col>
      <el-col :span="20" class="project-task-page__col project-task-page__col--main">
        <TaskProjectGantt :project-id="selectedProjectId" />
        <el-row class="project-task-page__main-row project-task-page__main-row--rest" :gutter="12">
          <el-col :span="12" class="project-task-page__main-col">
            <TaskBottomTreePanel
              ref="bottomTreePanelRef"
              v-model:tree-data="bottomTaskTreeData"
              :processes="mergedProcessTaskTree"
              :category-name="projectDetailCategoryName"
              :empty-description="bottomTreeEmptyText"
              :current-node-key="selectedTreeNodeKey"
              :pending-focus-task-db-id="pendingFocusTaskId"
              @tree-task-focused="onTreeTaskFocused"
              @node-click="onBottomTreeNodeClick"
              @task-reparent="onBottomTreeTaskReparent"
              @task-delete="onBottomTreeTaskDelete"
              @parent-task-time-fixes="onParentTaskTimeFixes"
              @add="openAddTaskDialog"
            />
          </el-col>
          <el-col :span="12" class="project-task-page__main-col">
            <TaskBottomDetailPanel class="task-bottom-detail-panel" />
          </el-col>
        </el-row>
      </el-col>
    </el-row>

    <TaskAddPositionDialog
      v-model:visible="addTaskDialogVisible"
      :tree-data="bottomTaskTreeData"
      :project-id="addTaskProjectId"
      :project-category-id="projectDetailCategoryId"
      :project-planned-start-date="projectPlannedStartDate"
      :project-planned-end-date="projectPlannedEndDate"
      :assignee-options="projectUserAuthorizeOptions"
      @task-created="onTaskCreated"
    />
  </div>
</template>

<style scoped lang="scss">
/* 与 Layout 一致：顶栏 60px + el-main 上下 padding 各 20px */
$project-task-viewport-offset: 100px;

.project-task-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* 固定可视高度，便于子项 flex + min-height:0 产生内部滚动 */
  height: calc(100vh - #{$project-task-viewport-offset});
  max-height: calc(100vh - #{$project-task-viewport-offset});
  min-height: 0;
  overflow: hidden;
}

.project-task-page__row {
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.project-task-page__col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 列撑满行高，子元素 height:100% / el-scrollbar 百分比高度才能解析 */
  height: 100%;
  align-self: stretch;
}

.project-task-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

/* 主列：上下两段：甘特约占 40%，下方任务树 + 详情（列布局继承 .project-task-page__col） */
.project-task-page__col--main {
  min-height: 0;
  gap: 12px;
}

.project-task-page__main-row {
  width: 100%;
  margin: 0 !important;
  align-items: stretch;
}

.project-task-page__main-row--rest {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

/* el-row 默认为横向 flex，子块需占满行高 */
.project-task-page__main-row .project-task-main {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.project-task-page__main-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.project-task-page__main-col > .task-bottom-tree-panel {
  flex: 1;
  min-height: 0;
  width: 100%;
  align-self: stretch;
}

.project-task-page__main-col > .task-bottom-detail-panel {
  flex: 1;
  min-height: 0;
  width: 100%;
  align-self: stretch;
}
</style>
