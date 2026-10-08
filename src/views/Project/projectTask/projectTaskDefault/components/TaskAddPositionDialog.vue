<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { resolveAddTaskContext } from '../composables/useProjectTaskTree'
import { createProjectTaskAPI } from '@/apis/project'

defineOptions({ name: 'TaskAddPositionDialog' })

const visible = defineModel('visible', {
  type: Boolean,
  default: false,
})

const props = defineProps({
  /** 与主区底部树一致的数据源 */
  treeData: {
    type: Array,
    default: () => [],
  },
  /** 当前项目 id，创建任务时必填 */
  projectId: {
    type: [Number, String],
    default: null,
  },
  /** 项目详情中的分类 id，树上节点未带 category 时作为 project_category_id 回退 */
  projectCategoryId: {
    type: [Number, String],
    default: null,
  },
  /** 项目计划开始（选阶段时新任务计划日期须落在项目计划内） */
  projectPlannedStartDate: {
    type: String,
    default: '',
  },
  /** 项目计划结束 */
  projectPlannedEndDate: {
    type: String,
    default: '',
  },
  /** 主要负责人候选（与任务详情负责人下拉一致） */
  assigneeOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['task-created'])

/** 负责人下拉不含 user_id=1 */
const assigneeOptionsForPicker = computed(() => {
  const list = Array.isArray(props.assigneeOptions) ? props.assigneeOptions : []
  return list.filter((o) => Number(String(o?.value ?? '').trim()) !== 1)
})

const detailVisible = ref(false)
/** @type {import('vue').Ref<null | { parent_task_id: number | null, project_category_id: number | null, project_processes_id: number | string | null }>} */
const creationContext = ref(null)

const selectedKey = ref(null)
const selectedData = ref(null)

const taskForm = ref({
  task_name: '',
  planned_start_date: '',
  planned_end_date: '',
  /** 主要负责人 user_id（下拉展示为 assigneeOptions 去掉 id=1 后的项） */
  assignee_id: '',
})

/** 计划日期可选范围（本地日 00:00 时间戳，含首尾日）；kind 用于提示文案 */
const plannedDateBounds = ref({
  minDayMs: /** @type {number | null} */ (null),
  maxDayMs: /** @type {number | null} */ (null),
  kind: /** @type {'project' | 'parent_actual'} */ ('project'),
})

function resetDetailForm() {
  taskForm.value = {
    task_name: '',
    planned_start_date: '',
    planned_end_date: '',
    assignee_id: '',
  }
}

function parseToLocalDayStartMs(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const t = Date.parse(String(v))
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function ymdFromLocalDayStartMs(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 本地日历日加 N 个月（日号溢出时取目标月最后一天） */
function addMonthsLocalDayStartMs(ms, months) {
  const d = new Date(ms)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function clampLocalDayMs(ms, minDayMs, maxDayMs) {
  if (ms == null || !Number.isFinite(ms)) return ms
  let c = ms
  if (minDayMs != null && c < minDayMs) c = minDayMs
  if (maxDayMs != null && c > maxDayMs) c = maxDayMs
  return c
}

function isDayMsWithinBounds(ms, minDayMs, maxDayMs) {
  if (ms == null || !Number.isFinite(ms)) return false
  if (minDayMs != null && ms < minDayMs) return false
  if (maxDayMs != null && ms > maxDayMs) return false
  return true
}

function computePlannedDateBoundsForSelection(selectedData) {
  const projMin = parseToLocalDayStartMs(props.projectPlannedStartDate)
  const projMax = parseToLocalDayStartMs(props.projectPlannedEndDate)

  if (!selectedData || typeof selectedData !== 'object') {
    return { minDayMs: projMin, maxDayMs: projMax, kind: 'project' }
  }

  /** 子任务：仅按父任务「实际」起止约束可选日期（与阶段场景无关） */
  if (selectedData.nodeType === 'task') {
    const tMin = parseToLocalDayStartMs(selectedData.actual_start_date)
    const tMax = parseToLocalDayStartMs(selectedData.actual_end_date)
    return { minDayMs: tMin, maxDayMs: tMax, kind: 'parent_actual' }
  }

  return { minDayMs: projMin, maxDayMs: projMax, kind: 'project' }
}

function isPlannedDayDisabled(which, time) {
  const cell = new Date(time)
  cell.setHours(0, 0, 0, 0)
  const c = cell.getTime()
  const { minDayMs, maxDayMs } = plannedDateBounds.value
  if (minDayMs != null && c < minDayMs) return true
  if (maxDayMs != null && c > maxDayMs) return true
  if (which === 'start' && taskForm.value.planned_end_date) {
    const endMs = parseToLocalDayStartMs(taskForm.value.planned_end_date)
    if (endMs != null && c > endMs) return true
  }
  if (which === 'end' && taskForm.value.planned_start_date) {
    const startMs = parseToLocalDayStartMs(taskForm.value.planned_start_date)
    if (startMs != null && c < startMs) return true
  }
  return false
}

const plannedRangeHint = computed(() => {
  const { minDayMs, maxDayMs, kind } = plannedDateBounds.value
  if (minDayMs == null && maxDayMs == null) return ''
  const a = minDayMs != null ? ymdFromLocalDayStartMs(minDayMs) : '—'
  const b = maxDayMs != null ? ymdFromLocalDayStartMs(maxDayMs) : '—'
  if (kind === 'parent_actual') {
    return `子任务日期须在父任务实际开始至实际结束范围内：${a} ～ ${b}（范围外不可选）`
  }
  return `可选计划日期：${a} ～ ${b}（范围外日期不可选）`
})

function applyDefaultPlannedDatesFromBounds() {
  if (taskForm.value.planned_start_date || taskForm.value.planned_end_date) return

  const { minDayMs, maxDayMs } = plannedDateBounds.value
  const todayMs = parseToLocalDayStartMs(new Date())
  if (todayMs == null) return

  const preferredEndMs = addMonthsLocalDayStartMs(todayMs, 1)
  const preferredInRange =
    isDayMsWithinBounds(todayMs, minDayMs, maxDayMs) &&
    isDayMsWithinBounds(preferredEndMs, minDayMs, maxDayMs)

  let startMs
  let endMs

  if (preferredInRange) {
    startMs = todayMs
    endMs = preferredEndMs
  } else if (minDayMs != null && maxDayMs != null && minDayMs <= maxDayMs) {
    startMs = clampLocalDayMs(todayMs, minDayMs, maxDayMs)
    endMs = clampLocalDayMs(preferredEndMs, minDayMs, maxDayMs)
    if (startMs > endMs) {
      startMs = minDayMs
      endMs = Math.min(addMonthsLocalDayStartMs(minDayMs, 1), maxDayMs)
      if (endMs < startMs) endMs = maxDayMs
    }
  } else if (minDayMs != null) {
    startMs = Math.max(todayMs, minDayMs)
    endMs = addMonthsLocalDayStartMs(startMs, 1)
    if (endMs < startMs) endMs = startMs
  } else if (maxDayMs != null) {
    endMs = Math.min(preferredEndMs, maxDayMs)
    startMs = addMonthsLocalDayStartMs(endMs, -1)
    if (startMs > endMs) startMs = endMs
  } else {
    startMs = todayMs
    endMs = preferredEndMs
  }

  taskForm.value.planned_start_date = ymdFromLocalDayStartMs(startMs)
  taskForm.value.planned_end_date = ymdFromLocalDayStartMs(endMs)
}

function assertYmdWithinBounds(ymd) {
  if (ymd == null || String(ymd).trim() === '') return true
  const c = parseToLocalDayStartMs(ymd)
  if (c == null) return false
  const { minDayMs, maxDayMs } = plannedDateBounds.value
  if (minDayMs != null && c < minDayMs) return false
  if (maxDayMs != null && c > maxDayMs) return false
  return true
}

function projectIdNum() {
  const n = Number(props.projectId)
  return Number.isFinite(n) ? n : null
}

function fallbackCategoryNum() {
  const n = Number(props.projectCategoryId)
  return Number.isFinite(n) ? n : null
}

function nodeDisplayLabel(data) {
  if (data == null) return ''
  if (typeof data !== 'object') return String(data)
  return String(data.label ?? data.name ?? data.step_name ?? data.process_name ?? data.title ?? '')
}

watch(visible, (v) => {
  if (v) {
    selectedKey.value = null
    selectedData.value = null
  }
})

watch(detailVisible, (v) => {
  if (!v) {
    resetDetailForm()
    creationContext.value = null
    plannedDateBounds.value = { minDayMs: null, maxDayMs: null, kind: 'project' }
  } else {
    applyDefaultPlannedDatesFromBounds()
  }
})

function onTreeNodeClick(data) {
  if (data == null) return
  selectedKey.value = data.id ?? data.step_id ?? nodeDisplayLabel(data)
  selectedData.value = data
}

function onCancelPosition() {
  visible.value = false
}

function onConfirmPosition() {
  const d = selectedData.value
  if (!d) {
    ElMessage.warning('请选择添加位置')
    return
  }
  if (d.nodeType === 'task' && !Number.isFinite(Number(d._taskDbId))) {
    ElMessage.warning('请选择已保存的任务作为父级，或选择阶段/流程节点添加任务')
    return
  }

  const ctx = resolveAddTaskContext(props.treeData, d, fallbackCategoryNum())
  if (!ctx) {
    ElMessage.warning('无法解析所选层级')
    return
  }
  if (ctx.project_processes_id == null) {
    ElMessage.warning('无法确定 project_processes_id，请在挂有流程实例（processes）的节点下添加')
    return
  }

  const bounds = computePlannedDateBoundsForSelection(d)
  if (d.nodeType === 'task') {
    if (bounds.minDayMs == null || bounds.maxDayMs == null) {
      ElMessage.warning('父任务须同时具备实际开始与实际结束日期后，才可添加子任务')
      return
    }
  }
  if (
    bounds.minDayMs != null &&
    bounds.maxDayMs != null &&
    bounds.minDayMs > bounds.maxDayMs
  ) {
    ElMessage.warning(
      d.nodeType === 'task'
        ? '父任务实际开始日期晚于实际结束日期，请修正后再添加子任务'
        : '项目计划开始日期晚于计划结束日期，请先在项目中修正计划日期',
    )
    return
  }

  plannedDateBounds.value = bounds
  creationContext.value = ctx
  visible.value = false
  resetDetailForm()
  applyDefaultPlannedDatesFromBounds()
  detailVisible.value = true
}

function onCancelDetail() {
  detailVisible.value = false
}

async function onSubmitDetail() {
  const name = (taskForm.value.task_name || '').trim()
  if (!name) {
    ElMessage.warning('请填写任务名称')
    return
  }
  const assigneeId = String(taskForm.value.assignee_id ?? '').trim()
  if (!assigneeId) {
    ElMessage.warning('请选择主要负责人')
    return
  }
  const assigneeOpt = assigneeOptionsForPicker.value.find(
    (o) => String(o?.value ?? '').trim() === assigneeId,
  )
  const assignee_name = assigneeOpt?.label != null ? String(assigneeOpt.label).trim() || null : null
  const ps = (taskForm.value.planned_start_date || '').trim()
  const pe = (taskForm.value.planned_end_date || '').trim()
  if (!assertYmdWithinBounds(ps) || !assertYmdWithinBounds(pe)) {
    ElMessage.warning('计划开始/结束日期须落在允许范围内')
    return
  }
  if (ps && pe) {
    const a = parseToLocalDayStartMs(ps)
    const b = parseToLocalDayStartMs(pe)
    if (a != null && b != null && a > b) {
      ElMessage.warning('计划开始日期不能晚于计划结束日期')
      return
    }
  }
  const project_id = projectIdNum()
  if (project_id == null) {
    ElMessage.warning('请先选择项目')
    return
  }
  const snap = creationContext.value
  if (!snap) {
    detailVisible.value = false
    return
  }
  try {
    const res = await createProjectTaskAPI({
      project_id,
      task_name: name,
      parent_task_id: snap.parent_task_id,
      project_category_id: snap.project_category_id,
      project_processes_id: snap.project_processes_id,
      assignee_id: assigneeId,
      assignee_name: assignee_name ?? undefined,
      planned_start_date: ps || undefined,
      planned_end_date: pe || undefined,
      actual_start_date: ps || undefined,
      actual_end_date: pe || undefined,
    })
    if (res?.code === 200) {
      ElMessage.success('任务已创建')
      detailVisible.value = false
      const newId = Number(res?.data?.id)
      creationContext.value = null
      emit('task-created', {
        taskId: Number.isFinite(newId) ? newId : null,
        project_id,
      })
      return
    }
    ElMessage.error(res?.msg || '创建失败')
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="选择添加位置"
    width="480px"
    append-to-body
    destroy-on-close
  >
    <p class="add-task-dialog__hint">
      选择<strong>阶段</strong>：新任务加在该阶段末尾；选择<strong>任务</strong>：新任务加为该任务的子任务。确定后将填写任务名称与计划日期并写入数据库。
    </p>
    <el-tree
      class="add-task-dialog__tree"
      :data="treeData"
      :props="{ label: 'label', children: 'children' }"
      default-expand-all
      highlight-current
      :current-node-key="selectedKey"
      :expand-on-click-node="false"
      @node-click="onTreeNodeClick"
    >
      <template #default="{ data }">
        <span>{{ nodeDisplayLabel(data) }}</span>
      </template>
    </el-tree>
    <template #footer>
      <el-button @click="onCancelPosition">取消</el-button>
      <el-button type="primary" @click="onConfirmPosition">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="detailVisible"
    title="新建任务"
    width="520px"
    append-to-body
    destroy-on-close
    class="add-task-detail-dialog"
  >
    <el-form label-position="top" size="default" @submit.prevent>
      <p v-if="plannedRangeHint" class="add-task-detail-dialog__range-hint">{{ plannedRangeHint }}</p>
      <el-form-item label="任务名称" required>
        <el-input v-model="taskForm.task_name" maxlength="200" show-word-limit placeholder="请输入任务名称" />
      </el-form-item>
      <el-form-item label="主要负责人" required>
        <el-select
          v-model="taskForm.assignee_id"
          filterable
          placeholder="请选择主要负责人"
          style="width: 100%"
        >
          <el-option
            v-for="opt in assigneeOptionsForPicker"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="计划开始日期">
        <el-date-picker
          v-model="taskForm.planned_start_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          :disabled-date="(t) => isPlannedDayDisabled('start', t)"
        />
      </el-form-item>
      <el-form-item label="计划结束日期">
        <el-date-picker
          v-model="taskForm.planned_end_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
          :disabled-date="(t) => isPlannedDayDisabled('end', t)"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onCancelDetail">取消</el-button>
      <el-button type="primary" @click="onSubmitDetail">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.add-task-dialog__hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.add-task-detail-dialog__range-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.add-task-dialog__tree {
  max-height: min(420px, 50vh);
  overflow-y: auto;
  padding: 4px 0;
  background: transparent;

  :deep(.el-tree-node__content) {
    height: auto;
    min-height: 32px;
    padding: 4px 0;
    border-radius: 6px;
  }
}
</style>
