<script setup>
import {
  getReimbursementDetailsListAPI,
  deleteReimbursementDetailAPI,
  createReimbursementDetailAPI,
} from '@/apis/fin'
import { onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import { useMenu } from '@/stores/menuStore'
import CopyableCell from '@/components/CopyableCell.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ListActions from '@/components/ListActions.vue'
import { formatDateTime } from '@/utils/formatDate'

const router = useRouter()
const userStore = useUserStore()
const menuStore = useMenu()

defineOptions({ name: 'ReimbursementDetailsList' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(100)
const total = ref(0)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

const EXPENSE_TYPE_OPTIONS = [
  '交通', '餐饮', '住宿', '办公用品', '差旅', '招待', '维修', '活动物料', '其他',
]
const APPROVAL_PENDING = '待审批'
const APPROVAL_PASSED = '已通过'
const APPROVAL_REJECTED = '已驳回'
const APPROVAL_PAID = '已支付'
const APPROVAL_STATUS_OPTIONS = [APPROVAL_PENDING, APPROVAL_PASSED, APPROVAL_REJECTED, APPROVAL_PAID]
const PAYMENT_STATUS_OPTIONS = ['待支付', '已支付']
const PAYMENT_PENDING = '待支付'
const PAYMENT_PAID = '已支付'
const FLOW_LINKED_OPTIONS = [
  { label: '是', value: '1' },
  { label: '否', value: '0' },
]

const filters = ref({
  applicant: '',
  expense_type: '',
  approval_status: '',
  payment_status: '',
  is_flow_linked: '',
})

const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref()

function formatTodayDate() {
  const dt = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

function resolveUserDisplayName(userId) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return ''
  const me = userStore.userInfo
  if (Number(me?.id) === uid) {
    return String(me.name || me.user_name || me.username || me.account || '').trim()
  }
  const row = userStore.userList.find((u) => Number(u.id) === uid)
  return String(row?.name || row?.account || '').trim()
}

function currentNamespaceId() {
  const raw = props.namespaceId ?? menuStore.currentNamespaceId
  if (raw == null || raw === '') return null
  const ns = Number(raw)
  return Number.isFinite(ns) ? ns : null
}

async function ensureUserListForApplicant() {
  const ns = currentNamespaceId()
  if (ns == null) return
  if (!userStore.userList?.length) {
    await userStore.fetchUserList(ns).catch(() => {})
  }
}

function currentApplicantName() {
  const fromList = resolveUserDisplayName(userStore.userInfo?.id)
  if (fromList) return fromList
  const me = userStore.userInfo
  return String(me?.name || me?.user_name || me?.username || me?.account || '').trim()
}

function defaultCreateForm() {
  const applicant = currentApplicantName()
  const today = formatTodayDate()
  return {
    applicant,
    apply_date: today,
    expense_date: today,
    expense_type: '其他',
    expense_amount: '',
    expense_desc: '',
    expense_remark: '',
    created_by: applicant || '系统',
  }
}

const createForm = ref(defaultCreateForm())

const createRules = {
  applicant: [{ required: true, message: '请填写申请人', trigger: 'blur' }],
  apply_date: [{ required: true, message: '请选择申请日期', trigger: 'change' }],
  expense_date: [{ required: true, message: '请选择费用发生日期', trigger: 'change' }],
  expense_type: [{ required: true, message: '请选择费用类型', trigger: 'change' }],
  expense_amount: [{ required: true, message: '请填写费用金额', trigger: 'blur' }],
}

/** 列表展示列 */
const columns = [
  { prop: 'detail_no', label: '明细流水号', width: 168, showOverflowTooltip: true },
  { prop: 'applicant', label: '申请人', width: 100, showOverflowTooltip: true },
  { prop: 'expense_date', label: '费用发生日期', width: 120, showOverflowTooltip: false },
  { prop: 'expense_amount', label: '费用金额(元)', width: 120, align: 'right', showOverflowTooltip: false },
  { prop: 'expense_type', label: '费用类型', width: 110, showOverflowTooltip: false },
  { prop: 'approval_status', label: '审批状态', width: 110, showOverflowTooltip: false },
  { prop: 'payment_status', label: '支付状态', width: 110, showOverflowTooltip: false },
  { prop: 'is_invoice_received', label: '已取得发票', width: 110, showOverflowTooltip: false },
  { prop: 'related_flow_no', label: '是否已关联', width: 110, showOverflowTooltip: false },
  { prop: 'expense_desc', label: '费用事由', minWidth: 160, showOverflowTooltip: true },
  { prop: 'expense_remark', label: '详细备注', minWidth: 160, showOverflowTooltip: true },
  
]

function buildFilterParams() {
  const out = {}
  for (const [key, val] of Object.entries(filters.value)) {
    if (key === 'is_flow_linked') continue
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s) out[key] = s
  }
  const linked = String(filters.value.is_flow_linked ?? '').trim()
  if (linked === '1') {
    out.related_flow_no_not_empty = '1'
  } else if (linked === '0') {
    out.related_flow_no_empty = '1'
  }
  return out
}

function formatDateOnly(val) {
  if (val === undefined || val === null || val === '') return '—'
  const d = formatDateTime(val)
  if (!d) return String(val)
  return d.slice(0, 10)
}

function formatInvoiceReceived(val) {
  return Number(val) === 1 ? '是' : '否'
}

function parseExpenseAmount(val) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function formatExpenseAmountTotal(total) {
  return total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 表格底部合计行（当前页费用金额） */
function reimbursementTableSummary({ columns, data }) {
  const sums = []
  const rows = Array.isArray(data) ? data : []
  const pageTotal = rows.reduce((acc, row) => acc + parseExpenseAmount(row?.expense_amount), 0)

  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    if (column.property === 'expense_amount') {
      sums[index] = formatExpenseAmountTotal(pageTotal)
      return
    }
    sums[index] = ''
  })
  return sums
}

function formatFlowLinked(val) {
  return String(val ?? '').trim() ? '是' : '否'
}

function flowLinkedTagType(val) {
  return String(val ?? '').trim() ? 'success' : 'info'
}

function approvalTagType(status) {
  const s = String(status ?? '').trim()
  if (s === APPROVAL_PASSED || s === APPROVAL_PAID) return 'success'
  if (s === APPROVAL_REJECTED) return 'danger'
  return 'warning'
}

function paymentTagType(status) {
  const s = String(status ?? '').trim()
  if (s === PAYMENT_PAID) return 'success'
  if (s === PAYMENT_PENDING) return 'warning'
  return 'info'
}

/** 已支付或审批已通过：仅可查看详情 */
function isRowViewOnly(row) {
  const paymentStatus = String(row?.payment_status ?? '').trim()
  const approvalStatus = String(row?.approval_status ?? '').trim()
  return paymentStatus === PAYMENT_PAID || approvalStatus === APPROVAL_PASSED
}

async function fetchDataList(page = currentPage.value, size = pageSize.value) {
  const ns = currentNamespaceId()
  if (ns == null) {
    dataList.value = []
    total.value = 0
    return
  }

  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)

  try {
    const res = await getReimbursementDetailsListAPI(ns, page, size, buildFilterParams())
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '加载失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) || 0
    currentPage.value = Number(res.page) || page
    pageSize.value = Number(res.page_size) || size
  } catch (e) {
    console.error('加载报销明细失败:', e)
    ElMessage.error(e?.response?.data?.msg || '加载失败')
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

function handleSearch() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

function handleResetFilters() {
  filters.value = {
    applicant: '',
    expense_type: '',
    approval_status: '',
    payment_status: '',
    is_flow_linked: '',
  }
  handleSearch()
}

function handleCurrentChange(page) {
  fetchDataList(page, pageSize.value)
}

function handleSizeChange(size) {
  currentPage.value = 1
  fetchDataList(1, size)
}

watch(
  () => menuStore.currentNamespaceId,
  (newId) => {
    if (newId != null && newId !== '') {
      fetchDataList(currentPage.value, pageSize.value)
    } else {
      dataList.value = []
      total.value = 0
    }
  },
)

onMounted(async () => {
  await ensureUserListForApplicant()
  if (currentNamespaceId() != null) {
    fetchDataList()
  }
})

function openRowDetail(index) {
  const rowIndex = Number(index)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

  const rowData = dataList.value[rowIndex]
  const rowId = rowData?.id
  if (rowId == null || rowId === '') {
    ElMessage.warning('缺少记录 id，无法打开详情')
    return
  }

  router.push({
    name: 'ReimbursementDetailsDetail',
    params: { id: String(rowId) },
    query: {
      id: String(rowId),
      rowData: encodeURIComponent(JSON.stringify(rowData || {})),
      columns: encodeURIComponent(JSON.stringify(columns)),
    },
  })
}

function editRow(index) {
  openRowDetail(index)
}

function viewRow(index) {
  openRowDetail(index)
}

async function openCreateDialog() {
  await ensureUserListForApplicant()
  const applicant = currentApplicantName()
  createForm.value = defaultCreateForm()
  createForm.value.applicant = applicant
  createForm.value.created_by = applicant || '系统'
  createDialogVisible.value = true
  nextTick(() => createFormRef.value?.clearValidate())
}

function closeCreateDialog() {
  createDialogVisible.value = false
}

async function submitCreateForm() {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch {
    return
  }

  const f = createForm.value
  const data = {
    applicant: String(f.applicant ?? '').trim(),
    apply_date: f.apply_date,
    expense_date: f.expense_date,
    expense_type: f.expense_type,
    expense_amount: f.expense_amount,
    created_by: String(f.created_by ?? f.applicant ?? '').trim() || currentApplicantName() || '系统',
  }
  const desc = String(f.expense_desc ?? '').trim()
  if (desc) data.expense_desc = desc
  const remark = String(f.expense_remark ?? '').trim()
  if (remark) data.expense_remark = remark

  const ns = currentNamespaceId()
  if (ns == null) {
    ElMessage.warning('请先选择项目空间')
    return
  }

  try {
    createSubmitting.value = true
    const res = await createReimbursementDetailAPI({ namespace_id: ns, data })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '新增失败')
      return
    }
    ElMessage.success(res?.msg || '新增成功')
    closeCreateDialog()
    currentPage.value = 1
    await fetchDataList(1, pageSize.value)
  } catch (e) {
    console.error('新增报销明细失败:', e)
    ElMessage.error(e?.response?.data?.msg || '新增失败')
  } finally {
    createSubmitting.value = false
  }
}

async function deleteRow(index) {
  const rowIndex = Number(index)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

  try {
    await ElMessageBox.confirm('确认删除该条报销明细？删除后列表中将不再显示。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    ElMessage.info('已取消删除')
    return
  }

  const currentRow = dataList.value[rowIndex]
  const recordId = currentRow?.id
  if (recordId == null || recordId === '') {
    ElMessage.error('缺少记录 id，无法删除')
    return
  }

  try {
    const res = await deleteReimbursementDetailAPI({ id: recordId })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除失败')
      return
    }
    ElMessage.success(res?.msg || '删除成功')
    dataList.value.splice(rowIndex, 1)
    total.value = Math.max(0, total.value - 1)
    if (dataList.value.length === 0 && total.value > 0) {
      await fetchDataList(currentPage.value, pageSize.value)
    } else if (dataList.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1
      await fetchDataList(currentPage.value, pageSize.value)
    }
  } catch (e) {
    console.error('删除报销明细失败:', e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
}
</script>

<template>
  <div class="reimbursement-details-page">
    <div class="list-container">
      <div class="filter-container">
        <el-form class="filter-form" :inline="true" @submit.prevent="handleSearch">
          <el-form-item label="申请人">
            <el-input
              v-model="filters.applicant"
              placeholder="模糊搜索"
              clearable
              class="filter-input"
            />
          </el-form-item>
          <el-form-item label="费用类型">
            <el-select
              v-model="filters.expense_type"
              placeholder="全部"
              clearable
              filterable
              class="filter-select"
            >
              <el-option
                v-for="opt in EXPENSE_TYPE_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="审批状态">
            <el-select
              v-model="filters.approval_status"
              placeholder="全部"
              clearable
              class="filter-select"
            >
              <el-option
                v-for="opt in APPROVAL_STATUS_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="支付状态">
            <el-select
              v-model="filters.payment_status"
              placeholder="全部"
              clearable
              class="filter-select"
            >
              <el-option
                v-for="opt in PAYMENT_STATUS_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="是否已关联">
            <el-select
              v-model="filters.is_flow_linked"
              placeholder="全部"
              clearable
              class="filter-select"
            >
              <el-option
                v-for="opt in FLOW_LINKED_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </el-form-item>
        </el-form>
        <el-button
          type="primary"
          class="filter-add-btn"
          circle
          aria-label="新增报销申请"
          @click="openCreateDialog"
        >
          <el-icon><Plus /></el-icon>
        </el-button>
      </div>
      <div class="table-container">
        <el-table
          ref="tableRef"
          :data="dataList"
          style="width: 100%"
          height="100%"
          v-loading="loading"
          element-loading-text="加载中…"
          show-summary
          :summary-method="reimbursementTableSummary"
        >
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :align="col.align || 'left'"
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="scope">
              <template v-if="col.prop === 'approval_status'">
                <el-tag
                  size="small"
                  :type="approvalTagType(scope.row?.approval_status)"
                  effect="plain"
                >
                  {{ scope.row?.approval_status || APPROVAL_PENDING }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'payment_status'">
                <el-tag
                  size="small"
                  :type="paymentTagType(scope.row?.payment_status)"
                  effect="plain"
                >
                  {{ scope.row?.payment_status ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'is_invoice_received'">
                <el-tag
                  size="small"
                  :type="Number(scope.row?.is_invoice_received) === 1 ? 'success' : 'info'"
                  effect="plain"
                >
                  {{ formatInvoiceReceived(scope.row?.is_invoice_received) }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'related_flow_no'">
                <el-tag
                  size="small"
                  :type="flowLinkedTagType(scope.row?.related_flow_no)"
                  effect="plain"
                >
                  {{ formatFlowLinked(scope.row?.related_flow_no) }}
                </el-tag>
              </template>
              <CopyableCell
                v-else-if="col.prop === 'expense_date'"
                :value="formatDateOnly(scope.row?.expense_date)"
              />
              <CopyableCell v-else :value="scope.row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="scope">
              <ListActions
                :row="scope.row"
                :row-index="scope.$index"
                :view-only="isRowViewOnly(scope.row)"
                @delete="deleteRow"
                @edit="editRow"
                @view="viewRow"
                :edit-enabled="true"
                :delete-enabled="true"
              />
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

    <el-dialog
      v-model="createDialogVisible"
      title="新增报销申请"
      width="520px"
      destroy-on-close
      @closed="closeCreateDialog"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="110px"
        class="create-form"
      >
        <el-form-item label="申请人" prop="applicant">
          <el-input
            v-model="createForm.applicant"
            placeholder="默认当前登录用户，可修改"
            clearable
          />
        </el-form-item>
        <el-form-item label="申请日期" prop="apply_date">
          <el-date-picker
            v-model="createForm.apply_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择申请日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="费用发生日期" prop="expense_date">
          <el-date-picker
            v-model="createForm.expense_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择费用发生日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="费用类型" prop="expense_type">
          <el-select v-model="createForm.expense_type" placeholder="请选择" style="width: 100%">
            <el-option
              v-for="opt in EXPENSE_TYPE_OPTIONS"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="费用金额(元)" prop="expense_amount">
          <el-input v-model="createForm.expense_amount" placeholder="请输入金额" clearable />
        </el-form-item>
        <el-form-item label="费用事由">
          <el-input
            v-model="createForm.expense_desc"
            type="textarea"
            :rows="2"
            placeholder="选填"
          />
        </el-form-item>
        <el-form-item label="详细备注">
          <el-input
            v-model="createForm.expense_remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="选填，补充说明、凭证说明等"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCreateDialog">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="submitCreateForm">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
/* 与 Layout 一致：顶栏 60px + el-main 上下 padding 各 20px */
$layout-main-padding: 20px;
$layout-viewport-offset: 100px;

.reimbursement-details-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: calc(100% + #{$layout-main-padding * 2});
  max-width: calc(100% + #{$layout-main-padding * 2});
  margin: -$layout-main-padding;
  height: calc(100vh - #{$layout-viewport-offset});
  max-height: calc(100vh - #{$layout-viewport-offset});
  min-height: 0;
  overflow: hidden;
  padding: 12px $layout-main-padding 16px;
}

.list-container {
  flex: 1 1 auto;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background-color: #ffffff;
}

.filter-container {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  background-color: #fff;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-add-btn {
  flex: 0 0 auto;
  margin-top: 2px;
}

.create-form {
  padding-right: 8px;
}

.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;

  :deep(.el-form-item) {
    margin-bottom: 8px;
    margin-right: 16px;
  }
}

.filter-input {
  width: 140px;
}

.filter-select {
  width: 140px;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;

  :deep(.el-table__footer-wrapper td) {
    font-weight: 600;
    background-color: var(--el-fill-color-lighter);
  }
}

.pagination-container {
  flex: 0 0 auto;
  padding: 8px 0 0;
  background-color: #fff;
}
</style>
