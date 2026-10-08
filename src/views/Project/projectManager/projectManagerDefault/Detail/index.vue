<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getProjectTasksAPI } from '@/apis/project'
import { getFinanceReceivablesListAPI } from '@/apis/financeReceivables'
import { getFinanceListNetContractAccount } from '@/utils/financeListDisplay'
import { buildProjectDetailTaskDisplayList } from '@/utils/projectTaskListDisplay'
import { writePersistedTaskTreeSelection } from '@/views/Project/projectTask/projectTaskDefault/composables/useTaskTreeSelectionPersist'
import { useRouter, useRoute } from 'vue-router'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { Setting } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import { canManageProject } from '@/utils/projectPermission'
import ProjectDetailInfoCard from './components/ProjectDetailInfoCard.vue'
import ProjectDetailTaskList from './components/ProjectDetailTaskList.vue'
import ProjectDetailCustomerLedger from './components/ProjectDetailCustomerLedger.vue'
import ProjectDetailSupplierLedger from './components/ProjectDetailSupplierLedger.vue'
import ProjectManageDialog from './components/ProjectManageDialog.vue'


use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, TitleComponent])

const router = useRouter()
const route = useRoute()
const menuStore = useMenu()
const userStore = useUserStore()
const { currentNamespaceId } = storeToRefs(menuStore)
const { userInfo } = storeToRefs(userStore)

const infoCardRef = ref(null)
const rawProjectRow = ref(null)
const manageVisible = ref(false)

const canManage = computed(() => canManageProject(rawProjectRow.value, userInfo.value))

function onDetailLoaded(row) {
  rawProjectRow.value = row
}

function openManageDialog() {
  manageVisible.value = true
}

function onManageSaved() {
  infoCardRef.value?.loadDetail?.()
}

/** 模拟：项目成本构成（万元），分项合计与「项目预算」一致 */
const budgetPieOption = ref({
  title: {
    text: '项目成本构成',
    left: 'center',
    top: 12,
    textStyle: {
      fontSize: 15,
      fontWeight: 600,
      color: '#303133',
    },
  },
  tooltip: {
    trigger: 'item',
    formatter: (params) =>
      `${params.seriesName}<br/>${params.marker}${params.name}：<b>${params.value}</b> 万元（${params.percent}%）`,
  },
  legend: {
    orient: 'vertical',
    left: '4%',
    top: 'middle',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 12,
    textStyle: { fontSize: 12 },
  },
  series: [
    {
      name: '成本',
      type: 'pie',
      radius: ['38%', '62%'],
      center: ['58%', '54%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: {
        formatter: '{b}\n{d}%',
        fontSize: 11,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 12,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.15)',
        },
        label: { show: true },
      },
      data: [
        { value: 3000, name: '材料费', itemStyle: { color: '#5470c6' } },
        { value: 2800, name: '人工费', itemStyle: { color: '#91cc75' } },
        { value: 1500, name: '机械费', itemStyle: { color: '#fac858' } },
        { value: 800, name: '管理费', itemStyle: { color: '#ee6666' } },
        { value: 900, name: '预备费', itemStyle: { color: '#73c0de' } },
      ],
    },
  ],
})

/** 项目财务概览（合同金额为项目应收净合同合计；预算/成本仍为模拟，单位：万元） */
const projectFinance = reactive({
  contractAmount: 0,
  projectBudget: 10000,
  projectCost: 6520,
})

const budgetBalance = computed(
  () => projectFinance.projectBudget - projectFinance.projectCost
)

/** 成本占预算比例（0–100，用于进度条） */
const costBudgetPercent = computed(() => {
  const b = projectFinance.projectBudget
  if (!b) return 0
  return Math.min(100, Math.round((projectFinance.projectCost / b) * 1000) / 10)
})

const formatFinanceWan = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 万元`
}

/** 财务面板列表（用于 v-for；对象直接遍历时 item 为数值，不能用 item.value） */
const financeRows = computed(() => [
  { label: '合同金额', value: projectFinance.contractAmount },
  { label: '项目预算', value: projectFinance.projectBudget },
  { label: '项目成本', value: projectFinance.projectCost },
  { label: '预算结余', value: budgetBalance.value },
  { label: '成本执行率', value: costBudgetPercent.value, rawPercent: true },
])

/** 路由中的项目 id（`/project/detail/:id`） */
const projectId = computed(() => {
  const raw = route.params.id
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

const goBack = () => {
  router.push({ name: 'ProjectList' })
}

const goTaskPage = () => {
  const id = projectId.value
  router.push({
    name: 'ProjectTask',
    query: id != null ? { projectId: String(id) } : {},
  })
}

function goToTaskRecord(row) {
  const id = projectId.value
  const taskId = Number(row?.id)
  if (id == null || !Number.isFinite(taskId) || taskId <= 0) return
  writePersistedTaskTreeSelection(id, taskId)
  router.push({
    name: 'ProjectTask',
    query: { projectId: String(id), taskId: String(taskId) },
  })
}

const taskRowsRaw = ref([])
const taskListLoading = ref(false)
const taskSortField = ref(null)
const taskSortOrder = ref(null)

const taskList = computed(() =>
  buildProjectDetailTaskDisplayList(taskRowsRaw.value, {
    field: taskSortField.value,
    order: taskSortOrder.value,
  }),
)

function onTaskListSortChange(payload) {
  taskSortField.value = payload?.field ?? null
  taskSortOrder.value = payload?.order ?? null
}

async function fetchProjectTasks() {
  const id = projectId.value
  if (id == null) {
    taskRowsRaw.value = []
    return
  }
  taskListLoading.value = true
  try {
    const res = await getProjectTasksAPI({ project_id: id })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取任务列表失败')
      taskRowsRaw.value = []
      return
    }
    taskRowsRaw.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('获取项目任务失败:', e)
    taskRowsRaw.value = []
  } finally {
    taskListLoading.value = false
  }
}

async function fetchProjectFinance() {
  const id = projectId.value
  if (id == null) {
    projectFinance.contractAmount = 0
    return
  }
  try {
    const res = await getFinanceReceivablesListAPI(1, 500, { project_id: id })
    const list = res?.code === 200 && Array.isArray(res.data) ? res.data : []
    const totalYuan = list.reduce(
      (sum, row) => sum + getFinanceListNetContractAccount(row),
      0,
    )
    projectFinance.contractAmount = Math.round((totalYuan / 10000) * 100) / 100
  } catch (e) {
    console.error('获取项目合同金额失败:', e)
    projectFinance.contractAmount = 0
  }
}

watch(projectId, () => {
  fetchProjectTasks()
  fetchProjectFinance()
})

onMounted(() => {
  fetchProjectTasks()
  fetchProjectFinance()
})

</script>

<template>
  <div class="project-detail">
    <el-row justify="center" :gutter="20" class="project-detail__main-row">
      <el-col :span="12">
        <el-row>
          <div class="project-detail__bar">
            <el-button link type="primary" @click="goBack">← 返回列表</el-button>
            <el-tooltip v-if="canManage" content="项目管理" placement="top">
              <el-button
                class="project-detail__manage-btn"
                :icon="Setting"
                circle
                aria-label="项目管理"
                @click="openManageDialog"
              />
            </el-tooltip>
          </div>
          <ProjectDetailInfoCard
            ref="infoCardRef"
            :project-id="projectId"
            :can-edit="canManage"
            @detail-loaded="onDetailLoaded"
          />
        </el-row>
        <el-row :gutter="10" style="margin-top: 1%;max-height: 20%;">
          <el-col :span="15">
            <div class="project-detail__chart-wrap">
              <VChart class="chart project-detail__budget-chart" :option="budgetPieOption" autoresize />
            </div>
          </el-col>
          <el-col :span="9" >
            <div class="project-detail__finance-panel">
              <h4 class="project-detail__finance-title">财务概览</h4>
              <ul class="project-detail__finance-list">
                <li v-for="(row, idx) in financeRows" :key="idx" class="project-detail__finance-list-item">
                  <span class="project-detail__finance-list-label">{{ row.label }}</span>
                  <span class="project-detail__finance-list-value">
                    <template v-if="row.rawPercent">{{ row.value }}%</template>
                    <template v-else>{{ formatFinanceWan(row.value) }}</template>
                  </span>
                </li>
              </ul>
            </div>
          </el-col>
        </el-row>
      </el-col>
      <el-col :span="12" class="project-detail__col-right">
        <ProjectDetailTaskList
          class="project-detail__task-list"
          :tasks="taskList"
          :loading="taskListLoading"
          :sort-field="taskSortField"
          :sort-order="taskSortOrder"
          @primary-click="goTaskPage"
          @sort-change="onTaskListSortChange"
          @task-click="goToTaskRecord"
        />
      </el-col>
    </el-row>

    <el-row :gutter="20" class="project-detail__ledger-row">
      <el-col :span="24">
        <ProjectDetailCustomerLedger
          :project-id="projectId"
          @finance-updated="fetchProjectFinance"
        />
      </el-col>
    </el-row>
    <el-row :gutter="20" class="project-detail__ledger-row">
      <el-col :span="24">
        <ProjectDetailSupplierLedger :project-id="projectId" />
      </el-col>
    </el-row>

    <ProjectManageDialog
      v-model="manageVisible"
      :project-id="projectId"
      :namespace-id="currentNamespaceId"
      :project-row="rawProjectRow"
      @saved="onManageSaved"
    />
  </div>
</template>

<style scoped lang="scss">
.project-detail {
  box-sizing: border-box;
  min-height: 100%;
  background: #f5f7fa;
}

.project-detail__bar {
  width: 100%;
  padding: 1% 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 12px;
}

.project-detail__manage-btn {
  flex-shrink: 0;
}

.project-detail__main-row {
  align-items: stretch;
}

.project-detail__col-right {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-self: stretch;
  min-height: 0;
}

.project-detail__task-list {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.project-detail__ledger-row {
  margin-top: 20px;
}

.project-detail__chart-wrap {
  width: 100%;
  padding: 8px 12px 16px;
  box-sizing: border-box;
  background-color: #ffffff;
}

.project-detail__budget-chart {
  width: 100%;
  height: 300px;
  min-height: 260px;
}

.project-detail__finance-panel {
  box-sizing: border-box;
  height: 100%;
  min-height: 300px;
  padding: 12px 14px 16px;
  background-color: #ffffff;
}

.project-detail__finance-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.project-detail__finance-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.project-detail__finance-list-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.project-detail__finance-list-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.project-detail__finance-list-value {
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: right;
}
</style>
