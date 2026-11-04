<script setup>
import { getFinReimbursementListAPI } from '@/apis/fin'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { Search, Plus } from '@element-plus/icons-vue'
import { useNamespace } from '@/stores/namespaceStore'
import PaginationBar from '@/components/PaginationBar.vue'
import FinReimbursementCreateDialog from './components/FinReimbursementCreateDialog.vue'

defineOptions({ name: 'FinReimbursementListPage' })

const namespaceStore = useNamespace()

// 筛选表单默认值
const emptyFilters = () => ({
  keyword: '',
  applicant: '',
  expense_type: '',
  approval_status: '',
  payment_status: '',
  related_flow_no: '',
  expense_date_from: '',
  expense_date_to: '',
})

const filters = ref(emptyFilters())

const EXPENSE_TYPE_OPTIONS = ['交通', '餐饮', '住宿', '办公用品', '差旅', '招待', '维修', '活动物料', '其他']
const APPROVAL_STATUS_OPTIONS = ['待审批', '已通过', '已驳回', '已支付']
const PAYMENT_STATUS_OPTIONS = ['待支付', '已支付']

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return String(dateStr).split('T')[0]
}

function formatCurrency(val, currency) {
  if (val == null || val === '') return '—'
  const num = Number(val)
  if (isNaN(num)) return '—'
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency || ''} `
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getApprovalTagType(status) {
  switch (status) {
    case '待审批': return 'warning'
    case '已通过': return 'success'
    case '已驳回': return 'danger'
    case '已支付': return 'info'
    default: return 'info'
  }
}

function getPaymentTagType(status) {
  switch (status) {
    case '待支付': return 'warning'
    case '已支付': return 'success'
    default: return 'info'
  }
}

const columns = [
  { prop: 'detail_no', label: '明细编号', width: 150 },
  { prop: 'applicant', label: '申请人', width: 100, align: 'center' },
  { prop: 'applicant_dept', label: '申请部门', width: 110, align: 'center' },
  { prop: 'apply_date', label: '申请日期', width: 110, align: 'center', slot: 'date' },
  { prop: 'expense_date', label: '费用日期', width: 110, align: 'center', slot: 'date' },
  { prop: 'expense_type', label: '费用类型', width: 100, align: 'center' },
  { prop: 'expense_amount', label: '费用金额', width: 120, align: 'right', slot: 'amount' },
  { prop: 'expense_desc', label: '费用说明', minWidth: 180, tooltip: true },
  { prop: 'invoice_type', label: '发票类型', width: 100, align: 'center' },
  { prop: 'invoice_no', label: '发票号码', width: 140 },
  { prop: 'approval_status', label: '审批状态', width: 100, align: 'center', slot: 'approval' },
  { prop: 'approver', label: '审批人', width: 100, align: 'center' },
  { prop: 'approval_time', label: '审批时间', width: 150, align: 'center', slot: 'datetime' },
  { prop: 'payment_status', label: '支付状态', width: 100, align: 'center', slot: 'payment' },
  { prop: 'payment_method', label: '支付方式', width: 100, align: 'center' },
  { prop: 'payment_time', label: '支付时间', width: 150, align: 'center', slot: 'datetime' },
  { prop: 'related_flow_no', label: '关联流水号', width: 150 },
  { prop: 'remark', label: '备注', minWidth: 150, tooltip: true },
]

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

const displayList = computed(() =>
  dataList.value.map((row, index) => ({
    ...row,
    index: (currentPage.value - 1) * pageSize.value + index + 1,
  })),
)

async function fetchDataList(page = 1, size = 50, filterParams = {}) {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    return
  }

  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)

  try {
    const res = await getFinReimbursementListAPI({
      namespace_id: Number(ns),
      page,
      pageSize: size,
      ...filterParams,
    })
    const result = res?.result ?? res
    dataList.value = result?.list ?? result?.data ?? []
    total.value = result?.total ?? dataList.value.length
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (e) {
    console.error('获取报销明细列表失败:', e)
    dataList.value = []
    total.value = 0
  } finally {
    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    loading.value = false
  }
}

function buildFilterParams() {
  const f = filters.value
  const params = {}
  if (f.keyword) params.keyword = f.keyword
  if (f.applicant) params.applicant = f.applicant
  if (f.expense_type) params.expense_type = f.expense_type
  if (f.approval_status) params.approval_status = f.approval_status
  if (f.payment_status) params.payment_status = f.payment_status
  if (f.related_flow_no) params.related_flow_no = f.related_flow_no
  if (f.expense_date_from) params.expense_date_from = f.expense_date_from
  if (f.expense_date_to) params.expense_date_to = f.expense_date_to
  return params
}

function handleSearch() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value, buildFilterParams())
}

function handleResetFilters() {
  filters.value = emptyFilters()
  handleSearch()
}

// 新增报销明细弹窗
const createDialogRef = ref(null)

function openCreateDialog() {
  createDialogRef.value?.open()
}

function handleSizeChange(val) {
  pageSize.value = val
  currentPage.value = 1
  fetchDataList(1, val, buildFilterParams())
}

function handleCurrentChange(val) {
  currentPage.value = val
  fetchDataList(val, pageSize.value, buildFilterParams())
}

onMounted(() => {
  fetchDataList(currentPage.value, pageSize.value)
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    currentPage.value = 1
    fetchDataList(1, pageSize.value, buildFilterParams())
  },
)
</script>

<template>
  <div class="fin-reimbursement-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form class="filter-form" label-position="top" @submit.prevent>
            <el-form-item label="关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="编号/申请人/说明/发票号"
                clearable
                :prefix-icon="Search"
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="申请人">
              <el-input
                v-model="filters.applicant"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="费用类型">
              <el-select
                v-model="filters.expense_type"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in EXPENSE_TYPE_OPTIONS"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="审批状态">
              <el-select
                v-model="filters.approval_status"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in APPROVAL_STATUS_OPTIONS"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="支付状态">
              <el-select
                v-model="filters.payment_status"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in PAYMENT_STATUS_OPTIONS"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关联流水号">
              <el-input
                v-model="filters.related_flow_no"
                placeholder="精确匹配"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="费用日期起">
              <el-date-picker
                v-model="filters.expense_date_from"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="开始日期"
                :clearable="true"
                @change="handleSearch"
              />
            </el-form-item>
            <el-form-item label="费用日期止">
              <el-date-picker
                v-model="filters.expense_date_to"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="结束日期"
                :clearable="true"
                @change="handleSearch"
              />
            </el-form-item>
          </el-form>
        </div>
        <div class="filter-actions">
          <div class="filter-toolbar">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </div>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增报销</el-button>
        </div>
      </div>

      <div class="table-container">
        <el-table
          ref="tableRef"
          class="reimbursement-table"
          :data="displayList"
          style="width: 100%"
          height="100%"
          v-loading="loading"
          element-loading-text="加载中…"
          empty-text="暂无报销明细"
        >
          <el-table-column label="序号" width="60" align="center" fixed>
            <template #default="scope">{{ scope.row.index }}</template>
          </el-table-column>
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :align="col.align || 'left'"
            :show-overflow-tooltip="col.tooltip"
          >
            <template v-if="col.slot === 'date'" #default="scope">
              {{ formatDate(scope.row?.[col.prop]) }}
            </template>

            <template v-else-if="col.slot === 'datetime'" #default="scope">
              {{ scope.row?.[col.prop] || '—' }}
            </template>

            <template v-else-if="col.slot === 'amount'" #default="scope">
              {{ formatCurrency(scope.row?.expense_amount, scope.row?.expense_currency) }}
            </template>

            <template v-else-if="col.slot === 'approval'" #default="scope">
              <el-tag :type="getApprovalTagType(scope.row?.approval_status)" size="small">
                {{ scope.row?.approval_status || '—' }}
              </el-tag>
            </template>

            <template v-else-if="col.slot === 'payment'" #default="scope">
              <el-tag :type="getPaymentTagType(scope.row?.payment_status)" size="small">
                {{ scope.row?.payment_status || '—' }}
              </el-tag>
            </template>

            <template v-else #default="scope">
              {{ scope.row?.[col.prop] ?? '—' }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <PaginationBar
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[50, 100, 200]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 新增报销明细弹窗 -->
    <FinReimbursementCreateDialog ref="createDialogRef" @success="handleSearch" />
  </div>
</template>

<style scoped lang="scss">
.fin-reimbursement-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px 20px 20px;
  background-color: #ffffff;
}

.list-container {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-container {
  flex-shrink: 0;
  margin-bottom: 16px;
  padding: 16px 20px 14px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
}

// 筛选表单：自适应网格平铺，标签在上、控件在下
.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px 16px;

  :deep(.el-form-item) {
    margin-bottom: 0;
    min-width: 0;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    font-size: 13px;
    color: #606266;
    padding-bottom: 2px;
    line-height: 20px;
  }

  // 标签在上时 el-form-item 是 block，控件需撑满网格单元
  :deep(.el-form-item__content) {
    display: block;
  }

  :deep(.el-input),
  :deep(.el-select),
  :deep(.el-date-editor) {
    width: 100%;
  }
}

.filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.filter-toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  padding: 4px 4px 8px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.reimbursement-table) {
    width: 100% !important;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
    --el-table-header-bg-color: #fafafa;
    --el-table-header-text-color: #606266;
    --el-table-row-hover-bg-color: #f5f7fa;
  }

  :deep(.reimbursement-table .el-table__inner-wrapper) {
    width: 100%;
  }

  :deep(.reimbursement-table .el-table__header-wrapper th) {
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.reimbursement-table .el-table__body-wrapper) {
    font-size: 13px;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }
}

.pagination-container {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
</style>
