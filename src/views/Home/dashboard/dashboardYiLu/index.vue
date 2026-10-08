<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getProjectTasksDashboardAPI } from '@/apis/project'
import { useUserStore } from '@/stores/userStore'
import { formatDateOnly, formatDateTime } from '@/utils/formatDate'
import { writePersistedTaskTreeSelection } from '@/views/Project/projectTask/projectTaskDefault/composables/useTaskTreeSelectionPersist'
import { taskStatusTagType } from '@/views/Project/projectTask/projectTaskDefault/composables/useProjectTaskTree'
import { TASK_PRIORITY_OPTIONS } from '@/views/Project/projectTask/projectTaskDefault/composables/taskBottomRightHelpers'

const props = defineProps<{
  namespaceId?: number | string | null
}>()

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const stats = ref({
  my_total: 0,
  my_in_progress: 0,
  my_overdue: 0,
  mentioned_total: 0,
})
const myTasksRaw = ref<any[]>([])
const mentionedTasks = ref<any[]>([])
const myTaskFilter = ref<'all' | 'in_progress' | 'overdue'>('all')

const priorityLabelMap = Object.fromEntries(
  TASK_PRIORITY_OPTIONS.map((o) => [o.value, o.label]),
)

const currentUserId = computed(() => {
  const id = Number(userStore.userInfo?.id)
  return Number.isFinite(id) && id > 0 ? id : null
})

const namespaceIdNum = computed(() => {
  const raw = props.namespaceId
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

const filteredMyTasks = computed(() => {
  const list = myTasksRaw.value.filter((t) => t?.task_status !== '已完成')
  if (myTaskFilter.value === 'in_progress') {
    return list.filter((t) => t?.task_status === '进行中')
  }
  if (myTaskFilter.value === 'overdue') {
    return list.filter((t) => t?.is_overdue)
  }
  return list
})

function roleLabel(role: string) {
  if (role === 'assignee') return '负责人'
  if (role === 'collaborator') return '协同人'
  if (role === 'both') return '负责人 / 协同人'
  return '—'
}

function roleTagType(role: string) {
  if (role === 'assignee') return 'primary'
  if (role === 'collaborator') return 'success'
  if (role === 'both') return 'warning'
  return 'info'
}

function priorityLabel(value: string) {
  const key = String(value ?? '').trim().toLowerCase()
  return priorityLabelMap[key] ?? value ?? '—'
}

function priorityTagType(value: string) {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'urgent') return 'danger'
  if (key === 'high') return 'warning'
  if (key === 'medium') return ''
  return 'info'
}

function formatProgress(row: { current_task_progress?: number | string | null }) {
  const n = Number(row?.current_task_progress)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function goToTask(projectId: number | string | null | undefined, taskId: number | string | null | undefined) {
  const pid = Number(projectId)
  const tid = Number(taskId)
  if (!Number.isFinite(pid) || !Number.isFinite(tid) || tid <= 0) return
  writePersistedTaskTreeSelection(pid, tid)
  router.push({
    name: 'ProjectTask',
    query: { projectId: String(pid), taskId: String(tid) },
  })
}

async function fetchDashboard() {
  const ns = namespaceIdNum.value
  const uid = currentUserId.value
  if (ns == null || uid == null) {
    stats.value = { my_total: 0, my_in_progress: 0, my_overdue: 0, mentioned_total: 0 }
    myTasksRaw.value = []
    mentionedTasks.value = []
    return
  }
  loading.value = true
  try {
    const res = await getProjectTasksDashboardAPI({ namespace_id: ns, user_id: uid })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取任务看板失败')
      return
    }
    const data = res?.data ?? {}
    stats.value = {
      my_total: Number(data?.stats?.my_total) || 0,
      my_in_progress: Number(data?.stats?.my_in_progress) || 0,
      my_overdue: Number(data?.stats?.my_overdue) || 0,
      mentioned_total: Number(data?.stats?.mentioned_total) || 0,
    }
    myTasksRaw.value = Array.isArray(data?.my_tasks) ? data.my_tasks : []
    mentionedTasks.value = Array.isArray(data?.mentioned_tasks) ? data.mentioned_tasks : []
  } catch (e: any) {
    console.error('获取任务看板失败:', e)
    ElMessage.error(e?.message || '获取任务看板失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchDashboard)
watch([namespaceIdNum, currentUserId], fetchDashboard)
</script>

<template>
  <div class="dashboard-yilu" v-loading="loading">
    <el-row :gutter="20" class="mgb20">
      <el-col :span="6">
        <el-card shadow="hover" body-class="stat-card-body">
          <el-icon class="stat-card-icon bg1"><List /></el-icon>
          <div class="stat-card-content">
            <div class="stat-card-num color1">{{ stats.my_total }}</div>
            <div>我的待办任务</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" body-class="stat-card-body">
          <el-icon class="stat-card-icon bg2"><Loading /></el-icon>
          <div class="stat-card-content">
            <div class="stat-card-num color2">{{ stats.my_in_progress }}</div>
            <div>进行中</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" body-class="stat-card-body">
          <el-icon class="stat-card-icon bg3"><AlarmClock /></el-icon>
          <div class="stat-card-content">
            <div class="stat-card-num color3">{{ stats.my_overdue }}</div>
            <div>已逾期</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" body-class="stat-card-body">
          <el-icon class="stat-card-icon bg4"><ChatDotRound /></el-icon>
          <div class="stat-card-content">
            <div class="stat-card-num color4">{{ stats.mentioned_total }}</div>
            <div>@ 提及我的</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="15">
        <el-card shadow="hover" class="panel-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">我的任务</p>
              <p class="panel-desc">负责人或协同人为当前用户的叶子任务（不含已完成、不含有子任务的父任务）</p>
            </div>
            <el-radio-group v-model="myTaskFilter" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="in_progress">进行中</el-radio-button>
              <el-radio-button label="overdue">已逾期</el-radio-button>
            </el-radio-group>
          </div>

          <el-table
            :data="filteredMyTasks"
            border
            stripe
            empty-text="暂无相关任务"
            class="task-table"
            @row-click="(row) => goToTask(row.project_id, row.id)"
          >
            <el-table-column prop="task_name" label="任务名称" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="task-link">{{ row.task_name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="project_name" label="所属项目" min-width="120" show-overflow-tooltip />
            <el-table-column label="我的角色" width="120" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="roleTagType(row.my_role)">{{ roleLabel(row.my_role) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="assignee_name" label="负责人" width="96" show-overflow-tooltip />
            <el-table-column label="截止" width="108">
              <template #default="{ row }">
                <span :class="{ 'is-overdue': row.is_overdue }">
                  {{ formatDateOnly(row.planned_end_date) || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="88" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="taskStatusTagType(row.task_status)">{{ row.task_status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="priorityTagType(row.priority)" effect="plain">
                  {{ priorityLabel(row.priority) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="120">
              <template #default="{ row }">
                <el-progress :percentage="formatProgress(row)" :stroke-width="8" :show-text="true" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="9">
        <el-card shadow="hover" class="panel-card panel-card--mentions">
          <div class="panel-header">
            <div>
              <p class="panel-title">评论 @ 提及我</p>
              <p class="panel-desc">任务评论中 @ 了当前用户的记录</p>
            </div>
          </div>

          <el-scrollbar class="mention-scroll">
            <div v-if="!mentionedTasks.length" class="mention-empty">暂无 @ 提及</div>
            <div
              v-for="item in mentionedTasks"
              :key="`${item.task_id}-${item.comment_id}`"
              class="mention-item"
              @click="goToTask(item.project_id, item.task_id)"
            >
              <div class="mention-item__head">
                <span class="mention-item__task">{{ item.task_name }}</span>
                <el-tag size="small" :type="taskStatusTagType(item.task_status)">{{ item.task_status }}</el-tag>
              </div>
              <div class="mention-item__meta">
                <span>{{ item.project_name || '—' }}</span>
                <span v-if="item.comment_user_name">{{ item.comment_user_name }} 提及了你</span>
              </div>
              <p class="mention-item__content">{{ item.comment_content }}</p>
              <div class="mention-item__foot">
                <span>{{ formatDateTime(item.comment_created_at) || '—' }}</span>
                <span v-if="item.planned_end_date">截止 {{ formatDateOnly(item.planned_end_date) }}</span>
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.dashboard-yilu {
  padding: 4px 0 20px;
}

.mgb20 {
  margin-bottom: 20px;
}

:deep(.stat-card-body) {
  display: flex;
  align-items: center;
  height: 100px;
  padding: 0;
}

.stat-card-content {
  flex: 1;
  text-align: center;
  font-size: 14px;
  color: #999;
  padding: 0 20px;
}

.stat-card-num {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
}

.stat-card-icon {
  font-size: 50px;
  width: 100px;
  height: 100px;
  text-align: center;
  line-height: 100px;
  color: #fff;
  flex-shrink: 0;
}

.bg1 { background: #2d8cf0; }
.bg2 { background: #64d572; }
.bg3 { background: #f25e43; }
.bg4 { background: #e9a745; }
.color1 { color: #2d8cf0; }
.color2 { color: #64d572; }
.color3 { color: #f25e43; }
.color4 { color: #e9a745; }

.panel-card {
  min-height: 520px;
}

.panel-card--mentions {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 18px;
  font-weight: bold;
  margin: 0 0 4px;
}

.panel-desc {
  font-size: 13px;
  color: #999;
  margin: 0;
}

.task-table {
  width: 100%;
}

.task-link {
  color: var(--el-color-primary);
  cursor: pointer;
}

.is-overdue {
  color: var(--el-color-danger);
  font-weight: 500;
}

.mention-scroll {
  height: 440px;
}

.mention-empty {
  text-align: center;
  color: #999;
  padding: 48px 0;
  font-size: 14px;
}

.mention-item {
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.mention-item__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.mention-item__task {
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.mention-item__content {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.mention-item__foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #aaa;
}
</style>
