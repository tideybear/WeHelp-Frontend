<script setup>
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import {
  getPrivateAccountTransactionsListAPI,
  getPrivateAccountAmountSummaryAPI,
  deletePrivateAccountTransactionAPI,
  createPrivateAccountTransactionAPI,
} from '@/apis/fin'
import {
  PRIVATE_ACCOUNT_LIST_COLUMNS,
  pushPrivateAccountDetailRoute,
} from './recordLoader'
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import CopyableCell from '@/components/CopyableCell.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ListActions from '@/components/ListActions.vue'
import { formatDateTime } from '@/utils/formatDate'
import { BUSINESS_TYPE_OPTIONS } from '@/constants/privateAccount'

const router = useRouter()

defineOptions({ name: 'PrivateAccountTransactionsList' })

defineProps({
  /** 与父级 Finance / BankStatements 一致，预留按空间过滤（列表内仍读 menuStore） */
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const menuStore = useMenu()
const userStore = useUserStore()

const dataList = ref([])
const expectedApprovedSignedTotal = ref(0)
const actualSettledSignedTotal = ref(0)
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(100)
const total = ref(0)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

/** 筛选项（与详情页枚举一致） */
const DIRECTION_OPTIONS = ['收入', '支出']
const COUNTERPARTY_TYPE_OPTIONS = ['客户', '供应商', '员工', '股东', '其他']
const FUND_STATUS_OPTIONS = ['已收', '未收', '已付', '未付','已核销', '未核销']
const APPROVAL_STATUS_OPTIONS = ['待审批', '已通过', '已驳回']
const RECONCILIATION_STATUS_OPTIONS = ['未对账', '已对账']
const APPROVAL_PASSED = '已通过'
const FUND_STATUS_SETTLED = new Set(['已收', '已付', '已核销'])
const ACCOUNT_TYPE_OPTIONS = ['微信', '支付宝', '银行卡', '现金', '其他']
const REIMBURSEMENT_BUSINESS_TYPE = '报销'
const DEFAULT_DIRECTION = '支出'

/** 与详情页一致：部分业务类型固定收支 */
const BUSINESS_TYPE_FIXED_RULES = {
  报销: { direction: '支出', fundStatus: '未核销', lockDirection: true, lockAmount: true },
  工资: { direction: '支出', fundStatus: '未付', lockDirection: true },
}

function getBusinessTypeRule(businessType) {
  return BUSINESS_TYPE_FIXED_RULES[String(businessType ?? '').trim()] ?? null
}

function resolveFundStatusByDirection(direction) {
  return String(direction ?? DEFAULT_DIRECTION).trim() === '收入' ? '未收' : '未付'
}

function getEffectiveDirectionAndFundStatus(businessType, direction) {
  const rule = getBusinessTypeRule(businessType)
  if (rule) {
    return { direction: rule.direction, fundStatus: rule.fundStatus }
  }
  const dir = String(direction ?? DEFAULT_DIRECTION).trim() === '收入' ? '收入' : '支出'
  return { direction: dir, fundStatus: resolveFundStatusByDirection(dir) }
}

const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref()
const createBusinessTypeSelectRef = ref()
const createDirectionSelectRef = ref()
const createCounterpartyTypeSelectRef = ref()
const createAccountTypeSelectRef = ref()
const createApproverSelectRef = ref()
const createOperatorSelectRef = ref()

function formatNowDateTime() {
  const dt = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`
}

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

function currentOperatorName() {
  return resolveUserDisplayName(userStore.userInfo?.id) || String(userStore.userInfo?.account || '').trim()
}

/** 当前空间 is_finance_professional=1 的用户，作为新建私账可选经办人/审批人 */
const financeProfessionalOptions = computed(() =>
  (userStore.userList || [])
    .filter((u) => Number(u.is_finance_professional) === 1)
    .map((u) => {
      const label = String(u.name || u.account || '').trim()
      return label ? { id: u.id, label, value: label } : null
    })
    .filter(Boolean),
)

function defaultOperatorName() {
  const current = currentOperatorName()
  if (current && financeProfessionalOptions.value.some((o) => o.value === current)) {
    return current
  }
  return financeProfessionalOptions.value[0]?.value ?? ''
}

function defaultApproverName() {
  return financeProfessionalOptions.value[0]?.value ?? ''
}

function isReimbursementBusinessType(businessType) {
  return String(businessType ?? '').trim() === REIMBURSEMENT_BUSINESS_TYPE
}

function applyBusinessTypeSideEffects(form = createForm.value) {
  const rule = getBusinessTypeRule(form.business_type)
  if (rule) {
    form.direction = rule.direction
    form.fund_status = rule.fundStatus
    if (rule.lockAmount) {
      form.amount = '0'
    }
    return
  }
  if (form.amount === '0' || form.amount === 0) {
    form.amount = ''
  }
  form.direction = DEFAULT_DIRECTION
  form.fund_status = resolveFundStatusByDirection(form.direction)
}

function closeSelectDropdown(selectRef) {
  nextTick(() => {
    selectRef.value?.blur?.()
  })
}

function onCreateBusinessTypeChange() {
  applyBusinessTypeSideEffects()
  closeSelectDropdown(createBusinessTypeSelectRef)
}

function onCreateDirectionChange() {
  const rule = getBusinessTypeRule(createForm.value.business_type)
  if (!rule) {
    createForm.value.fund_status = resolveFundStatusByDirection(createForm.value.direction)
  }
  closeSelectDropdown(createDirectionSelectRef)
}

function onCreateSelectPicked(selectRef) {
  closeSelectDropdown(selectRef)
}

function defaultCreateForm() {
  const operator = defaultOperatorName()
  const form = {
    business_date: formatNowDateTime(),
    amount: '',
    direction: '支出',
    account_type: '微信',
    actual_object: '',
    account_bank: '',
    counterparty_name: '',
    counterparty_type: '其他',
    counterparty_account: '',
    business_type: '货款',
    business_desc: '',
    fund_status: '未付',
    operator,
    approver: defaultApproverName(),
    remark: '',
    created_by: operator || '系统',
  }
  applyBusinessTypeSideEffects(form)
  return form
}

const createForm = ref(defaultCreateForm())

const isCreateReimbursement = computed(() =>
  isReimbursementBusinessType(createForm.value.business_type),
)

const isCreateDirectionLocked = computed(
  () => getBusinessTypeRule(createForm.value.business_type)?.lockDirection === true,
)

const createRules = {
  business_date: [{ required: true, message: '请选择业务日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  direction: [{ required: true, message: '请选择收支', trigger: 'change' }],
  account_type: [{ required: true, message: '请选择账户类型', trigger: 'change' }],
  actual_object: [{ required: true, message: '请输入实际对象', trigger: 'blur' }],
  counterparty_name: [{ required: true, message: '请输入对方名称', trigger: 'blur' }],
  counterparty_account: [{ required: true, message: '请输入对方账号', trigger: 'blur' }],
  business_type: [{ required: true, message: '请选择业务类型', trigger: 'change' }],
  fund_status: [{ required: true, message: '请选择资金状态', trigger: 'change' }],
  operator: [{ required: true, message: '请选择经办人', trigger: 'change' }],
  approver: [{ required: true, message: '请选择审批人', trigger: 'change' }],
}

const filters = ref({
  business_desc: '',
  counterparty_name: '',
  business_date_range: null,
  counterparty_type: '',
  direction: '',
  business_type: '',
  fund_status: '',
  approval_status: '',
})

function buildFilterParams() {
  const out = {}
  const f = filters.value
  for (const [key, val] of Object.entries(f)) {
    if (key === 'business_date_range') continue
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s) out[key] = s
  }
  const range = f.business_date_range
  if (Array.isArray(range) && range.length === 2) {
    const [from, to] = range
    if (from) out.business_date_from = from
    if (to) out.business_date_to = to
  }
  return out
}

/** 资金与审批核心列（与 private_account_transactions 表对齐） */
const columns = PRIVATE_ACCOUNT_LIST_COLUMNS

function directionTagType(dir) {
  const s = String(dir ?? '').trim()
  if (s === '收入') return 'success'
  if (s === '支出') return 'danger'
  return 'info'
}

function approvalTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已通过') return 'success'
  if (s === '已驳回') return 'danger'
  return 'warning'
}

function fundTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已收' || s === '已付' || s === '已核销') return 'success'
  if (s === '未收' || s === '未付' || s === '未核销') return 'warning'
  return 'info'
}

function reconciliationTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已对账') return 'success'
  if (s === '未对账') return 'warning'
  return 'info'
}

function formatAmountTotal(total) {
  return Number(total).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMoneyCell(val, maxFractionDigits = 2) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(n)) {
    const s = String(val ?? '').trim()
    return s || '—'
  }
  const maxFd = Math.max(0, Math.min(Number(maxFractionDigits) || 2, 8))
  const minFd = Math.min(2, maxFd)
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: minFd,
    maximumFractionDigits: maxFd,
  })
}

const expectedFundTotalText = computed(() => formatAmountTotal(expectedApprovedSignedTotal.value))
const actualFundTotalText = computed(() => formatAmountTotal(actualSettledSignedTotal.value))

async function fetchAmountSummary(namespaceId, filterParams = {}) {
  if (namespaceId == null || namespaceId === '') {
    expectedApprovedSignedTotal.value = 0
    actualSettledSignedTotal.value = 0
    return
  }
  try {
    const res = await getPrivateAccountAmountSummaryAPI(namespaceId, filterParams)
    if (res?.code !== 200) {
      expectedApprovedSignedTotal.value = 0
      actualSettledSignedTotal.value = 0
      return
    }
    const expected = Number(res?.data?.expected_signed_total)
    const actual = Number(res?.data?.actual_signed_total)
    expectedApprovedSignedTotal.value = Number.isFinite(expected) ? expected : 0
    actualSettledSignedTotal.value = Number.isFinite(actual) ? actual : 0
  } catch (error) {
    console.error('获取私账金额合计失败:', error)
    expectedApprovedSignedTotal.value = 0
    actualSettledSignedTotal.value = 0
  }
}

async function fetchDataList(page = 1, size = 100) {
  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    expectedApprovedSignedTotal.value = 0
    actualSettledSignedTotal.value = 0
    return
  }
  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)
  try {
    const filterParams = buildFilterParams()
    const [res] = await Promise.all([
      getPrivateAccountTransactionsListAPI(ns, page, size, filterParams),
      fetchAmountSummary(ns, filterParams),
    ])
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取私账列表失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (error) {
    console.error('获取私账往来列表失败:', error)
    dataList.value = []
    total.value = 0
    expectedApprovedSignedTotal.value = 0
    actualSettledSignedTotal.value = 0
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
    business_desc: '',
    counterparty_name: '',
    business_date_range: null,
    counterparty_type: '',
    direction: '',
    business_type: '',
    fund_status: '',
    approval_status: '',
  }
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

async function openCreateDialog() {
  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }
  try {
    await userStore.fetchUserList(ns)
  } catch (e) {
    console.error('获取用户列表失败:', e)
  }
  createForm.value = defaultCreateForm()
  if (!financeProfessionalOptions.value.length) {
    ElMessage.warning('当前空间暂无财务专业人员（is_finance_professional=1），请先配置')
  }
  createDialogVisible.value = true
  nextTick(() => createFormRef.value?.clearValidate())
}

function closeCreateDialog() {
  createDialogVisible.value = false
}

async function submitCreateForm() {
  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch {
    return
  }

  const f = createForm.value
  const isReimbursement = isReimbursementBusinessType(f.business_type)
  const { direction, fundStatus } = getEffectiveDirectionAndFundStatus(
    f.business_type,
    f.direction,
  )
  f.direction = direction
  f.fund_status = fundStatus
  if (isReimbursement) {
    f.amount = '0'
  }
  const counterpartyAccount = String(f.counterparty_account ?? '').trim()
  const data = {
    business_date: f.business_date,
    amount: isReimbursement ? '0' : f.amount,
    direction,
    account_type: f.account_type,
    account_name: counterpartyAccount,
    actual_object: f.actual_object,
    counterparty_name: f.counterparty_name,
    counterparty_type: f.counterparty_type,
    counterparty_account: counterpartyAccount,
    business_type: f.business_type,
    fund_status: fundStatus,
    operator: f.operator || defaultOperatorName(),
    approver: f.approver || defaultApproverName(),
    created_by: f.created_by || currentOperatorName() || '系统',
  }
  const optionalKeys = ['account_bank', 'business_desc', 'remark']
  for (const key of optionalKeys) {
    const v = String(f[key] ?? '').trim()
    if (v) data[key] = v
  }

  createSubmitting.value = true
  try {
    const res = await createPrivateAccountTransactionAPI({
      namespace_id: ns,
      data,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '新增失败')
      return
    }
    ElMessage.success(res?.msg || '新增成功')
    closeCreateDialog()
    currentPage.value = 1
    await fetchDataList(1, pageSize.value)
  } catch (e) {
    console.error('新增私账往来失败:', e)
    const msg = e?.response?.data?.msg || '新增失败，请稍后重试'
    ElMessage.error(msg)
  } finally {
    createSubmitting.value = false
  }
}

watch(
  () => createForm.value.business_type,
  () => {
    applyBusinessTypeSideEffects()
  },
)

watch(
  () => createForm.value.direction,
  () => {
    if (!getBusinessTypeRule(createForm.value.business_type)) {
      createForm.value.fund_status = resolveFundStatusByDirection(createForm.value.direction)
    }
  },
)

watch(
  () => menuStore.currentNamespaceId,
  (newId) => {
    if (newId != null && newId !== '') {
      fetchDataList(currentPage.value, pageSize.value)
    } else {
      dataList.value = []
      total.value = 0
      expectedApprovedSignedTotal.value = 0
      actualSettledSignedTotal.value = 0
    }
  },
)

onMounted(() => {
  if (menuStore.currentNamespaceId) {
    fetchDataList(currentPage.value, pageSize.value)
  }
})

function isRowViewOnly(row) {
  const approval = String(row?.approval_status ?? '').trim()
  const fund = String(row?.fund_status ?? '').trim()
  return approval === APPROVAL_PASSED && FUND_STATUS_SETTLED.has(fund)
}

async function openRowDetail(index) {
  const rowIndex = Number(index)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

  const cached = dataList.value[rowIndex]
  const rowId = cached?.id
  if (rowId == null || rowId === '') {
    ElMessage.warning('缺少记录 id，无法打开详情')
    return
  }

  const ns = menuStore.currentNamespaceId
  try {
    await pushPrivateAccountDetailRoute(router, ns, cached, columns)
  } catch (e) {
    console.error('打开私账详情失败:', e)
    ElMessage.error(e?.message || e?.response?.data?.msg || '获取记录失败')
  }
}

function editRow(index) {
  openRowDetail(index)
}

function viewRow(index) {
  openRowDetail(index)
}

async function deleteRow(index) {
  const rowIndex = Number(index)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('缺少项目空间，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm('确认删除该条私账往来记录？删除后列表中将不再显示。', '提示', {
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
    const res = await deletePrivateAccountTransactionAPI({
      namespace_id: ns,
      id: recordId,
    })
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
    console.error('删除私账往来失败:', e)
  }
}
</script>

<template>
  <div class="private-account-tx-page">
    <div class="list-container">
      <div class="filter-container">
        <el-form class="filter-form" :inline="true" @submit.prevent="handleSearch">
          <el-form-item label="业务事由">
            <el-input
              v-model="filters.business_desc"
              placeholder="关键词模糊搜索"
              clearable
              class="filter-input-business-desc"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="对方名称">
            <el-input
              v-model="filters.counterparty_name"
              placeholder="关键词模糊搜索"
              clearable
              class="filter-input-business-desc"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="业务日期">
            <el-date-picker
              v-model="filters.business_date_range"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              clearable
              class="filter-date-range"
            />
          </el-form-item>
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
          <el-form-item label="资金状态">
            <el-select
              v-model="filters.fund_status"
              placeholder="全部"
              clearable
              filterable
              class="filter-select"
            >
              <el-option
                v-for="opt in FUND_STATUS_OPTIONS"
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
              filterable
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
        </el-form>
        <div class="filter-toolbar">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleResetFilters">重置</el-button>
          <el-button
            class="filter-add-btn"
            type="primary"
            circle
            aria-label="新增私账往来"
            @click="openCreateDialog"
          >
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
      </div>
      <div class="table-container">
        <div class="table-main">
          <el-table
            ref="tableRef"
            :data="dataList"
            style="width: 100%"
            height="100%"
            v-loading="loading"
            element-loading-text="加载中…"
            class="private-account-list-table"
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
              <template v-if="col.prop === 'direction'">
                <el-tag size="small" :type="directionTagType(scope.row?.direction)" effect="plain">
                  {{ scope.row?.direction ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'approval_status'">
                <el-tag size="small" :type="approvalTagType(scope.row?.approval_status)" effect="plain">
                  {{ scope.row?.approval_status ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'fund_status'">
                <el-tag size="small" :type="fundTagType(scope.row?.fund_status)" effect="plain">
                  {{ scope.row?.fund_status ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'reconciliation_status'">
                <el-tag
                  size="small"
                  :type="reconciliationTagType(scope.row?.reconciliation_status)"
                  effect="plain"
                >
                  {{ scope.row?.reconciliation_status || '未对账' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'is_bookkept'">
                <el-tag
                  size="small"
                  :type="Number(scope.row?.is_bookkept) === 1 ? 'success' : 'info'"
                  effect="plain"
                >
                  {{ Number(scope.row?.is_bookkept) === 1 ? '是' : '否' }}
                </el-tag>
              </template>
              <CopyableCell
                v-else-if="col.prop === 'business_date'"
                :value="formatDateTime(scope.row?.business_date) || '—'"
              />
              <CopyableCell
                v-else-if="col.prop === 'amount'"
                :value="formatMoneyCell(scope.row?.[col.prop], 2)"
              />
              <CopyableCell
                v-else-if="col.prop === 'balance'"
                :value="formatMoneyCell(scope.row?.[col.prop], 4)"
              />
              <CopyableCell v-else :value="scope.row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column
            fixed="right"
            label="操作"
            width="150">
            <template #default="scope">
              <ListActions
                :row="scope.row"
                :rowIndex="scope.$index"
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
        <div class="private-table-summaries">
          <div class="private-table-summary">
            <span class="private-table-summary__label">预计资金合计</span>
            <span class="private-table-summary__amount">{{ expectedFundTotalText }}</span>
            <span class="private-table-summary__balance-spacer" aria-hidden="true" />
            <span class="private-table-summary__ops-spacer" aria-hidden="true" />
          </div>
          <div class="private-table-summary">
            <span class="private-table-summary__label">实际资金合计</span>
            <span class="private-table-summary__amount">{{ actualFundTotalText }}</span>
            <span class="private-table-summary__balance-spacer" aria-hidden="true" />
            <span class="private-table-summary__ops-spacer" aria-hidden="true" />
          </div>
        </div>
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

    <el-dialog
      v-model="createDialogVisible"
      title="新增私账申请"
      width="720px"
      destroy-on-close
      @closed="closeCreateDialog"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="96px"
        class="create-form"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="业务日期" prop="business_date">
              <el-date-picker
                v-model="createForm.business_date"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="选择日期时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">

            <el-form-item label="对方类型">
              <el-select
                ref="createCounterpartyTypeSelectRef"
                v-model="createForm.counterparty_type"
                style="width: 100%"
                @change="onCreateSelectPicked(createCounterpartyTypeSelectRef)"
              >
                <el-option
                  v-for="opt in COUNTERPARTY_TYPE_OPTIONS"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务类型" prop="business_type">
              <el-select
                ref="createBusinessTypeSelectRef"
                v-model="createForm.business_type"
                filterable
                style="width: 100%"
                @change="onCreateBusinessTypeChange"
              >
                <el-option
                  v-for="opt in BUSINESS_TYPE_OPTIONS"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="资金状态" prop="fund_status">
              <el-input v-model="createForm.fund_status" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
           
            <el-form-item label="实际对象" prop="actual_object">
              <el-input v-model="createForm.actual_object" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
          </el-col>
          <el-col :span="12">
            <el-form-item label="账户类型" prop="account_type">
              <el-select
                ref="createAccountTypeSelectRef"
                v-model="createForm.account_type"
                style="width: 100%"
                @change="onCreateSelectPicked(createAccountTypeSelectRef)"
              >
                <el-option
                  v-for="opt in ACCOUNT_TYPE_OPTIONS"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开户行">
              <el-input v-model="createForm.account_bank" placeholder="银行卡可填" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="对方名称" prop="counterparty_name">
              <el-input v-model="createForm.counterparty_name" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
           
          
            <el-form-item label="对方账号" prop="counterparty_account">
              <el-input v-model="createForm.counterparty_account" clearable />
            </el-form-item>



          </el-col>
          <el-col :span="12">
            <el-form-item label="收支" prop="direction">
              <el-select
                v-if="!isCreateDirectionLocked"
                ref="createDirectionSelectRef"
                v-model="createForm.direction"
                placeholder="请选择收支"
                style="width: 100%"
                @change="onCreateDirectionChange"
              >
                <el-option
                  v-for="opt in DIRECTION_OPTIONS"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
              <el-input
                v-else
                :model-value="createForm.direction"
                disabled
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="金额(元)" prop="amount">
              <el-input
                v-model="createForm.amount"
                :disabled="isCreateReimbursement"
                :placeholder="isCreateReimbursement ? '报销固定为 0' : '请输入金额'"
                clearable
              />
            </el-form-item>
            
            
          </el-col>
          <el-col :span="12">
            <el-form-item label="经办人" prop="operator">
              <el-select
                ref="createOperatorSelectRef"
                v-model="createForm.operator"
                placeholder="请选择经办人"
                filterable
                clearable
                style="width: 100%"
                :disabled="!financeProfessionalOptions.length"
                @change="onCreateSelectPicked(createOperatorSelectRef)"
              >
                <el-option
                  v-for="opt in financeProfessionalOptions"
                  :key="`operator-${opt.id}`"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审批人" prop="approver">
              <el-select
                ref="createApproverSelectRef"
                v-model="createForm.approver"
                placeholder="请选择审批人"
                filterable
                clearable
                style="width: 100%"
                :disabled="!financeProfessionalOptions.length"
                @change="onCreateSelectPicked(createApproverSelectRef)"
              >
                <el-option
                  v-for="opt in financeProfessionalOptions"
                  :key="`approver-${opt.id}`"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="业务事由">
              <el-input
                v-model="createForm.business_desc"
                type="textarea"
                :rows="2"
                placeholder="选填"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="createForm.remark" type="textarea" :rows="2" placeholder="选填" />
            </el-form-item>
          </el-col>
        </el-row>
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
.private-account-tx-page {
  height: 100%;
  min-height: 0;
}

.list-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filter-container {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background-color: #ffffff;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.filter-add-btn {
  flex: 0 0 auto;
}

.create-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}

.filter-header {
  margin-bottom: 10px;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-right: 12px;
}

.filter-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px 0;

  :deep(.el-form-item) {
    margin-bottom: 8px;
    margin-right: 12px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    color: var(--el-text-color-regular);
    padding-right: 8px;
  }
}

.filter-select {
  width: 128px;
}

.filter-input-business-desc {
  width: 180px;
}

.filter-date-range {
  width: 240px;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.private-table-summaries {
  flex: 0 0 auto;
  border-top: 1px solid var(--el-table-border-color);
  background-color: var(--el-fill-color-lighter);
}

.private-table-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 110px 150px;
  align-items: center;
  min-height: 40px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.private-table-summary + .private-table-summary {
  border-top: 1px solid var(--el-table-border-color);
}

.private-table-summary__label {
  padding-left: 12px;
}

.private-table-summary__amount {
  text-align: right;
  padding-right: 12px;
  font-variant-numeric: tabular-nums;
}

.private-table-summary__balance-spacer {
  width: 110px;
}

.private-table-summary__ops-spacer {
  width: 150px;
}

.pagination-container {
  flex: 0 0 auto;
  padding: 8px 0 0;
  background-color: #fff;
}
</style>
