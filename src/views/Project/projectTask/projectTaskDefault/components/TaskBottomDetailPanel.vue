<script setup>
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { taskStatusTagType } from '../composables/useProjectTaskTree'
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '../composables/taskBottomRightHelpers'
import { TASK_BOTTOM_DETAIL_CONTEXT_KEY } from '../composables/taskBottomDetailInjectionKey'

defineOptions({ name: 'TaskBottomDetailPanel' })

const d = inject(TASK_BOTTOM_DETAIL_CONTEXT_KEY)
if (!d) {
  throw new Error('TaskBottomDetailPanel: 上层需提供 provide(TASK_BOTTOM_DETAIL_CONTEXT_KEY)')
}

const router = useRouter()

const {
  selectedProjectId,
  selectedBottomNode,
  projectDetailCategoryName,
  bottomRightStructureStats,
  selectedProcessPhaseCount,
  projectUserAuthorizeOptions,
  taskDetailLoading,
  taskDetailSaving,
  taskCommentDraft,
  mentionVisible,
  mentionFilteredOptions,
  mentionActiveIndex,
  taskCommentSubmitting,
  commentContextMenu,
  formatDateTime,
  normalizeTaskTriStatus,
  countDescendantTasks,
  onTaskAssigneeSelectChange,
  onTaskCurrentTaskProgressChange,
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
} = d

const activeProjectId = computed(() => {
  const raw = selectedProjectId?.value
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  const node = selectedBottomNode?.value
  const fromNode = Number(node?.project_id ?? node?.projectId)
  if (Number.isFinite(fromNode) && fromNode > 0) return fromNode
  return null
})

function goToProjectDetail() {
  const id = activeProjectId.value
  if (id == null) return
  router.push({ name: 'ProjectDetail', params: { id: String(id) } })
}
</script>

<template>
  <div class="project-task-main project-task-page__main-bottom-right">
    <div class="main-bottom-right__head">
      <span class="main-bottom-right__title">详情</span>
      <el-button
        v-if="activeProjectId != null"
        class="main-bottom-right__project-link"
        type="primary"
        link
        size="small"
        @click="goToProjectDetail"
      >
        项目详情
      </el-button>
    </div>
    <el-scrollbar class="main-bottom-right__scroll">
      <template v-if="selectedBottomNode?.nodeType === 'process'">
        <el-descriptions
          class="main-bottom-right__desc"
          title="流程信息"
          :column="1"
          border
          size="small"
        >
          <el-descriptions-item label="类型">
            <el-tag size="small" type="primary" effect="plain">流程</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="流程名称">
            {{
              selectedBottomNode.label ??
                selectedBottomNode.process_name ??
                selectedBottomNode.name ??
                '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="所属大类">
            {{ selectedBottomNode.categoryName ?? projectDetailCategoryName ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="流程实例 ID">
            {{ selectedBottomNode.projectProcessesId ?? selectedBottomNode.project_processes_id ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="阶段数量">
            {{ selectedProcessPhaseCount }}
          </el-descriptions-item>
          <el-descriptions-item label="任务总数（含子任务）">
            {{ bottomRightStructureStats?.total ?? 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="任务状态分布">
            <div v-if="bottomRightStructureStats" class="main-bottom-right__status-dist">
              <el-tag size="small" type="warning" effect="plain">
                未开始 {{ bottomRightStructureStats.byStatus['未开始'] }}
              </el-tag>
              <el-tag size="small" type="success" effect="plain">
                进行中 {{ bottomRightStructureStats.byStatus['进行中'] }}
              </el-tag>
              <el-tag size="small" type="info" effect="plain">
                已完成 {{ bottomRightStructureStats.byStatus['已完成'] }}
              </el-tag>
            </div>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="计划时间跨度（子孙任务汇总）">
            {{ bottomRightStructureStats?.plannedRangeText ?? '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template v-else-if="selectedBottomNode?.nodeType === 'phase'">
        <el-descriptions
          class="main-bottom-right__desc"
          title="阶段信息"
          :column="1"
          border
          size="small"
        >
          <el-descriptions-item label="类型">
            <el-tag size="small" type="info" effect="plain">阶段</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="阶段名称">
            {{
              selectedBottomNode.label ??
                selectedBottomNode.process_name ??
                selectedBottomNode.name ??
                '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="阶段 ID">
            {{ selectedBottomNode.phaseId ?? selectedBottomNode.step_id ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="所属大类">
            {{ selectedBottomNode.categoryName ?? projectDetailCategoryName ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="任务总数（含子任务）">
            {{ bottomRightStructureStats?.total ?? countDescendantTasks(selectedBottomNode.children) }}
          </el-descriptions-item>
          <el-descriptions-item label="任务状态分布">
            <div v-if="bottomRightStructureStats" class="main-bottom-right__status-dist">
              <el-tag size="small" type="warning" effect="plain">
                未开始 {{ bottomRightStructureStats.byStatus['未开始'] }}
              </el-tag>
              <el-tag size="small" type="success" effect="plain">
                进行中 {{ bottomRightStructureStats.byStatus['进行中'] }}
              </el-tag>
              <el-tag size="small" type="info" effect="plain">
                已完成 {{ bottomRightStructureStats.byStatus['已完成'] }}
              </el-tag>
            </div>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="计划时间跨度（子孙任务汇总）">
            {{ bottomRightStructureStats?.plannedRangeText ?? '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <div
        v-else-if="selectedBottomNode?.nodeType === 'task'"
        v-loading="taskDetailLoading || taskDetailSaving"
        element-loading-text="请稍候…"
        class="main-bottom-right__task main-bottom-right__task--detail"
      >
        <div class="main-bottom-right__task-head">
          <el-tag
            :type="taskStatusTagType(normalizeTaskTriStatus(selectedBottomNode.status))"
            size="small"
            effect="light"
          >
            {{ normalizeTaskTriStatus(selectedBottomNode.status) }}
          </el-tag>
          <span class="main-bottom-right__task-hint">在下方维护任务信息</span>
        </div>
        <el-form
          class="main-bottom-right__form"
          label-position="top"
          size="small"
          @keydown.capture="onTaskDetailFormKeydown"
        >
          <el-form-item label="任务名称">
            <el-input v-model="selectedBottomNode.label" clearable placeholder="任务名称" />
          </el-form-item>
          <el-form-item label="任务描述">
            <el-input
              class="main-bottom-right__field-task-desc"
              v-model="selectedBottomNode.description"
              type="textarea"
              :rows="5"
              maxlength="500"
              show-word-limit
              placeholder="任务目标、验收标准、风险提示等"
            />
            <p class="main-bottom-right__field-hint">Enter 换行；Ctrl + Enter（Mac：⌘ + Enter）保存</p>
          </el-form-item>
          <el-form-item label="任务进度" class="main-bottom-right__progress-item">
            <div class="main-bottom-right__progress-row">
              <el-input-number
                class="main-bottom-right__progress-input"
                :model-value="selectedBottomNode.current_task_progress"
                :min="0"
                :max="100"
                :precision="2"
                :step="1"
                :disabled="!taskProgressEditable"
                controls-position="right"
                placeholder="0"
                @change="onTaskCurrentTaskProgressChange"
              />
              <span class="main-bottom-right__progress-unit">%</span>
              <span v-if="taskProgressHint" class="main-bottom-right__progress-inline-hint">
                {{ taskProgressHint }}
              </span>
            </div>
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="开始时间">
                <el-date-picker
                  :model-value="selectedBottomNode.startAt"
                  type="datetime"
                  placeholder="开始时间"
                  style="width: 100%"
                  value-format="x"
                  :disabled-date="(t) => isTaskDetailDayDisabledForPicker('start', t)"
                  :disabled-hours="(role, cd) => getTaskDetailDisabledHoursForPicker('start', role, cd)"
                  :disabled-minutes="(hour, role, cd) => getTaskDetailDisabledMinutesForPicker('start', hour, role, cd)"
                  :disabled-seconds="(hour, minute, role, cd) =>
                    getTaskDetailDisabledSecondsForPicker('start', hour, minute, role, cd)"
                  @update:model-value="onTaskPlannedStartDateChange"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="截止时间">
                <el-date-picker
                  :model-value="selectedBottomNode.endAt"
                  type="datetime"
                  placeholder="截止时间"
                  style="width: 100%"
                  value-format="x"
                  :disabled-date="(t) => isTaskDetailDayDisabledForPicker('end', t)"
                  :disabled-hours="(role, cd) => getTaskDetailDisabledHoursForPicker('end', role, cd)"
                  :disabled-minutes="(hour, role, cd) => getTaskDetailDisabledMinutesForPicker('end', hour, role, cd)"
                  :disabled-seconds="(hour, minute, role, cd) =>
                    getTaskDetailDisabledSecondsForPicker('end', hour, minute, role, cd)"
                  @update:model-value="onTaskPlannedEndDateChange"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="负责人">
                <el-select
                  :model-value="selectedBottomNode.assignee"
                  filterable
                  clearable
                  placeholder="选择执行人"
                  style="width: 100%"
                  @update:model-value="onTaskAssigneeSelectChange"
                >
                  <el-option
                    v-for="opt in projectUserAuthorizeOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="优先级">
                <el-radio-group v-model="selectedBottomNode.priority">
                  <el-radio-button v-for="opt in TASK_PRIORITY_OPTIONS" :key="opt.value" :label="opt.value">
                    {{ opt.label }}
                  </el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="协同人">
            <el-select
              v-model="selectedBottomNode.collaborators"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="3"
              placeholder="请选择协同人（可多选）"
              style="width: 100%"
              @change="onTaskCollaboratorsChange"
            >
              <el-option
                v-for="opt in projectUserAuthorizeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="执行状态">
            <el-radio-group
              v-model="selectedBottomNode.status"
              class="main-bottom-right__status-radio"
              @change="onTaskExecutionStatusChange"
            >
              <el-radio v-for="opt in TASK_STATUS_OPTIONS" :key="opt.value" :label="opt.value">
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <el-divider content-position="left">评论</el-divider>
        <el-timeline v-if="selectedBottomNode.comments?.length" class="main-bottom-right__timeline">
          <el-timeline-item
            v-for="c in selectedBottomNode.comments"
            :key="c.id"
            :timestamp="formatDateTime(c.createdAt)"
            placement="top"
          >
            <el-card
              shadow="never"
              class="main-bottom-right__comment-card"
              :class="{ 'is-deletable': canDeleteTaskComment(c) }"
              @contextmenu="onCommentContextMenu($event, c)"
            >
              <div class="main-bottom-right__comment-author">{{ c.author }}</div>
              <div class="main-bottom-right__comment-text">{{ c.content }}</div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else class="main-bottom-right__comment-empty" description="暂无评论" :image-size="56" />
        <div class="main-bottom-right__comment-input">
          <div class="main-bottom-right__comment-field">
            <el-input
              :ref="(el) => registerCommentInput(el)"
              :model-value="taskCommentDraft"
              type="textarea"
              :rows="2"
              maxlength="300"
              show-word-limit
              placeholder="输入 @ 提及同事；Enter 换行，Ctrl + Enter（Mac：⌘ + Enter）发表"
              @update:model-value="onCommentUpdate"
              @keydown="onCommentKeydown"
              @blur="scheduleHideMentionPanel"
              @click="onCommentCaretMove"
              @keyup="onCommentCaretMove"
            />
            <div v-show="mentionVisible" class="main-bottom-right__mention-panel" @mousedown.prevent>
              <div
                v-for="(opt, i) in mentionFilteredOptions"
                :key="opt.value"
                :class="['main-bottom-right__mention-item', { 'is-active': i === mentionActiveIndex }]"
                @mousedown.prevent
                @click="pickMention(opt)"
              >
                <span class="main-bottom-right__mention-name">{{ opt.label }}</span>
                <span class="main-bottom-right__mention-id">{{ opt.value }}</span>
              </div>
              <div v-if="!mentionFilteredOptions.length" class="main-bottom-right__mention-empty">无匹配人员</div>
            </div>
          </div>
          <p class="main-bottom-right__field-hint">Enter 换行；Ctrl + Enter（Mac：⌘ + Enter）发表；本人评论可右键删除</p>
          <el-button
            class="main-bottom-right__comment-btn"
            type="primary"
            size="small"
            :loading="taskCommentSubmitting"
            :disabled="taskCommentSubmitting"
            @click="submitTaskComment"
          >
            发表评论
          </el-button>
        </div>
        <Teleport to="body">
          <div
            v-if="commentContextMenu.visible"
            class="task-tree-context-menu__backdrop"
            @mousedown="closeCommentContextMenu"
            @click="closeCommentContextMenu"
            @contextmenu.prevent="closeCommentContextMenu"
            @wheel="closeCommentContextMenu"
          />
          <ul
            v-if="commentContextMenu.visible"
            class="task-tree-context-menu"
            :style="{ left: `${commentContextMenu.x}px`, top: `${commentContextMenu.y}px` }"
            @mousedown.stop
            @click.stop
            @contextmenu.stop.prevent
          >
            <li
              class="task-tree-context-menu__item"
              @mousedown.stop
              @click="deleteTaskCommentFromContextMenu"
            >
              删除
            </li>
          </ul>
        </Teleport>
      </div>
      <el-empty
        v-else
        class="main-bottom-right__empty"
        description="在左侧点击流程、阶段或任务节点查看详情"
        :image-size="80"
      />
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
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

.project-task-page__main-bottom-right {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-bottom-right__head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.main-bottom-right__project-link {
  flex-shrink: 0;
  padding: 0 4px;
  font-size: 13px;
}

.main-bottom-right__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.main-bottom-right__scroll {
  flex: 1 1 0%;
  min-height: 0;
  padding-right: 4px;
}

.main-bottom-right__desc {
  margin-bottom: 8px;
}

.main-bottom-right__status-dist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.main-bottom-right__task--detail {
  position: relative;
  min-height: 200px;
}

.main-bottom-right__task-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.main-bottom-right__task-hint,
.main-bottom-right__field-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.main-bottom-right__field-hint {
  margin: 6px 0 0;
  line-height: 1.45;
}

.main-bottom-right__form {
  margin-bottom: 8px;
}

.main-bottom-right__progress-item {
  :deep(.el-form-item__content) {
    line-height: 1;
  }
}

.main-bottom-right__progress-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

.main-bottom-right__progress-input {
  width: 120px;
  flex: 0 0 auto;

  :deep(.el-input__wrapper) {
    padding-left: 10px;
    padding-right: 36px;
  }
}

.main-bottom-right__progress-unit {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.main-bottom-right__progress-inline-hint {
  flex: 1 1 auto;
  min-width: 140px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.main-bottom-right__status-radio {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
}

.main-bottom-right__timeline {
  padding-left: 4px;
  margin-bottom: 12px;

  :deep(.el-timeline-item__timestamp) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.main-bottom-right__comment-card {
  --el-card-padding: 10px 12px;

  border-radius: 8px;

  &.is-deletable {
    cursor: context-menu;
  }
}

.main-bottom-right__comment-input .main-bottom-right__field-hint {
  margin: 0;
}

.main-bottom-right__comment-author {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.main-bottom-right__comment-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.main-bottom-right__comment-empty {
  padding: 8px 0 16px;
}

.main-bottom-right__comment-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main-bottom-right__comment-field {
  position: relative;
}

.main-bottom-right__mention-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  z-index: 20;
  margin-bottom: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px 0;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.main-bottom-right__mention-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;

  &:hover,
  &.is-active {
    background: var(--el-fill-color-light);
  }
}

.main-bottom-right__mention-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.main-bottom-right__mention-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.main-bottom-right__mention-empty {
  padding: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.main-bottom-right__comment-btn {
  align-self: flex-end;
}

.main-bottom-right__empty {
  padding: 32px 12px;
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
