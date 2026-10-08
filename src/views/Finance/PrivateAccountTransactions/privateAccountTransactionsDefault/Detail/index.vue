<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import {
  updatePrivateAccountTransactionAPI,
  getReimbursementDetailsListAPI,
  linkReimbursementDetailFlowAPI,
  unlinkReimbursementDetailFlowAPI,
} from '@/apis/fin'
import { refreshPrivateAccountDetailRoute } from '../List/recordLoader'
import {
  fetchBankStatementByFlowNo,
  pushBankStatementDetailRoute,
} from '@/views/Finance/BankStatements/bankStatementsDefault/List/recordLoader'
import { formatDateTime } from '@/utils/formatDate'
import { useUserStore } from '@/stores/userStore'
import { useMenu } from '@/stores/menuStore'
import { BUSINESS_TYPE_OPTIONS } from '@/constants/privateAccount'

defineOptions({ name: 'PrivateAccountTransactionsDetail' })

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const menuStore = useMenu()

const DIRECTION_OPTIONS = ['收入', '支出']
const FUND_STATUS_EXPENSE_OPTIONS = ['未付', '已付']
const FUND_STATUS_INCOME_OPTIONS = ['未收', '已收']
const FUND_STATUS_REIMBURSEMENT_OPTIONS = ['未核销', '已核销']
const FUND_STATUS_REIMBURSEMENT_VERIFIED = '已核销'
const REIMBURSEMENT_BUSINESS_TYPE = '报销'
const PAYMENT_PAID = '已支付'
const PAYMENT_PENDING = '待支付'

/** 私账报销关联弹窗表格列（与报销明细列表一致） */
const REIMBURSEMENT_RELATED_COLUMNS = [
  { prop: 'detail_no', label: '明细流水号', width: 168, showOverflowTooltip: true },
  { prop: 'applicant', label: '申请人', width: 100, showOverflowTooltip: true },
  { prop: 'expense_date', label: '费用发生日期', width: 120, showOverflowTooltip: false },
  { prop: 'expense_amount', label: '费用金额(元)', width: 120, showOverflowTooltip: false },
  { prop: 'expense_type', label: '费用类型', width: 110, showOverflowTooltip: false },
  { prop: 'payment_status', label: '支付状态', width: 110, showOverflowTooltip: false },
  { prop: 'is_invoice_received', label: '已取得发票', width: 110, showOverflowTooltip: false },
  { prop: 'expense_desc', label: '费用事由', minWidth: 140, showOverflowTooltip: true },
  { prop: 'expense_remark', label: '详细备注', minWidth: 140, showOverflowTooltip: true },
]

const relatedReimbursementList = ref([])
const unlinkedReimbursementList = ref([])
const unlinkedSearchKeyword = ref('')
const reimbursementListLoading = ref(false)
const unlinkedListLoading = ref(false)
const unlinkedPanelExpanded = ref(true)
const reimbursementPopoverVisible = ref(false)
const reimbursementLinkSavingId = ref(null)
const detailReloading = ref(false)
const relatedFlowNavigating = ref(false)
const ACCOUNT_TYPE_OPTIONS = ['微信', '支付宝', '银行卡', '现金', '其他']
const COUNTERPARTY_TYPE_OPTIONS = ['客户', '供应商', '员工', '股东', '其他']

const PENDING_APPROVAL_STATUS = '待审批'
const APPROVAL_PASSED = '已通过'
const APPROVAL_REJECTED = '已驳回'
const RECONCILIATION_RECONCILED = '已对账'

/** 业务类型固定规则：lockDirection 为 true 时收支不可改 */
const BUSINESS_TYPE_FIXED_RULES = {
  报销: { direction: '支出', fundStatus: '未核销', lockDirection: true },
  工资: { direction: '支出', fundStatus: '未付', lockDirection: true },
}

const DEFAULT_DIRECTION = '支出'
const DEFAULT_FUND_STATUS = '未付'

function getBusinessTypeRule(businessType) {
  return BUSINESS_TYPE_FIXED_RULES[String(businessType ?? '').trim()] ?? null
}

function resolveFundStatusByDirection(direction) {
  return String(direction ?? '').trim() === '收入' ? '未收' : '未付'
}

/** 根据业务类型与当前收支，计算应展示/保存的收支与资金状态 */
function getEffectiveDirectionAndFundStatus(businessType, direction) {
  const rule = getBusinessTypeRule(businessType)
  if (rule) {
    return { direction: rule.direction, fundStatus: rule.fundStatus }
  }
  const dir = String(direction ?? DEFAULT_DIRECTION).trim() === '收入' ? '收入' : '支出'
  return { direction: dir, fundStatus: resolveFundStatusByDirection(dir) }
}
/** 资金状态为以下值时，详情页全部不可修改 */
const FUND_STATUS_LOCK_VALUES = new Set(['已收', '已付', '已核销'])

/** 始终只读，不可修改 */
const ALWAYS_READONLY_PROPS = new Set([
  'id',
  'namespace_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'mapped_company_voucher_no',
  'flow_no',
  'fund_status',
  'approval_status',
  'related_flow_no',
  'operator',
  'approver',
])

/** 可通过「修改」打开日期时间选择器 */
const DATE_EDIT_PROPS = new Set(['business_date'])

/** 可通过「修改」切换为下拉 */
const SELECT_PROPS = new Set([
  'direction',
  'fund_status',
  'is_bookkept',
  'account_type',
  'counterparty_type',
  'business_type',
])

/** 与列表、后端字段对齐，用于无 query.columns 时的默认展示顺序 */
const defaultColumns = [
  { prop: 'id', label: '记录ID' },
  { prop: 'flow_no', label: '流水号' },
  { prop: 'business_date', label: '业务日期' },
  { prop: 'amount', label: '金额(元)' },
  { prop: 'balance', label: '余额(元)' },
  { prop: 'direction', label: '收支' },
  { prop: 'account_type', label: '账户类型' },
  { prop: 'account_name', label: '账户名称' },
  { prop: 'account_holder', label: '持有人' },
  { prop: 'account_bank', label: '开户行' },
  { prop: 'counterparty_name', label: '对方名称' },
  { prop: 'counterparty_type', label: '对方类型' },
  { prop: 'counterparty_account', label: '对方账号' },
  { prop: 'business_type', label: '业务类型' },
  { prop: 'business_desc', label: '业务事由' },
  { prop: 'related_doc_no', label: '关联单号' },
  { prop: 'related_flow_no', label: '关联流水号' },
  { prop: 'company_subject', label: '公司主体' },
  { prop: 'fund_status', label: '资金状态' },
  { prop: 'approval_status', label: '审批状态' },
  { prop: 'bookkeep_date', label: '入账日期' },
  { prop: 'bookkeep_voucher_no', label: '公司凭证号' },
  { prop: 'mapped_company_voucher_no', label: '映射凭证号' },
  { prop: 'operator', label: '经办人' },
  { prop: 'operator_dept', label: '经办部门' },
  { prop: 'approver', label: '审批人' },
  { prop: 'approval_time', label: '审批时间' },
  { prop: 'confirm_time', label: '确认时间' },
  { prop: 'reconciliation_status', label: '对账状态' },
  { prop: 'reconciliation_time', label: '对账时间' },
  { prop: 'reconciliation_remark', label: '对账备注' },
  { prop: 'remark', label: '备注' },
  { prop: 'namespace_id', label: '空间ID' },
  { prop: 'created_by', label: '创建人' },
  { prop: 'created_at', label: '创建时间' },
  { prop: 'updated_by', label: '更新人' },
  { prop: 'updated_at', label: '更新时间' },
]

const columns = computed(() => {
  const raw = route.query.columns
  if (!raw || typeof raw !== 'string') return defaultColumns
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultColumns
    return parsed
  } catch (e) {
    console.error('解析私账列配置失败:', e)
    return defaultColumns
  }
})

const parsedRowData = computed(() => {
  const raw = route.query.rowData
  if (!raw || typeof raw !== 'string') return {}
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch (e) {
    console.error('解析私账详情参数失败:', e)
    return {}
  }
})

const form = ref({})
watch(
  parsedRowData,
  (data) => {
    form.value = { ...(data || {}) }
  },
  { immediate: true, deep: true },
)

const recordId = computed(() => {
  const p = route.params.id
  if (p != null && p !== '') return String(p)
  const q = route.query.id
  return q != null && q !== '' ? String(q) : ''
})

const hasRowPayload = computed(
  () => Object.keys(parsedRowData.value || {}).length > 0,
)

const saving = ref(false)
const approvalSaving = ref(false)
const approvalStatus = ref('')
const previousApproval = ref('')
const editingProp = ref(null)
const editBuffer = ref('')
const editingSelectProp = ref(null)
const editingDateProp = ref(null)
const businessDateEditValue = ref('')

function syncApprovalFromForm() {
  const s = String(form.value?.approval_status ?? '').trim()
  if (s === APPROVAL_PASSED || s === APPROVAL_REJECTED) {
    approvalStatus.value = s
    previousApproval.value = s
  } else {
    approvalStatus.value = ''
    previousApproval.value = ''
  }
}

watch(() => form.value?.approval_status, syncApprovalFromForm, { immediate: true })

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

/** is_finance_professional=0：详情页底部审批区（通过/驳回） */
const isNonFinanceProfessional = computed(
  () => resolveCurrentUserFinanceProfessionalFlag() === 1,
)

const currentApprovalStatus = computed(() => {
  const s = String(form.value?.approval_status ?? '').trim()
  return s || PENDING_APPROVAL_STATUS
})

const isApprovalPassed = computed(() => {
  if (currentApprovalStatus.value === APPROVAL_PASSED) return true
  return approvalStatus.value === APPROVAL_PASSED
})

const isFundSettled = computed(() =>
  FUND_STATUS_LOCK_VALUES.has(String(form.value?.fund_status ?? '').trim()),
)

/** 资金已收/已付/已核销：全部字段不可再改（含业务日期） */
const isFundFullyLocked = computed(() => isFundSettled.value)

/** 审批已通过且资金已完结：仅可撤销（若具备权限） */
const isApprovalCompleted = computed(
  () => isApprovalPassed.value && isFundSettled.value,
)

/** 审批已通过且资金未完结：除资金状态、业务日期外不可改 */
const isContentLockedByApproval = computed(
  () => isApprovalPassed.value && !isFundSettled.value,
)

function isEditableAfterApprovalPassed(prop) {
  if (isFundFullyLocked.value) return false
  if (prop === 'business_date') return true
  if (prop === 'fund_status') return isFundStatusEditable.value
  return false
}

const showApprovalFooter = computed(() => isNonFinanceProfessional.value)
const showApprovalRadios = computed(
  () => showApprovalFooter.value && !isApprovalCompleted.value,
)
const showRevokeButton = computed(() => {
  const reconciliationStatus = String(form.value?.reconciliation_status ?? '').trim()
  return (
    showApprovalFooter.value &&
    isApprovalCompleted.value &&
    reconciliationStatus !== RECONCILIATION_RECONCILED
  )
})

const businessTypeRule = computed(() => getBusinessTypeRule(form.value?.business_type))

const isDirectionLockedByBusinessType = computed(
  () => businessTypeRule.value?.lockDirection === true,
)

const isReimbursement = computed(
  () => String(form.value?.business_type ?? '').trim() === REIMBURSEMENT_BUSINESS_TYPE,
)

/** 报销且审批已通过 */
const isReimbursementApprovalPassed = computed(
  () => isReimbursement.value && isApprovalPassed.value,
)

/** 审批已通过或资金已核销时不展示未关联流水 */
const showUnlinkedReimbursementSection = computed(
  () =>
    isReimbursement.value &&
    !isApprovalPassed.value &&
    String(form.value?.fund_status ?? '').trim() !== FUND_STATUS_REIMBURSEMENT_VERIFIED,
)

/** 报销关联明细：审批已通过后不可添加/移除 */
const canManageReimbursementLink = computed(
  () =>
    isReimbursement.value &&
    !!currentFlowNo.value &&
    !isApprovalPassed.value &&
    !isApprovalCompleted.value,
)

/** 可添加未关联流水 */
const canAddReimbursementLink = computed(
  () => canManageReimbursementLink.value && showUnlinkedReimbursementSection.value,
)

const currentFlowNo = computed(() => String(form.value?.flow_no ?? '').trim())

const relatedFlowNo = computed(() => String(form.value?.related_flow_no ?? '').trim())

const hasRelatedFlowNo = computed(() => relatedFlowNo.value !== '')

/** 审批通过且资金未完结时可改资金状态（不限财务/非财务，与财务审批页通过后的操作一致） */
const isFundStatusEditable = computed(() => {
  if (approvalSaving.value || saving.value) return false
  if (!isApprovalPassed.value) return false
  if (isFundSettled.value) return false
  return true
})

const isPageLocked = computed(() => isFundFullyLocked.value)

function cancelAllEdits() {
  editingProp.value = null
  editingSelectProp.value = null
  editingDateProp.value = null
}

function cancelNonFundEdits() {
  if (editingProp.value != null) editingProp.value = null
  if (editingSelectProp.value != null && editingSelectProp.value !== 'fund_status') {
    editingSelectProp.value = null
  }
}

function cancelEditsExceptFundAndBusinessDate() {
  cancelNonFundEdits()
  if (editingDateProp.value != null && editingDateProp.value !== 'business_date') {
    editingDateProp.value = null
  }
}

watch(isFundFullyLocked, (locked) => {
  if (locked) cancelAllEdits()
})

watch(isContentLockedByApproval, (locked) => {
  if (locked) cancelEditsExceptFundAndBusinessDate()
})

const tableRows = computed(() =>
  columns.value.map((col) => ({
    prop: col.prop,
    header: col.label,
    value: displayCell(col.prop),
  })),
)

function resolveEffectiveDirection() {
  const rule = getBusinessTypeRule(form.value?.business_type)
  if (rule?.direction) return rule.direction
  const dir = String(form.value?.direction ?? '').trim()
  return dir === '收入' ? '收入' : '支出'
}

function resolvePendingFundStatus() {
  if (isReimbursement.value) return '未核销'
  const dir = resolveEffectiveDirection()
  return dir === '收入' ? '未收' : '未付'
}

function fundStatusOptionsByDirection() {
  if (isReimbursement.value) {
    return FUND_STATUS_REIMBURSEMENT_OPTIONS.map((v) => ({ label: v, value: v }))
  }
  const dir = resolveEffectiveDirection()
  const opts = dir === '收入' ? FUND_STATUS_INCOME_OPTIONS : FUND_STATUS_EXPENSE_OPTIONS
  return opts.map((v) => ({ label: v, value: v }))
}

function formatApprovalStatusDisplay() {
  const status = String(form.value?.approval_status ?? '').trim()
  if (status === APPROVAL_REJECTED) {
    const reason = String(form.value?.reasons_approval_rejection ?? '').trim()
    return reason ? `${APPROVAL_REJECTED}：${reason}` : APPROVAL_REJECTED
  }
  if (!status) return '—'
  return status
}

function displayCell(prop) {
  if (prop === 'approval_status') {
    return formatApprovalStatusDisplay()
  }
  if (prop === 'fund_status') {
    const val = form.value?.fund_status
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return val
    }
    if (isFundStatusEditable.value) return '—'
    const { fundStatus } = getEffectiveDirectionAndFundStatus(
      form.value?.business_type,
      form.value?.direction,
    )
    return fundStatus
  }
  const val = form.value?.[prop]
  if (val === undefined || val === null || val === '') return '—'
  if (prop === 'is_bookkept') {
    return Number(val) === 1 ? '是' : '否'
  }
  if (prop === 'business_date') {
    const d = formatDateTime(val)
    return d || '—'
  }
  if (prop === 'amount' && isReimbursement.value) {
    return formatReimbursementAmountDisplay()
  }
  return val
}

function displaySelectCell(prop) {
  if (prop === 'is_bookkept') {
    return Number(form.value?.is_bookkept) === 1 ? '是' : '否'
  }
  return displayCell(prop)
}

function getSelectOptions(prop) {
  switch (prop) {
    case 'direction':
      return DIRECTION_OPTIONS.map((v) => ({ label: v, value: v }))
    case 'fund_status':
      return fundStatusOptionsByDirection()
    case 'is_bookkept':
      return [
        { label: '是', value: 1 },
        { label: '否', value: 0 },
      ]
    case 'account_type':
      return ACCOUNT_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))
    case 'counterparty_type':
      return COUNTERPARTY_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))
    case 'business_type':
      return BUSINESS_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))
    default:
      return []
  }
}

function selectModelValue(prop) {
  if (prop === 'is_bookkept') {
    return Number(form.value?.is_bookkept) === 1 ? 1 : 0
  }
  if (prop === 'fund_status' && isFundStatusEditable.value) {
    const raw = form.value?.fund_status
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return String(raw).trim()
    }
    const { fundStatus } = getEffectiveDirectionAndFundStatus(
      form.value?.business_type,
      form.value?.direction,
    )
    return fundStatus || undefined
  }
  const raw = form.value?.[prop]
  if (raw === undefined || raw === null) return undefined
  const s = String(raw).trim()
  return s === '' ? undefined : s
}

function isSelectProp(prop) {
  return SELECT_PROPS.has(prop)
}

function isFieldAlwaysReadonly(prop) {
  if (isFundFullyLocked.value) return true
  if (isApprovalPassed.value) return !isEditableAfterApprovalPassed(prop)
  if (prop === 'fund_status' && isFundStatusEditable.value) return false
  return ALWAYS_READONLY_PROPS.has(prop)
}

function isAlwaysReadonly(prop) {
  if (isFundFullyLocked.value) return true
  if (isApprovalPassed.value) {
    return !isEditableAfterApprovalPassed(prop)
  }
  if (prop === 'fund_status' && isFundStatusEditable.value) return false
  if (DATE_EDIT_PROPS.has(prop) && !isDateEditable(prop)) return true
  return isFieldAlwaysReadonly(prop) || isPageLocked.value
}

function isSelectEditable(prop) {
  if (isApprovalPassed.value) {
    return prop === 'fund_status' && isFundStatusEditable.value
  }
  if (isPageLocked.value) return false
  if (!isSelectProp(prop)) return false
  if (prop === 'direction' && isDirectionLockedByBusinessType.value) return false
  return true
}

function isDateEditable(prop) {
  if (!DATE_EDIT_PROPS.has(prop)) return false
  if (isFundFullyLocked.value) return false
  if (isApprovalPassed.value) return true
  if (isPageLocked.value) return false
  return true
}

function isTextEditable(prop) {
  if (isApprovalPassed.value) return false
  if (isPageLocked.value) return false
  return !isFieldAlwaysReadonly(prop) && !isSelectProp(prop) && !isDateEditable(prop)
}

function enrichPatchWithPendingApproval(patch) {
  const data = { ...patch }
  const keys = Object.keys(data)
  // 仅改业务日期：不联动审批状态，也不因其它字段规则改写业务日期
  if (keys.length === 1 && keys[0] === 'business_date') {
    return data
  }
  const hasContentChange = Object.keys(data).some(
    (k) => k !== 'approval_status' && k !== 'reasons_approval_rejection',
  )
  if (!hasContentChange) return data
  const cur = String(form.value?.approval_status ?? '').trim()
  if (cur === PENDING_APPROVAL_STATUS) return data
  if (cur === APPROVAL_PASSED || cur === APPROVAL_REJECTED) {
    data.approval_status = PENDING_APPROVAL_STATUS
    if (cur === APPROVAL_REJECTED) {
      data.reasons_approval_rejection = ''
    }
  }
  return data
}

function businessDateModelValue() {
  const val = form.value?.business_date
  if (val === undefined || val === null || val === '') return ''
  return formatDateTime(val) || String(val)
}

function startDateEdit(prop) {
  if (!isDateEditable(prop) || saving.value || approvalSaving.value) return
  editingDateProp.value = prop
  businessDateEditValue.value = businessDateModelValue()
}

function cancelDateEdit() {
  editingDateProp.value = null
  businessDateEditValue.value = ''
}

async function commitBusinessDateEdit() {
  if (editingDateProp.value !== 'business_date') return
  const next = String(businessDateEditValue.value ?? '').trim()
  const prev = businessDateModelValue()
  if (next === prev) {
    cancelDateEdit()
    return
  }
  const snapshot = { ...form.value }
  const ok = await persistUpdates({ business_date: next || null })
  if (!ok) {
    Object.assign(form.value, snapshot)
    businessDateEditValue.value = businessDateModelValue()
    return
  }
  cancelDateEdit()
}

function onBusinessDatePanelVisible(visible) {
  if (visible) return
  if (editingDateProp.value !== 'business_date') return
  commitBusinessDateEdit()
}

function isInsideDateEditor(target) {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.cell-date-edit-wrap') != null ||
    target.closest('.el-picker__popper') != null
  )
}

function startSelectEdit(prop) {
  if (saving.value || approvalSaving.value || !isSelectEditable(prop)) return
  if (prop !== 'fund_status' && isPageLocked.value) return
  editingSelectProp.value = prop
}

function cancelSelectEdit() {
  editingSelectProp.value = null
}

function isInsideSelectEditor(target) {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.cell-select-edit-wrap') != null ||
    target.closest('.pat-detail-select-popper') != null ||
    target.closest('.el-select-dropdown') != null
  )
}

function isFundStatusOnlyPatch(data) {
  const keys = Object.keys(data || {})
  return keys.length === 1 && keys[0] === 'fund_status'
}

/** 非单独改业务日期时，不得把 business_date 带入更新请求 */
function sanitizeUpdatePayload(data) {
  const keys = Object.keys(data || {})
  if (keys.length === 1 && keys[0] === 'business_date') {
    return { ...data }
  }
  const out = { ...data }
  delete out.business_date
  return out
}

async function persistUpdates(data, options = {}) {
  const {
    approvalOnly = false,
    fundStatusOnly = false,
    revokeApproval = false,
    ensureApprovalPassed = false,
    skipDetailReload = false,
  } = options
  let payloadData = sanitizeUpdatePayload(data)
  const onlyFundStatus = fundStatusOnly || isFundStatusOnlyPatch(payloadData)
  if (onlyFundStatus && (ensureApprovalPassed || isApprovalPassed.value)) {
    payloadData = {
      ...payloadData,
      approval_status: APPROVAL_PASSED,
    }
  }
  const preserveApproval = approvalOnly || onlyFundStatus || revokeApproval
  const ns = route.query.namespace_id
  const id = recordId.value
  if (!ns || ns === '' || !id) {
    ElMessage.warning('缺少空间或记录 id，无法保存')
    return false
  }
  if (!approvalOnly && !revokeApproval && isFundFullyLocked.value) {
    ElMessage.warning('资金状态为已收/已付/已核销，记录不可修改')
    return false
  }
  if (onlyFundStatus && !isApprovalPassed.value) {
    ElMessage.warning('仅审批通过后可修改资金状态')
    return false
  }
  if (saving.value || approvalSaving.value) return false

  const payload = preserveApproval
    ? payloadData
    : enrichPatchWithPendingApproval(payloadData)
  const busyRef = approvalOnly || revokeApproval ? approvalSaving : saving
  try {
    busyRef.value = true
    const res = await updatePrivateAccountTransactionAPI({
      namespace_id: ns,
      id,
      data: payload,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '保存失败')
      return false
    }
    if (revokeApproval) {
      ElMessage.success('已撤销，本流水已关联报销明细已恢复为待审批、待支付')
    } else if (approvalOnly) {
      const synced = res?.data?.synced_reimbursement_count
      if (isReimbursement.value && synced != null && Number(synced) > 0) {
        ElMessage.success(`审批状态已更新`)
      } else {
        ElMessage.success('审批状态已更新')
      }
    } else if (onlyFundStatus) {
      ElMessage.success('资金状态已更新')
    } else {
      const synced = res?.data?.synced_reimbursement_count
      const unlinked = res?.data?.unlinked_reimbursement_count
      if (unlinked != null && Number(unlinked) > 0) {
        ElMessage.success('已保存')
      } else if (isReimbursement.value && synced != null && Number(synced) > 0) {
        ElMessage.success('已保存')
      } else {
        ElMessage.success('已保存')
      }
    }
    if (!skipDetailReload) {
      await reloadRecordDetail()
    }
    return true
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
    return false
  } finally {
    busyRef.value = false
  }
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

/** 任意数据变更后：经 List 同源接口拉取记录并写入路由 rowData，刷新详情页 */
async function reloadRecordDetail() {
  if (detailReloading.value) return false
  const ns = route.query.namespace_id
  const id = recordId.value
  if (!ns || ns === '' || !id) return false

  detailReloading.value = true
  try {
    const result = await refreshPrivateAccountDetailRoute(router, id, {
      namespaceId: ns,
      columns: columns.value,
    })
    if (!result.ok) {
      ElMessage.warning(result.msg || '刷新记录失败')
      return false
    }
    const row = result.row
    form.value = { ...row }
    syncApprovalFromForm()
    cancelAllEdits()
    if (isReimbursement.value && currentFlowNo.value) {
      await loadRelatedReimbursements({ silent: true })
      if (showUnlinkedReimbursementSection.value) {
        await loadUnlinkedReimbursements()
      } else {
        unlinkedReimbursementList.value = []
        unlinkedSearchKeyword.value = ''
      }
    } else {
      relatedReimbursementList.value = []
      unlinkedReimbursementList.value = []
    }
    return true
  } finally {
    detailReloading.value = false
  }
}

async function persistApprovalStatus(nextStatus, extra = {}) {
  const status = String(nextStatus ?? '').trim()
  if (status !== APPROVAL_PASSED && status !== APPROVAL_REJECTED) return false
  const patch = buildApprovalPatch(status, extra)
  return persistUpdates(patch, { approvalOnly: true })
}

async function handleRejectApproval() {
  const prev = previousApproval.value
  const prevFormApproval = form.value?.approval_status
  const prevReason = form.value?.reasons_approval_rejection

  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt('驳回原因', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请填写驳回原因',
      inputValidator: (val) => {
        if (!String(val ?? '').trim()) return '驳回备注不能为空'
        return true
      },
    })
    reason = String(value ?? '').trim()
  } catch {
    approvalStatus.value = prev
    return
  }

  cancelNonFundEdits()
  const rejectPatch = buildApprovalPatch(APPROVAL_REJECTED, {
    reasons_approval_rejection: reason,
  })
  form.value = {
    ...form.value,
    ...rejectPatch,
  }
  const ok = await persistApprovalStatus(APPROVAL_REJECTED, {
    reasons_approval_rejection: reason,
  })
  if (!ok) {
    approvalStatus.value = prev
    form.value = {
      ...form.value,
      approval_status: prevFormApproval,
      reasons_approval_rejection: prevReason,
    }
  }
}

async function handleApprovalChange(nextStatus) {
  if (nextStatus === APPROVAL_REJECTED) {
    await handleRejectApproval()
    return
  }

  const prev = previousApproval.value
  const prevFormApproval = form.value?.approval_status
  const prevReason = form.value?.reasons_approval_rejection
  cancelNonFundEdits()
  const approvePatch = buildApprovalPatch(nextStatus)
  form.value = {
    ...form.value,
    ...approvePatch,
  }
  const ok = await persistApprovalStatus(nextStatus)
  if (!ok) {
    approvalStatus.value = prev
    form.value = {
      ...form.value,
      approval_status: prevFormApproval,
      reasons_approval_rejection: prevReason,
    }
  }
}

async function handleRevokeApproval() {
  try {
    await ElMessageBox.confirm(
      '确认撤销审批？',
      '撤销确认',
      {
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  cancelAllEdits()
  const patch = {
    approval_status: PENDING_APPROVAL_STATUS,
    fund_status: resolvePendingFundStatus(),
    reasons_approval_rejection: '',
  }
  await persistUpdates(patch, { revokeApproval: true })
}

async function openRelatedFlowDetail() {
  const flowNo = relatedFlowNo.value
  if (!flowNo || relatedFlowNavigating.value) return

  if (!flowNo.startsWith('GL')) {
    ElMessage.warning('暂不支持跳转该类型关联流水')
    return
  }

  const ns = route.query.namespace_id || menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }

  relatedFlowNavigating.value = true
  try {
    const row = await fetchBankStatementByFlowNo(ns, flowNo)
    if (!row?.id) {
      ElMessage.error('未找到关联银行流水')
      return
    }
    await pushBankStatementDetailRoute(router, ns, row)
  } catch (e) {
    console.error('打开关联银行流水详情失败:', e)
    ElMessage.error(e?.message || e?.response?.data?.msg || '获取关联流水失败')
  } finally {
    relatedFlowNavigating.value = false
  }
}

function buildSelectPatch(prop, val) {
  if (prop === 'is_bookkept') {
    const v = val === 1 || val === '1' ? 1 : 0
    return { is_bookkept: v }
  }
  const next = val === undefined || val === null ? '' : String(val).trim()
  if (prop === 'business_type') {
    const rule = getBusinessTypeRule(next)
    if (rule) {
      return {
        business_type: next,
        direction: rule.direction,
        fund_status: rule.fundStatus,
      }
    }
    return {
      business_type: next,
      direction: DEFAULT_DIRECTION,
      fund_status: DEFAULT_FUND_STATUS,
    }
  }
  if (prop === 'direction') {
    return {
      direction: next,
      fund_status: resolveFundStatusByDirection(next),
    }
  }
  return { [prop]: next }
}

function isSameSelectValue(prop, val) {
  if (prop === 'is_bookkept') {
    const v = val === 1 || val === '1' ? 1 : 0
    return v === (Number(form.value?.is_bookkept) === 1 ? 1 : 0)
  }
  const next = val === undefined || val === null ? '' : String(val).trim()
  const prev =
    form.value?.[prop] === undefined || form.value?.[prop] === null
      ? ''
      : String(form.value[prop]).trim()
  return next === prev
}

async function onSelectChange(prop, val) {
  if (prop === 'direction' && isDirectionLockedByBusinessType.value) {
    cancelSelectEdit()
    return
  }

  if (prop === 'fund_status') {
    const allowed = fundStatusOptionsByDirection().map((o) => o.value)
    const next = val === undefined || val === null ? '' : String(val).trim()
    if (!allowed.includes(next)) {
      ElMessage.warning(
        isReimbursement.value
          ? '报销资金状态仅可选未核销或已核销'
          : '资金状态与当前收支不匹配',
      )
      cancelSelectEdit()
      return
    }
  }

  if (isApprovalPassed.value && !isEditableAfterApprovalPassed(prop)) {
    cancelSelectEdit()
    return
  }

  if (isSameSelectValue(prop, val)) {
    cancelSelectEdit()
    return
  }

  const patch = buildSelectPatch(prop, val)
  const snapshot = { ...form.value }

  const updateOpts = { fundStatusOnly: prop === 'fund_status' }
  if (prop === 'fund_status' && isApprovalPassed.value) {
    updateOpts.ensureApprovalPassed = true
  }
  const ok = await persistUpdates(patch, updateOpts)
  if (!ok) {
    Object.assign(form.value, snapshot)
  }
  cancelSelectEdit()
}

function startEdit(row) {
  if (!isTextEditable(row.prop) || saving.value || approvalSaving.value) return
  editingProp.value = row.prop
  const raw = form.value?.[row.prop]
  editBuffer.value = raw === undefined || raw === null ? '' : String(raw)
  nextTick(() => {
    const el = document.querySelector('.private-tx-edit-cell .el-input__inner')
    el?.focus?.()
  })
}

let commitBusy = false
async function commitEdit() {
  if (commitBusy || editingProp.value == null) return
  const prop = editingProp.value
  const next = editBuffer.value
  const prevRaw = form.value?.[prop]
  const prev = prevRaw === undefined || prevRaw === null ? '' : String(prevRaw)
  if (next === prev) {
    editingProp.value = null
    return
  }
  commitBusy = true
  try {
    const ok = await persistUpdates({ [prop]: next })
    if (ok) editingProp.value = null
  } finally {
    commitBusy = false
  }
}

function handleDocMouseDown(e) {
  const t = e.target
  if (t instanceof Element && t.closest('.private-tx-edit-cell')) return
  if (editingProp.value != null) {
    commitEdit()
    return
  }
  if (editingSelectProp.value != null) {
    if (isInsideSelectEditor(t)) return
    cancelSelectEdit()
  }
  if (editingDateProp.value != null) {
    if (isInsideDateEditor(t)) return
    commitBusinessDateEdit()
  }
}

onMounted(async () => {
  document.addEventListener('mousedown', handleDocMouseDown)
  const ns = route.query.namespace_id || menuStore.currentNamespaceId
  if (ns != null && ns !== '' && !userStore.userList?.length) {
    try {
      await userStore.fetchUserList(ns)
    } catch (e) {
      console.error('加载空间用户权限失败:', e)
    }
  }
  if (recordId.value && ns != null && ns !== '') {
    await reloadRecordDetail()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocMouseDown)
})

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  router.push({ name: 'PrivateAccountTransactions' })
}

function parseReimbursementExpenseAmount(val) {
  if (val === undefined || val === null || val === '') return 0
  const n = Number(String(val).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

const relatedReimbursementAmountSum = computed(() =>
  relatedReimbursementList.value.reduce(
    (sum, row) => sum + parseReimbursementExpenseAmount(row?.expense_amount),
    0,
  ),
)

function formatReimbursementAmountDisplay() {
  if (!currentFlowNo.value) return '0.00'
  if (reimbursementListLoading.value && relatedReimbursementList.value.length === 0) {
    return '加载中…'
  }
  return relatedReimbursementAmountSum.value.toFixed(2)
}

function formatReimbursementDateOnly(val) {
  if (val === undefined || val === null || val === '') return '—'
  const d = formatDateTime(val)
  return d ? d.slice(0, 10) : String(val)
}

function formatReimbursementInvoiceReceived(val) {
  return Number(val) === 1 ? '是' : '否'
}

function reimbursementPaymentTagType(status) {
  const s = String(status ?? '').trim()
  if (s === PAYMENT_PAID) return 'success'
  if (s === PAYMENT_PENDING) return 'warning'
  return 'info'
}

async function loadRelatedReimbursements(options = {}) {
  const { silent = false } = options
  const flowNo = currentFlowNo.value
  if (!flowNo) {
    relatedReimbursementList.value = []
    return
  }
  reimbursementListLoading.value = true
  try {
    const ns = route.query.namespace_id || menuStore.currentNamespaceId
    if (ns == null || ns === '') {
      relatedReimbursementList.value = []
      return
    }
    const res = await getReimbursementDetailsListAPI(ns, 1, 200, {
      related_flow_no: flowNo,
    })
    if (res?.code !== 200) {
      if (!silent) ElMessage.error(res?.msg || '加载已关联报销明细失败')
      relatedReimbursementList.value = []
      return
    }
    relatedReimbursementList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载已关联报销明细失败:', e)
    if (!silent) ElMessage.error(e?.response?.data?.msg || '加载已关联报销明细失败')
    relatedReimbursementList.value = []
  } finally {
    reimbursementListLoading.value = false
  }
}

async function loadUnlinkedReimbursements() {
  if (!showUnlinkedReimbursementSection.value) {
    unlinkedReimbursementList.value = []
    return
  }
  unlinkedListLoading.value = true
  try {
    const ns = route.query.namespace_id || menuStore.currentNamespaceId
    if (ns == null || ns === '') {
      unlinkedReimbursementList.value = []
      return
    }
    const res = await getReimbursementDetailsListAPI(ns, 1, 200, {
      related_flow_no_empty: '1',
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '加载未关联报销明细失败')
      unlinkedReimbursementList.value = []
      return
    }
    unlinkedReimbursementList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载未关联报销明细失败:', e)
    ElMessage.error(e?.response?.data?.msg || '加载未关联报销明细失败')
    unlinkedReimbursementList.value = []
  } finally {
    unlinkedListLoading.value = false
  }
}

function getReimbursementRowSearchText(item) {
  if (!item) return ''
  const parts = REIMBURSEMENT_RELATED_COLUMNS.map((col) => {
    const prop = col.prop
    if (prop === 'payment_status') return String(item.payment_status ?? '')
    if (prop === 'is_invoice_received') return formatReimbursementInvoiceReceived(item.is_invoice_received)
    if (prop === 'expense_date') return formatReimbursementDateOnly(item.expense_date)
    return String(item[prop] ?? '')
  })
  return parts.join(' ').toLowerCase()
}

const filteredUnlinkedReimbursementList = computed(() => {
  const kw = unlinkedSearchKeyword.value.trim().toLowerCase()
  const list = unlinkedReimbursementList.value
  if (!kw) return list
  return list.filter((row) => getReimbursementRowSearchText(row).includes(kw))
})

async function onReimbursementPopoverShow() {
  unlinkedSearchKeyword.value = ''
  if (showUnlinkedReimbursementSection.value) {
    unlinkedPanelExpanded.value = true
    await Promise.all([loadRelatedReimbursements(), loadUnlinkedReimbursements()])
  } else {
    unlinkedReimbursementList.value = []
    await loadRelatedReimbursements()
  }
}

async function refreshReimbursementPopoverLists() {
  await reloadRecordDetail()
}

async function linkReimbursementToCurrentFlow(row) {
  if (!canAddReimbursementLink.value) {
    ElMessage.warning(
      isApprovalPassed.value ? '审批已通过，不可添加关联' : '当前状态不可添加关联',
    )
    return
  }
  const id = row?.id
  const flowNo = currentFlowNo.value
  if (id == null || id === '') {
    ElMessage.warning('缺少报销明细 id')
    return
  }
  if (!flowNo) {
    ElMessage.warning('当前流水号为空，无法关联')
    return
  }
  reimbursementLinkSavingId.value = id
  reimbursementPopoverVisible.value = true
  try {
    const res = await linkReimbursementDetailFlowAPI({
      id,
      related_flow_no: flowNo,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '添加关联失败')
      return
    }
    ElMessage.success('已添加关联')
    await refreshReimbursementPopoverLists()
    reimbursementPopoverVisible.value = true
  } catch (e) {
    console.error('添加报销关联失败:', e)
    ElMessage.error(e?.response?.data?.msg || '添加关联失败')
  } finally {
    reimbursementLinkSavingId.value = null
  }
}

async function unlinkReimbursementFromCurrentFlow(row) {
  if (!canManageReimbursementLink.value) {
    ElMessage.warning(
      isApprovalPassed.value ? '审批已通过，不可移除关联' : '当前状态不可移除关联',
    )
    return
  }
  const id = row?.id
  if (id == null || id === '') {
    ElMessage.warning('缺少报销明细 id')
    return
  }
  reimbursementLinkSavingId.value = id
  reimbursementPopoverVisible.value = true
  try {
    const res = await unlinkReimbursementDetailFlowAPI({
      id,
      related_flow_no: currentFlowNo.value,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '移除关联失败')
      return
    }
    ElMessage.success('已移除关联')
    await refreshReimbursementPopoverLists()
    reimbursementPopoverVisible.value = true
  } catch (e) {
    console.error('移除报销关联失败:', e)
    ElMessage.error(e?.response?.data?.msg || '移除关联失败')
  } finally {
    reimbursementLinkSavingId.value = null
  }
}

function toggleUnlinkedPanel() {
  unlinkedPanelExpanded.value = !unlinkedPanelExpanded.value
}

watch(
  [isReimbursement, currentFlowNo],
  ([reimb, flowNo]) => {
    if (reimb && flowNo) {
      loadRelatedReimbursements({ silent: true })
    } else {
      relatedReimbursementList.value = []
    }
  },
  { immediate: true },
)

function goReimbursementDetail(row) {
  const rowId = row?.id
  if (rowId == null || rowId === '') {
    ElMessage.warning('缺少报销明细 id')
    return
  }
  router.push({
    name: 'ReimbursementDetailsDetail',
    params: { id: String(rowId) },
    query: {
      id: String(rowId),
      rowData: encodeURIComponent(JSON.stringify(row || {})),
      columns: encodeURIComponent(JSON.stringify(REIMBURSEMENT_RELATED_COLUMNS)),
    },
  })
}
</script>

<template>
  <div class="detail-page">
    <div class="detail-header-row">
      <div class="detail-header-left">
        <div class="detail-header">私账往来详情</div>
        <el-tag v-if="isFundFullyLocked" type="info" size="small" effect="plain" class="lock-tag">
          资金已完结（已收/已付/已核销），不可修改
        </el-tag>
        <el-tag
          v-else-if="isContentLockedByApproval"
          type="info"
          size="small"
          effect="plain"
          class="lock-tag"
        >
          审批已通过，仅可修改资金状态与业务日期
        </el-tag>
      </div>
      <el-button type="primary" plain size="small" @click="goBack">返回上一页</el-button>
    </div>
    <div class="detail-table-container">
      <el-table
        v-if="hasRowPayload"
        class="detail-table__grid"
        :data="tableRows"
        border
        height="100%"
        style="width: 100%"
      >
        <el-table-column prop="header" label="标题" width="220" />
        <el-table-column prop="value" label="内容" min-width="320">
          <template #default="{ row }">
            <div v-if="row.prop === 'amount' && isReimbursement" class="amount-reimbursement-cell">
              <span class="amount-display">{{ row.value }}</span>
              <el-popover
                v-model:visible="reimbursementPopoverVisible"
                placement="bottom-start"
                :width="960"
                trigger="click"
                popper-class="pat-reimbursement-popover"
                @show="onReimbursementPopoverShow"
              >
                <template #reference>
                  <el-button
                    link
                    type="primary"
                    class="reimbursement-add-btn"
                    title="查看/添加关联报销明细"
                    @click.stop
                  >
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </template>
                <div class="reimbursement-popover-body" @click.stop>
                  <div class="reimbursement-popover-panel">
                    <div class="reimbursement-popover-title">已关联本流水</div>
                    <el-table
                      :data="relatedReimbursementList"
                      size="small"
                      border
                      max-height="240"
                      v-loading="reimbursementListLoading"
                      empty-text="暂无已关联报销明细"
                    >
                      <el-table-column
                        v-for="col in REIMBURSEMENT_RELATED_COLUMNS"
                        :key="`linked-${col.prop}`"
                      :prop="col.prop"
                      :label="col.label"
                      :width="col.width"
                      :min-width="col.minWidth"
                      :show-overflow-tooltip="col.showOverflowTooltip || false"
                    >
                      <template #default="{ row: item }">
                        <el-tag
                          v-if="col.prop === 'payment_status'"
                          size="small"
                          :type="reimbursementPaymentTagType(item?.payment_status)"
                          effect="plain"
                        >
                          {{ item?.payment_status ?? '—' }}
                        </el-tag>
                        <el-tag
                          v-else-if="col.prop === 'is_invoice_received'"
                          size="small"
                          :type="Number(item?.is_invoice_received) === 1 ? 'success' : 'info'"
                          effect="plain"
                        >
                          {{ formatReimbursementInvoiceReceived(item?.is_invoice_received) }}
                        </el-tag>
                        <span v-else-if="col.prop === 'expense_date'">
                          {{ formatReimbursementDateOnly(item?.expense_date) }}
                        </span>
                        <span v-else>{{ item?.[col.prop] ?? '—' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" fixed="right" width="128" align="center">
                      <template #default="{ row: item }">
                        <el-button
                          link
                          type="primary"
                          size="small"
                          @click="goReimbursementDetail(item)"
                        >
                          详情
                        </el-button>
                        <el-button
                          link
                          type="danger"
                          size="small"
                          :disabled="!canManageReimbursementLink"
                          :loading="reimbursementLinkSavingId === item?.id"
                          @click.stop="unlinkReimbursementFromCurrentFlow(item)"
                        >
                          移除
                        </el-button>
                      </template>
                    </el-table-column>
                    </el-table>
                  </div>

                  <template v-if="showUnlinkedReimbursementSection">
                  <div
                    class="reimbursement-popover-toggle"
                    role="button"
                    tabindex="0"
                    @click="toggleUnlinkedPanel"
                    @keydown.enter="toggleUnlinkedPanel"
                  >
                    <el-icon class="toggle-icon">
                      <ArrowDown v-if="!unlinkedPanelExpanded" />
                      <ArrowUp v-else />
                    </el-icon>
                  </div>

                  <div v-show="unlinkedPanelExpanded" class="reimbursement-popover-panel">
                    <div class="reimbursement-popover-title">未关联流水（可添加）</div>
                    <el-input
                      v-model="unlinkedSearchKeyword"
                      class="reimbursement-unlinked-search"
                      size="small"
                      clearable
                      placeholder="搜索所有展示字段（模糊匹配）"
                    />
                    <el-table
                      :data="filteredUnlinkedReimbursementList"
                      size="small"
                      border
                      max-height="240"
                      v-loading="unlinkedListLoading"
                      :empty-text="
                        unlinkedReimbursementList.length
                          ? '无匹配的未关联报销明细'
                          : '暂无未关联报销明细'
                      "
                    >
                      <el-table-column
                        v-for="col in REIMBURSEMENT_RELATED_COLUMNS"
                        :key="`unlinked-${col.prop}`"
                        :prop="col.prop"
                        :label="col.label"
                        :width="col.width"
                        :min-width="col.minWidth"
                        :show-overflow-tooltip="col.showOverflowTooltip || false"
                      >
                        <template #default="{ row: item }">
                          <el-tag
                            v-if="col.prop === 'payment_status'"
                            size="small"
                            :type="reimbursementPaymentTagType(item?.payment_status)"
                            effect="plain"
                          >
                            {{ item?.payment_status ?? '—' }}
                          </el-tag>
                          <el-tag
                            v-else-if="col.prop === 'is_invoice_received'"
                            size="small"
                            :type="Number(item?.is_invoice_received) === 1 ? 'success' : 'info'"
                            effect="plain"
                          >
                            {{ formatReimbursementInvoiceReceived(item?.is_invoice_received) }}
                          </el-tag>
                          <span v-else-if="col.prop === 'expense_date'">
                            {{ formatReimbursementDateOnly(item?.expense_date) }}
                          </span>
                          <span v-else>{{ item?.[col.prop] ?? '—' }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="操作" fixed="right" width="128" align="center">
                        <template #default="{ row: item }">
                          <el-button
                            link
                            type="primary"
                            size="small"
                            @click="goReimbursementDetail(item)"
                          >
                            详情
                          </el-button>
                          <el-button
                            link
                            type="success"
                            size="small"
                            :disabled="!canAddReimbursementLink"
                            :loading="reimbursementLinkSavingId === item?.id"
                            @click.stop="linkReimbursementToCurrentFlow(item)"
                          >
                            添加
                          </el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  </template>
                </div>
              </el-popover>
            </div>
            <div v-else-if="isDateEditable(row.prop)" class="cell-date-field">
              <div
                v-if="editingDateProp === row.prop"
                class="cell-date-edit-wrap"
                @mousedown.stop
              >
                <el-date-picker
                  v-model="businessDateEditValue"
                  class="cell-date-picker"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="选择业务日期时间"
                  :editable="true"
                  :clearable="false"
                  :disabled="saving"
                  teleported
                  @visible-change="onBusinessDatePanelVisible"
                />
              </div>
              <div v-else class="cell-select-plain">
                <span class="select-plain-text">{{ row.value }}</span>
                <el-button
                  link
                  type="primary"
                  size="small"
                  class="modify-btn"
                  :disabled="saving"
                  @click.stop="startDateEdit(row.prop)"
                >
                  修改
                </el-button>
              </div>
            </div>
            <div v-else-if="isSelectEditable(row.prop)" class="cell-select-field">
              <div
                v-if="editingSelectProp === row.prop"
                class="cell-select-edit-wrap"
                @mousedown.stop
              >
                <el-select
                  class="cell-select"
                  popper-class="pat-detail-select-popper"
                  :model-value="selectModelValue(row.prop)"
                  placeholder="请选择"
                  filterable
                  :fit-input-width="true"
                  size="default"
                  :disabled="saving"
                  teleported
                  @change="(v) => onSelectChange(row.prop, v)"
                >
                  <el-option
                    v-for="opt in getSelectOptions(row.prop)"
                    :key="String(opt.value)"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <div v-else class="cell-select-plain">
                <span class="select-plain-text">{{ displaySelectCell(row.prop) }}</span>
                <el-button
                  link
                  type="primary"
                  size="small"
                  class="modify-btn"
                  :disabled="saving"
                  @click.stop="startSelectEdit(row.prop)"
                >
                  修改
                </el-button>
              </div>
            </div>
            <span v-else-if="isAlwaysReadonly(row.prop)" class="cell-readonly">{{ row.value }}</span>
            <div
              v-else-if="isTextEditable(row.prop)"
              class="private-tx-edit-cell"
            >
              <el-input
                v-if="editingProp === row.prop"
                v-model="editBuffer"
                size="small"
                class="cell-input"
                @blur="commitEdit"
                @keyup.enter="commitEdit"
                @click.stop
              />
              <div
                v-else
                class="editable-plain"
                :title="'双击修改'"
                @dblclick.stop="startEdit(row)"
              >
                {{ row.value }}
              </div>
            </div>
            <span v-else class="cell-readonly">{{ row.value }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="empty-state">未接收到详情数据，请从列表「编辑」进入</div>
      <div v-if="hasRowPayload && ((showApprovalFooter && showApprovalRadios) || showRevokeButton || hasRelatedFlowNo)" class="detail-footer">
        <div v-if="showApprovalFooter && showApprovalRadios" class="approval-row">
          <span class="footer-label">审批：</span>
          <el-radio-group
            v-model="approvalStatus"
            :disabled="approvalSaving || saving"
            @change="handleApprovalChange"
          >
            <el-radio :label="APPROVAL_PASSED">通过</el-radio>
            <el-radio :label="APPROVAL_REJECTED">驳回</el-radio>
          </el-radio-group>
        </div>
        <div v-if="showRevokeButton || hasRelatedFlowNo" class="approval-row approval-row--actions">
          <el-button
            v-if="showRevokeButton"
            type="warning"
            plain
            :loading="approvalSaving"
            :disabled="saving"
            @click="handleRevokeApproval"
          >
            撤销
          </el-button>
          <el-button
            v-if="hasRelatedFlowNo"
            type="primary"
            plain
            :loading="relatedFlowNavigating"
            :disabled="saving || approvalSaving"
            @click="openRelatedFlowDetail"
          >
            查看关联流水 {{ relatedFlowNo }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  font-size: 18px;
  font-weight: 600;
}

.detail-header-row {
  flex: 0 0 48px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.lock-tag {
  flex-shrink: 0;
}

.detail-meta {
  flex: 0 0 40px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 0 12px;
  display: flex;
  align-items: center;
  color: #606266;
}

.label {
  color: #909399;
}

.detail-table-container {
  flex: 1 1 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 12px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-footer {
  flex: 0 0 auto;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.approval-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-label {
  flex-shrink: 0;
  color: #909399;
  font-size: 14px;
}

.detail-table__grid {
  width: 100%;

  :deep(.el-table__cell) {
    vertical-align: middle;
  }

  :deep(.el-table__body .cell) {
    line-height: 1.5;
    padding-top: 10px;
    padding-bottom: 10px;
  }
}

.cell-select-field,
.cell-date-field {
  width: 100%;
  min-height: 36px;
}

.cell-date-edit-wrap {
  display: flex;
  align-items: center;
  width: 100%;
}

.cell-select-plain {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 24px;
  line-height: 24px;
}

.select-plain-text {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 24px;
  word-break: break-all;
}

.modify-btn {
  flex-shrink: 0;
  margin-left: 10px;
  padding: 0 0 0 10px !important;
  height: 24px;
  line-height: 24px;
  font-size: 13px;
  font-weight: 400;
  border-left: 1px solid var(--el-border-color-lighter);
  vertical-align: middle;
}

.cell-select-edit-wrap {
  display: flex;
  align-items: center;
  width: 100%;
}

.cell-datetime-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
}

.cell-date-picker {
  width: 100%;
  max-width: min(100%, 340px);

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    min-height: 36px;
    box-shadow: none;
    border: 1px solid var(--el-border-color-lighter);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  :deep(.el-input__wrapper.is-focus) {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
  }
}

.cell-select {
  width: 100%;
  max-width: min(100%, 300px);

  :deep(.el-select__wrapper) {
    min-height: 36px;
    padding: 4px 12px;
    border-radius: 8px;
    background-color: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    box-shadow: none;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background-color 0.2s ease;
  }

  :deep(.el-select__wrapper.is-hovering:not(.is-focused)) {
    border-color: var(--el-border-color);
    background-color: var(--el-fill-color-light);
  }

  :deep(.el-select__wrapper.is-focused) {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
  }

  :deep(.el-select__placeholder) {
    color: var(--el-text-color-placeholder);
    font-size: 13px;
  }

  :deep(.el-select__selected-item) {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 500;
  }

  :deep(.el-select__suffix) {
    color: var(--el-text-color-secondary);
  }

  &.is-disabled :deep(.el-select__wrapper) {
    background-color: var(--el-fill-color-light);
    border-color: var(--el-border-color-lighter);
    opacity: 0.85;
  }
}

.editable-plain {
  min-height: 24px;
  line-height: 24px;
  cursor: text;
  color: var(--el-text-color-regular);
}

.cell-readonly {
  color: var(--el-text-color-secondary);
}

.amount-reimbursement-cell {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 24px;
  gap: 4px;
}

.amount-display {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 24px;
}

.reimbursement-add-btn {
  flex-shrink: 0;
  margin-left: 6px;
  padding: 0 4px !important;
  height: 24px;
  line-height: 24px;
  font-size: 16px;
  vertical-align: middle;
}

.reimbursement-popover-body {
  max-width: 100%;
}

.reimbursement-popover-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.reimbursement-unlinked-search {
  margin-bottom: 10px;
  width: 100%;
  max-width: 420px;
}

.reimbursement-popover-panel :deep(.el-table .cell) {
  padding-left: 8px;
  padding-right: 8px;
}

.reimbursement-popover-panel + .reimbursement-popover-toggle {
  margin-top: 4px;
}

.reimbursement-popover-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  margin: 6px 0;
  cursor: pointer;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-primary);
  }

  .toggle-icon {
    font-size: 18px;
  }
}

.reimbursement-popover-toggle + .reimbursement-popover-panel {
  margin-top: 8px;
}

.cell-input {
  width: 100%;
  max-width: 480px;
}

.empty-state {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
</style>

<style lang="scss">
.pat-detail-select-popper.el-popper {
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: var(--el-box-shadow-light);
  overflow: hidden;
}

.pat-detail-select-popper .el-select-dropdown__list {
  padding: 6px 4px;
}

.pat-detail-select-popper .el-select-dropdown__item {
  margin: 2px 4px;
  border-radius: 6px;
  height: 34px;
  line-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

.pat-detail-select-popper .el-select-dropdown__item.is-hovering,
.pat-detail-select-popper .el-select-dropdown__item:hover {
  background-color: var(--el-fill-color-light);
}

.pat-detail-select-popper .el-select-dropdown__item.is-selected {
  font-weight: 600;
  color: var(--el-color-primary);
}

.pat-reimbursement-popover.el-popover {
  padding: 12px 14px;
}
</style>
