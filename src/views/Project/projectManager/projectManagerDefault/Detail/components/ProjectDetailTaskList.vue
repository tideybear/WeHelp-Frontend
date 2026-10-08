<script setup>
import { CaretBottom, CaretTop } from '@element-plus/icons-vue'
import { projectDetailTaskRowClassName } from '@/utils/projectTaskListDisplay'

defineOptions({ name: 'ProjectDetailTaskList' })

const props = defineProps({
  tasks: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '任务列表',
  },
  primaryLabel: {
    type: String,
    default: '进入页面',
  },
  sortField: {
    type: String,
    default: null,
  },
  sortOrder: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['primary-click', 'sort-change', 'task-click'])

function onRowClick(row) {
  const id = Number(row?.id)
  if (!Number.isFinite(id) || id <= 0) return
  emit('task-click', row)
}

const taskStatusTagType = (status) => {
  if (status === '已完成') return 'success'
  if (status === '进行中') return 'primary'
  if (status === '未开始') return 'info'
  return 'info'
}

function toggleSort(field) {
  let nextField = field
  let nextOrder = 'asc'
  if (props.sortField === field) {
    if (props.sortOrder === 'asc') nextOrder = 'desc'
    else if (props.sortOrder === 'desc') {
      nextField = null
      nextOrder = null
    }
  }
  emit('sort-change', { field: nextField, order: nextOrder })
}

function sortIconClass(field, part) {
  const active = props.sortField === field && props.sortOrder === part
  return ['project-detail-task-list__sort-icon', { 'is-active': active }]
}
</script>

<template>
  <div class="project-detail-task-list">
    <header class="project-detail-task-list__head">
      <h3 class="project-detail-task-list__title">{{ title }}</h3>
      <el-button type="primary" size="small" @click="emit('primary-click')">
        {{ primaryLabel }}
      </el-button>
    </header>
    <div class="project-detail-task-list__body">
      <el-table
        v-loading="loading"
        class="project-detail-task-list__table"
        :data="tasks"
        :row-class-name="projectDetailTaskRowClassName"
        border
        stripe
        empty-text="暂无任务数据"
        @row-click="onRowClick"
      >
        <el-table-column prop="displayIndex" label="序号" width="72" align="center" />
        <el-table-column prop="title" label="任务名称" min-width="160">
          <template #default="{ row }">
            <span
              class="task-name-cell"
              :class="{ 'task-name-cell--child': row.isChild }"
            >{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="assignee" width="116" show-overflow-tooltip>
          <template #header>
            <button
              type="button"
              class="project-detail-task-list__sort-head"
              @click="toggleSort('assignee')"
            >
              <span>执行人</span>
              <span class="project-detail-task-list__sort-icons" aria-hidden="true">
                <el-icon :class="sortIconClass('assignee', 'asc')"><CaretTop /></el-icon>
                <el-icon :class="sortIconClass('assignee', 'desc')"><CaretBottom /></el-icon>
              </span>
            </button>
          </template>
        </el-table-column>
        <el-table-column prop="dueDate" width="132">
          <template #header>
            <button
              type="button"
              class="project-detail-task-list__sort-head"
              @click="toggleSort('dueDate')"
            >
              <span>截止日期</span>
              <span class="project-detail-task-list__sort-icons" aria-hidden="true">
                <el-icon :class="sortIconClass('dueDate', 'asc')"><CaretTop /></el-icon>
                <el-icon :class="sortIconClass('dueDate', 'desc')"><CaretBottom /></el-icon>
              </span>
            </button>
          </template>
        </el-table-column>
        <el-table-column prop="status" width="108">
          <template #header>
            <button
              type="button"
              class="project-detail-task-list__sort-head"
              @click="toggleSort('status')"
            >
              <span>状态</span>
              <span class="project-detail-task-list__sort-icons" aria-hidden="true">
                <el-icon :class="sortIconClass('status', 'asc')"><CaretTop /></el-icon>
                <el-icon :class="sortIconClass('status', 'desc')"><CaretBottom /></el-icon>
              </span>
            </button>
          </template>
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="taskStatusTagType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="progress" label="进度" min-width="160">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Math.max(0, Number(row.progress) || 0))"
              :stroke-width="10"
              :status="row.status === '已完成' ? 'success' : undefined"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-detail-task-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--el-bg-color);
  overflow: hidden;
}

.project-detail-task-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.project-detail-task-list__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.project-detail-task-list__body {
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  padding: 12px 16px 16px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.project-detail-task-list__table {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;

  :deep(.el-table__inner-wrapper) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :deep(.el-table__body-wrapper) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  :deep(.project-task-row--has-children > td) {
    background-color: var(--el-color-primary-light-9) !important;
  }

  :deep(.project-task-row--child > td) {
    background-color: var(--el-fill-color-lighter) !important;
  }

  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.project-detail-task-list__sort-head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  font-weight: 600;
  color: var(--el-text-color-primary);
  cursor: pointer;
  line-height: 1.2;

  &:hover {
    color: var(--el-color-primary);
  }
}

.project-detail-task-list__sort-icons {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 14px;
  line-height: 0;
  gap: 0;
}

.project-detail-task-list__sort-icon {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: -2px 0;

  &.is-active {
    color: var(--el-color-primary);
  }
}

.task-name-cell--child {
  display: inline-block;
  padding-left: 12px;
}
</style>
