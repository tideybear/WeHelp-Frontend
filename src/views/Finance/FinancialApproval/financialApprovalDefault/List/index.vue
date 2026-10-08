<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import {
  getPrivateAccountTransactionsListAPI,
  updatePrivateAccountTransactionAPI,
} from '@/apis/fin'
import {
  fetchPrivateAccountTransactionRow,
  buildPrivateAccountDetailQuery,
} from '@/views/Finance/PrivateAccountTransactions/privateAccountTransactionsDefault/List/recordLoader'
import CopyableCell from '@/components/CopyableCell.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import { formatDateTime } from '@/utils/formatDate'
import { BUSINESS_TYPE_OPTIONS } from '@/constants/privateAccount'

defineOptions({ name: 'FinancialApproval' })

const router = useRouter()
const menuStore = useMenu()
const userStore = useUserStore()

const PENDING_APPROVAL_STATUS = '待审批'
const APPROVAL_PASSED = '已通过'
const APPROVAL_REJECTED = '已驳回'

const STATUS_TABS = [
  { key: 'pending', label: '待审批', approvalStatus: PENDING_APPROVAL_STATUS },
  { key: 'passed', label: '已通过', approvalStatus: APPROVAL_PASSED },
  { key: 'rejected', label: '已驳回', approvalStatus: APPROVAL_REJECTED },
  { key: 'all', label: '全部', approvalStatus: '' },
]

const DIRECTION_OPTIONS = ['收入', '支出']
const COUNTERPARTY_TYPE_OPTIONS = ['客户', '供应商', '员工', '股东', '其他']

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(100)
const total = ref(0)
const loading = ref(false)
const activeStatusTab = ref('pending')
const actionRowId = ref(null)
const LOADING_DELAY = 150
let loadingTimer = null

const filters = ref({
  counterparty_type: '',
  direction: '',
  business_type: '',
  keyword: '',
})

const columns = [
  { prop: 'flow_no', label: '流水号', width: 168, showOverflowTooltip: true },
  { prop: 'business_date', label: '业务日期', width: 168, showOverflowTooltip: false },
  { prop: 'business_type', label: '业务类型', width: 96, showOverflowTooltip: false },
  { prop: 'direction', label: '收支', width: 72, showOverflowTooltip: false },
  { prop: 'amount', label: '金额(元)', width: 108, showOverflowTooltip: false },
  { prop: 'counterparty_name', label: '对方名称', width: 120, showOverflowTooltip: true },
  { prop: 'counterparty_type', label: '对方类型', width: 88, showOverflowTooltip: false },
  { prop: 'account_type', label: '账户类型', width: 88, showOverflowTooltip: false },
  { prop: 'business_desc', label: '业务事由', minWidth: 140, showOverflowTooltip: true },
  { prop: 'fund_status', label: '资金状态', width: 88, showOverflowTooltip: false },
  { prop: 'approval_status', label: '审批状态', width: 88, showOverflowTooltip: false },
  { prop: 'operator', label: '经办人', width: 88, showOverflowTooltip: true },
  { prop: 'approver', label: '审批人', width: 88, showOverflowTooltip: true },
  { prop: 'approval_time', label: '审批时间', width: 168, showOverflowTooltip: false },
  { prop: 'reasons_approval_rejection', label: '驳回原因', minWidth: 120, showOverflowTooltip: true },
]

function resolveCurrentUserFinanceProfessionalFlag() {
  const uid = Number(userStore.userInfo?.id)
  if (!Number.isFinite(uid)) return null
  if (userStore.userInfo?.is_finance_professional != null) {
    return Number(userStore.userInfo.is_finance_professional)
  }
  const row = userStore.userList.find((u) => Number(u.id) === uid)
  if (row?.is_finance_professional != null) {
    return Number(row.is_finance_professional)
  }
  return null
}

/** is_finance_professional=1 的财务专业人员可执行审批 */
const canApprove = computed(() => resolveCurrentUserFinanceProfessionalFlag() === 1)

function resolveUserDisplayName(userId) {
  const uid = Number(userId)
  if (!Number.isFinite(uid)) return ''
  const me = userStore.userInfo
  if (Number(me?.id) === uid) {
    return String(me.name || me.account || '').trim()
  }
  const row = userStore.userList.find((u) => Number(u.id) === uid)
  return String(row?.name || row?.account || '').trim()
}

function getCurrentApproverLabel() {
  return (
    resolveUserDisplayName(userStore.userInfo?.id)
    || String(userStore.userInfo?.name || userStore.userInfo?.account || '').trim()
    || '未知'
  )
}

function getCurrentApprovalTimeString() {
  return formatDateTime(new Date())
}

function buildApprovalPatch(nextStatus, extra = {}) {
  const status = String(nextStatus ?? '').trim()
  const patch = {
    approval_status: status,
    approver: getCurrentApproverLabel(),
    approval_time: getCurrentApprovalTimeString(),
    ...extra,
  }
  if (status === APPROVAL_PASSED) {
    patch.reasons_approval_rejection = ''
  }
  return patch
}

function isPendingApproval(row) {
  const s = String(row?.approval_status ?? '').trim()
  return !s || s === PENDING_APPROVAL_STATUS
}

function canActOnRow(row) {
  return canApprove.value && isPendingApproval(row)
}

function buildFilterParams() {
  const out = {}
  for (const [key, val] of Object.entries(filters.value)) {
    if (key === 'keyword') continue
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s) out[key] = s
  }
  const tab = STATUS_TABS.find((t) => t.key === activeStatusTab.value)
  if (tab?.approvalStatus) {
    out.approval_status = tab.approvalStatus
  }
  return out
}

const filteredDataList = computed(() => {
  const kw = String(filters.value.keyword ?? '').trim().toLowerCase()
  if (!kw) return dataList.value
  return dataList.value.filter((row) => {
    const haystack = columns
      .map((col) => {
        const v = row?.[col.prop]
        if (col.prop === 'business_date') return formatDateTime(v)
        return v
      })
      .concat([row?.flow_no, row?.counterparty_account])
      .filter((v) => v != null && String(v).trim() !== '')
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

function directionTagType(dir) {
  const s = String(dir ?? '').trim()
  if (s === '收入') return 'success'
  if (s === '支出') return 'danger'
  return 'info'
}

function approvalTagType(status) {
  const s = String(status ?? '').trim()
  if (s === APPROVAL_PASSED) return 'success'
  if (s === APPROVAL_REJECTED) return 'danger'
  return 'warning'
}

function fundTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已收' || s === '已付' || s === '已核销') return 'success'
  if (s === '未收' || s === '未付' || s === '未核销') return 'warning'
  return 'info'
}

async function fetchDataList(page = 1, size = 100) {
  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    return
  }
  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)
  try {
    const res = await getPrivateAccountTransactionsListAPI(ns, page, size, buildFilterParams())
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取审批列表失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (error) {
    console.error('获取财务审批列表失败:', error)
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

function handleSizeChange(val) {
  pageSize.value = val
  currentPage.value = 1
  fetchDataList(1, val)
}

function handleCurrentChange(val) {
  currentPage.value = val
  fetchDataList(val, pageSize.value)
}

function handleSearch() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

function handleResetFilters() {
  filters.value = {
    counterparty_type: '',
    direction: '',
    business_type: '',
    keyword: '',
  }
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

function onStatusTabChange(key) {
  if (activeStatusTab.value === key) return
  activeStatusTab.value = key
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

async function openRowDetail(row) {
  const rowId = row?.id
  if (rowId == null || rowId === '') {
    ElMessage.warning('缺少记录 id，无法打开详情')
    return
  }
  const ns = menuStore.currentNamespaceId
  try {
    const rowData = (await fetchPrivateAccountTransactionRow(ns, rowId)) ?? row
    router.push({
      name: 'PrivateAccountTransactionsDetail',
      params: { id: String(rowId) },
      query: buildPrivateAccountDetailQuery(rowData, columns, ns),
    })
  } catch (e) {
    console.error('打开私账详情失败:', e)
    ElMessage.error(e?.message || e?.response?.data?.msg || '获取记录失败')
  }
}

async function submitApproval(row, nextStatus, extra = {}) {
  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return false
  }
  const recordId = row?.id
  if (recordId == null || recordId === '') {
    ElMessage.error('缺少记录 id')
    return false
  }
  if (!canApprove.value) {
    ElMessage.warning('当前账号无审批权限（需财务专业人员）')
    return false
  }
  if (!isPendingApproval(row)) {
    ElMessage.warning('当前记录不可审批')
    return false
  }

  actionRowId.value = recordId
  try {
    const res = await updatePrivateAccountTransactionAPI({
      namespace_id: ns,
      id: recordId,
      data: buildApprovalPatch(nextStatus, extra),
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '审批失败')
      return false
    }
    const synced = res?.data?.synced_reimbursement_count
    if (synced != null && Number(synced) > 0) {
      ElMessage.success(`已${nextStatus === APPROVAL_PASSED ? '通过' : '驳回'}，已同步 ${synced} 条关联报销明细`)
    } else {
      ElMessage.success(nextStatus === APPROVAL_PASSED ? '已通过' : '已驳回')
    }
    await fetchDataList(currentPage.value, pageSize.value)
    return true
  } catch (e) {
    console.error('审批操作失败:', e)
    ElMessage.error(e?.response?.data?.msg || '审批失败')
    return false
  } finally {
    actionRowId.value = null
  }
}

async function handleApprove(row) {
  try {
    await ElMessageBox.confirm(
      `确认通过流水「${row?.flow_no || row?.id || ''}」？`,
      '通过确认',
      {
        confirmButtonText: '通过',
        cancelButtonText: '取消',
        type: 'success',
      },
    )
  } catch {
    return
  }
  await submitApproval(row, APPROVAL_PASSED)
}

async function handleReject(row) {
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt('驳回原因', '驳回确认', {
      confirmButtonText: '确定驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请填写驳回原因',
      inputValidator: (val) => {
        if (!String(val ?? '').trim()) return '驳回原因不能为空'
        return true
      },
    })
    reason = String(value ?? '').trim()
  } catch {
    return
  }
  await submitApproval(row, APPROVAL_REJECTED, {
    reasons_approval_rejection: reason,
  })
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
  const ns = menuStore.currentNamespaceId
  if (ns != null && ns !== '') {
    try {
      await userStore.fetchUserList(ns)
    } catch (e) {
      console.error('获取用户列表失败:', e)
    }
    fetchDataList(currentPage.value, pageSize.value)
  }
})
</script>

<template>
  <div class="financial-approval-page">
    <div class="list-container">
      <div class="page-header">
        <h2 class="page-title">财务审批</h2>
        <p v-if="!canApprove" class="page-hint">
          当前账号无审批权限（需财务专业人员 is_finance_professional=1），仅可查看与进入详情。
        </p>
      </div>

      <div class="status-tabs">
        <el-radio-group
          :model-value="activeStatusTab"
          @change="onStatusTabChange"
        >
          <el-radio-button
            v-for="tab in STATUS_TABS"
            :key="tab.key"
            :label="tab.key"
          >
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="filter-container">
        <el-form class="filter-form" :inline="true" @submit.prevent="handleSearch">
          <el-form-item label="对方类型">
            <el-select
              v-model="filters.counterparty_type"
              placeholder="全部"
              clearable
              filterable
              class="filter-select"
            >
              <el-option
                v-for="opt in COUNTERPARTY_TYPE_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="收支">
            <el-select
              v-model="filters.direction"
              placeholder="全部"
              clearable
              class="filter-select"
            >
              <el-option
                v-for="opt in DIRECTION_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="业务类型">
            <el-select
              v-model="filters.business_type"
              placeholder="全部"
              clearable
              filterable
              class="filter-select"
            >
              <el-option
                v-for="opt in BUSINESS_TYPE_OPTIONS"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              placeholder="流水号/对方/事由等"
              clearable
              class="filter-keyword"
              @keyup.enter="handleSearch"
            />
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="table-container">
        <el-table
          ref="tableRef"
          :data="filteredDataList"
          style="width: 100%"
          height="100%"
          v-loading="loading"
          element-loading-text="加载中…"
          row-key="id"
          @row-dblclick="openRowDetail"
        >
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="scope">
              <template v-if="col.prop === 'direction'">
                <el-tag size="small" :type="directionTagType(scope.row?.direction)" effect="plain">
                  {{ scope.row?.direction ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'approval_status'">
                <el-tag
                  size="small"
                  :type="approvalTagType(scope.row?.approval_status)"
                  effect="plain"
                >
                  {{ scope.row?.approval_status || PENDING_APPROVAL_STATUS }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'fund_status'">
                <el-tag size="small" :type="fundTagType(scope.row?.fund_status)" effect="plain">
                  {{ scope.row?.fund_status ?? '—' }}
                </el-tag>
              </template>
              <CopyableCell
                v-else-if="col.prop === 'business_date' || col.prop === 'approval_time'"
                :value="formatDateTime(scope.row?.[col.prop]) || '—'"
              />
              <CopyableCell v-else :value="scope.row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="200" align="left">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  v-if="canActOnRow(row)"
                  type="primary"
                  link
                  size="small"
                  :loading="actionRowId === row.id"
                  @click.stop="handleApprove(row)"
                >
                  通过
                </el-button>
                <el-button
                  v-if="canActOnRow(row)"
                  type="danger"
                  link
                  size="small"
                  :loading="actionRowId === row.id"
                  @click.stop="handleReject(row)"
                >
                  驳回
                </el-button>
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click.stop="openRowDetail(row)"
                >
                  详情
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <PaginationBar
          v-model:currentPage="currentPage"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[50, 100, 200]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.financial-approval-page {
  height: 100%;
  min-height: 0;
  background: #fff;
}

.list-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-header {
  flex: 0 0 auto;
  padding: 12px 12px 0;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.page-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-color-warning);
}

.status-tabs {
  flex: 0 0 auto;
  padding: 10px 12px 0;
}

.filter-container {
  flex: 0 0 auto;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;

  :deep(.el-form-item) {
    margin-bottom: 8px;
    margin-right: 16px;
  }
}

.filter-select {
  width: 140px;
}

.filter-keyword {
  width: 200px;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.pagination-container {
  flex: 0 0 auto;
  padding: 8px 12px 12px;
}
</style>
