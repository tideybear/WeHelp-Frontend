<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getReimbursementDetailAPI, updateReimbursementDetailAPI } from '@/apis/fin'
import { formatDateTime } from '@/utils/formatDate'
import { useMenu } from '@/stores/menuStore'
import {
  fetchPrivateAccountTransactionByFlowNo,
  pushPrivateAccountDetailRoute,
} from '@/views/Finance/PrivateAccountTransactions/privateAccountTransactionsDefault/List/recordLoader'

defineOptions({ name: 'ReimbursementDetailsDetail' })

const route = useRoute()
const router = useRouter()
const menuStore = useMenu()

const EXPENSE_TYPE_OPTIONS = [
  '交通', '餐饮', '住宿', '办公用品', '差旅', '招待', '维修', '活动物料', '其他',
]
const INVOICE_TYPE_OPTIONS = ['增值税专票', '普票', '电子票', '无票']
const APPROVAL_PASSED = '已通过'
const PAYMENT_PAID = '已支付'

const defaultColumns = [
  { prop: 'detail_no', label: '明细流水号' },
  { prop: 'applicant', label: '申请人' },
  { prop: 'apply_date', label: '申请日期' },
  { prop: 'expense_type', label: '费用类型' },
  { prop: 'expense_date', label: '费用发生日期' },
  { prop: 'expense_amount', label: '费用金额(元)' },
  { prop: 'expense_desc', label: '费用事由' },
  { prop: 'expense_remark', label: '详细备注' },
  
  { prop: 'approver', label: '审批人' },
  { prop: 'approval_status', label: '审批状态' },
  { prop: 'approval_time', label: '审批时间' },
  { prop: 'approval_remark', label: '审批意见' },
  { prop: 'payment_status', label: '支付状态' },
  { prop: 'payment_time', label: '支付时间' },
  { prop: 'payment_method', label: '支付方式' },
  { prop: 'payment_account', label: '收款账号' },
  { prop: 'is_invoice_received', label: '是否已取得发票' },
  { prop: 'invoice_type', label: '发票类型' },
  { prop: 'invoice_no', label: '发票号码' },
  { prop: 'invoice_code', label: '发票代码' },
  { prop: 'invoice_date', label: '开票日期' },
  { prop: 'attachment_ids', label: '附件ID列表' },
  { prop: 'remark', label: '整体备注' },
]

const ALWAYS_READONLY_PROPS = new Set([
  'detail_no',
  'approver',
  'approval_status',
  'approval_time',
  'approval_remark',
  'payment_status',
  'payment_time',
  'payment_method',
  'payment_account',
])

const RADIO_PROPS = new Set(['is_invoice_received'])
const SELECT_PROPS = new Set(['expense_type', 'invoice_type'])

const INVOICE_FIELD_PROPS = new Set([
  'invoice_type',
  'invoice_no',
  'invoice_code',
  'invoice_date',
  'attachment_ids',
])

const DATE_EDIT_PROPS = new Set(['apply_date', 'expense_date', 'invoice_date'])

const DATETIME_DISPLAY_PROPS = new Set(['approval_time', 'payment_time'])

const parsedRowData = computed(() => {
  const raw = route.query.rowData
  if (!raw || typeof raw !== 'string') return {}
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch (e) {
    console.error('解析报销明细详情参数失败:', e)
    return {}
  }
})

const form = ref({})
const detailLoading = ref(false)
const saving = ref(false)
const relatedFlowNavigating = ref(false)
const editingProp = ref(null)
const editBuffer = ref('')
const editingSelectProp = ref(null)
const editingDateProp = ref(null)

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

const hasRowPayload = computed(() => Object.keys(form.value || {}).length > 0)

const relatedFlowNo = computed(() => String(form.value?.related_flow_no ?? '').trim())

const hasRelatedFlowNo = computed(() => relatedFlowNo.value !== '')

const isPageLocked = computed(() => {
  const approvalStatus = String(form.value?.approval_status ?? '').trim()
  const paymentStatus = String(form.value?.payment_status ?? '').trim()
  return approvalStatus === APPROVAL_PASSED || paymentStatus === PAYMENT_PAID
})

function cancelAllEdits() {
  editingProp.value = null
  editingSelectProp.value = null
  editingDateProp.value = null
}

watch(isPageLocked, (locked) => {
  if (locked) cancelAllEdits()
})

const isInvoiceReceived = computed(() => Number(form.value?.is_invoice_received) === 1)

function formatDateOnlyValue(val) {
  if (val === undefined || val === null || val === '') return ''
  const d = formatDateTime(val)
  return d ? d.slice(0, 10) : String(val).slice(0, 10)
}

function displayValue(prop) {
  const val = form.value?.[prop]
  if (val === undefined || val === null || val === '') return '—'
  if (prop === 'is_invoice_received') {
    return Number(val) === 1 ? '是' : '否'
  }
  if (DATE_EDIT_PROPS.has(prop)) {
    return formatDateOnlyValue(val) || '—'
  }
  if (DATETIME_DISPLAY_PROPS.has(prop)) {
    return formatDateTime(val) || String(val)
  }
  return val
}

const tableRows = computed(() =>
  defaultColumns.map((col) => ({
    prop: col.prop,
    header: col.label,
    value: displayValue(col.prop),
  })),
)

const detailTitle = computed(() => {
  const no = String(form.value?.detail_no ?? '').trim()
  return no ? `报销明细 · ${no}` : '报销明细详情'
})

function isFieldAlwaysReadonly(prop) {
  return ALWAYS_READONLY_PROPS.has(prop)
}

function isInvoiceField(prop) {
  return INVOICE_FIELD_PROPS.has(prop)
}

function isAlwaysReadonly(prop) {
  if (isPageLocked.value) return true
  if (isFieldAlwaysReadonly(prop)) return true
  if (isInvoiceField(prop) && !isInvoiceReceived.value) return true
  return false
}

function isRadioEditable(prop) {
  if (isPageLocked.value) return false
  return RADIO_PROPS.has(prop)
}

function isSelectEditable(prop) {
  if (isPageLocked.value) return false
  if (!SELECT_PROPS.has(prop)) return false
  if (prop === 'invoice_type' && !isInvoiceReceived.value) return false
  return true
}

function isDateEditable(prop) {
  if (isPageLocked.value) return false
  if (!DATE_EDIT_PROPS.has(prop)) return false
  if (prop === 'invoice_date' && !isInvoiceReceived.value) return false
  return true
}

function isTextEditable(prop) {
  if (isPageLocked.value) return false
  if (isAlwaysReadonly(prop)) return false
  if (RADIO_PROPS.has(prop) || SELECT_PROPS.has(prop) || DATE_EDIT_PROPS.has(prop)) return false
  if (isInvoiceField(prop) && !isInvoiceReceived.value) return false
  return true
}

const invoiceReceivedValue = computed(() =>
  Number(form.value?.is_invoice_received) === 1 ? 1 : 0,
)

function getSelectOptions(prop) {
  switch (prop) {
    case 'expense_type':
      return EXPENSE_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))
    case 'invoice_type':
      return INVOICE_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))
    default:
      return []
  }
}

function selectModelValue(prop) {
  const raw = form.value?.[prop]
  if (raw === undefined || raw === null) return undefined
  const s = String(raw).trim()
  return s === '' ? undefined : s
}

function dateModelValue(prop) {
  return formatDateOnlyValue(form.value?.[prop]) || ''
}

function buildSelectPatch(prop, val) {
  if (prop === 'is_invoice_received') {
    const received = val === 1 || val === '1' ? 1 : 0
    const patch = { is_invoice_received: received }
    if (received === 0) {
      patch.invoice_type = null
      patch.invoice_no = null
      patch.invoice_code = null
      patch.invoice_date = null
      patch.attachment_ids = null
    }
    return patch
  }
  return { [prop]: val }
}

function isSameSelectValue(prop, val) {
  if (prop === 'is_invoice_received') {
    const v = val === 1 || val === '1' ? 1 : 0
    return v === (Number(form.value?.is_invoice_received) === 1 ? 1 : 0)
  }
  const next = val === undefined || val === null ? '' : String(val).trim()
  const prev =
    form.value?.[prop] === undefined || form.value?.[prop] === null
      ? ''
      : String(form.value[prop]).trim()
  return next === prev
}

async function persistUpdates(data) {
  if (isPageLocked.value) {
    ElMessage.warning('当前状态不可修改')
    return false
  }
  const id = recordId.value
  if (!id) {
    ElMessage.warning('缺少记录 id，无法保存')
    return false
  }
  if (saving.value) return false
  try {
    saving.value = true
    const res = await updateReimbursementDetailAPI({ id, data })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '保存失败')
      return false
    }
    Object.assign(form.value, data)
    ElMessage.success('已保存')
    return true
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
    return false
  } finally {
    saving.value = false
  }
}

function startSelectEdit(prop) {
  if (!isSelectEditable(prop) || saving.value) return
  editingSelectProp.value = prop
}

function cancelSelectEdit() {
  editingSelectProp.value = null
}

function startDateEdit(prop) {
  if (!isDateEditable(prop) || saving.value) return
  editingDateProp.value = prop
}

function cancelDateEdit() {
  editingDateProp.value = null
}

function isInsideSelectEditor(target) {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.cell-select-edit-wrap') != null ||
    target.closest('.rd-detail-select-popper') != null ||
    target.closest('.el-select-dropdown') != null
  )
}

function isInsideDateEditor(target) {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.cell-date-edit-wrap') != null ||
    target.closest('.el-picker__popper') != null ||
    target.closest('.el-date-picker') != null
  )
}

async function onInvoiceReceivedChange(val) {
  await onSelectChange('is_invoice_received', val)
}

async function onSelectChange(prop, val) {
  if (isSameSelectValue(prop, val)) {
    cancelSelectEdit()
    return
  }
  const patch = buildSelectPatch(prop, val)
  const snapshot = { ...form.value }
  const ok = await persistUpdates(patch)
  if (ok) {
    Object.assign(form.value, patch)
  } else {
    Object.assign(form.value, snapshot)
  }
  cancelSelectEdit()
}

async function onDateChange(prop, val) {
  const next = val ? String(val).trim() : ''
  const prev = formatDateOnlyValue(form.value?.[prop])
  if (next === prev) {
    cancelDateEdit()
    return
  }
  const snapshot = { ...form.value }
  const ok = await persistUpdates({ [prop]: next || null })
  if (ok) {
    form.value[prop] = next || null
  } else {
    Object.assign(form.value, snapshot)
  }
  cancelDateEdit()
}

function startEdit(row) {
  if (!isTextEditable(row.prop) || saving.value) return
  editingProp.value = row.prop
  const raw = form.value?.[row.prop]
  editBuffer.value = raw === undefined || raw === null ? '' : String(raw)
  nextTick(() => {
    document.querySelector('.rd-detail-edit-cell .el-input__inner')?.focus?.()
  })
}

let commitBusy = false
async function commitEdit() {
  if (commitBusy || editingProp.value == null) return
  const prop = editingProp.value
  const next = editBuffer.value.trim()
  const prevRaw = form.value?.[prop]
  const prev = prevRaw === undefined || prevRaw === null ? '' : String(prevRaw).trim()
  if (next === prev) {
    editingProp.value = null
    return
  }
  commitBusy = true
  try {
    const payload = { [prop]: next || null }
    const ok = await persistUpdates(payload)
    if (ok) editingProp.value = null
  } finally {
    commitBusy = false
  }
}

function handleDocMouseDown(e) {
  const t = e.target
  if (t instanceof Element && t.closest('.rd-detail-edit-cell')) return
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
    cancelDateEdit()
  }
}

async function loadDetailFromApi() {
  const id = recordId.value
  if (!id) return
  try {
    detailLoading.value = true
    const res = await getReimbursementDetailAPI(id)
    if (res?.code !== 200 || !res.data) {
      ElMessage.error(res?.msg || '加载详情失败')
      return
    }
    form.value = { ...res.data }
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocMouseDown)
  if (!hasRowPayload.value && recordId.value) {
    loadDetailFromApi()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocMouseDown)
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'ReimbursementDetails' })
}

async function openRelatedFlowDetail() {
  const flowNo = relatedFlowNo.value
  if (!flowNo || relatedFlowNavigating.value) return

  if (!flowNo.startsWith('PR')) {
    ElMessage.warning('暂不支持跳转该类型关联流水')
    return
  }

  const ns = menuStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }

  relatedFlowNavigating.value = true
  try {
    const row = await fetchPrivateAccountTransactionByFlowNo(ns, flowNo)
    if (!row?.id) {
      ElMessage.error('未找到关联私账流水')
      return
    }
    await pushPrivateAccountDetailRoute(router, ns, row)
  } catch (e) {
    console.error('打开关联私账详情失败:', e)
    ElMessage.error(e?.message || e?.response?.data?.msg || '获取关联流水失败')
  } finally {
    relatedFlowNavigating.value = false
  }
}
</script>

<template>
  <div class="detail-page" v-loading="detailLoading">
    <div class="detail-header-row">
      <el-button type="primary" plain size="small" @click="goBack">返回列表</el-button>
      <el-button
        v-if="hasRelatedFlowNo"
        type="primary"
        plain
        size="small"
        :loading="relatedFlowNavigating"
        @click="openRelatedFlowDetail"
      >
        查看关联流水 {{ relatedFlowNo }}
      </el-button>
    </div>
    <div class="detail-table-container">
      <el-table
        v-if="hasRowPayload || recordId"
        class="detail-table__grid"
        :data="tableRows"
        border
        height="100%"
        style="width: 100%"
      >
        <el-table-column prop="header" label="项目" width="220" />
        <el-table-column prop="value" label="内容" min-width="320">
          <template #default="{ row }">
            <div v-if="isRadioEditable(row.prop)" class="cell-radio-field" @mousedown.stop>
              <el-radio-group
                :model-value="invoiceReceivedValue"
                :disabled="saving"
                @change="onInvoiceReceivedChange"
              >
                <el-radio :label="1">是</el-radio>
                <el-radio :label="0">否</el-radio>
              </el-radio-group>
            </div>
            <div v-else-if="isSelectEditable(row.prop)" class="cell-select-field">
              <div
                v-if="editingSelectProp === row.prop"
                class="cell-select-edit-wrap"
                @mousedown.stop
              >
                <el-select
                  class="cell-select"
                  popper-class="rd-detail-select-popper"
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
                <span class="select-plain-text">{{ row.value }}</span>
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
            <div v-else-if="isDateEditable(row.prop)" class="cell-date-field">
              <div
                v-if="editingDateProp === row.prop"
                class="cell-date-edit-wrap"
                @mousedown.stop
              >
                <el-date-picker
                  class="cell-date-picker"
                  :model-value="dateModelValue(row.prop)"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  :disabled="saving"
                  teleported
                  @change="(v) => onDateChange(row.prop, v)"
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
            <span v-else-if="isAlwaysReadonly(row.prop)" class="cell-readonly">{{ row.value }}</span>
            <div v-else-if="isTextEditable(row.prop)" class="rd-detail-edit-cell">
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
                title="双击修改"
                @dblclick.stop="startEdit(row)"
              >
                {{ row.value }}
              </div>
            </div>
            <span v-else class="cell-readonly">{{ row.value }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-else class="empty-state">未接收到详情数据，请从列表进入</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  box-sizing: border-box;
  height: 100%;
  min-height: calc(100vh - 100px);
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
  flex: 0 0 auto;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
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

.detail-table-container {
  flex: 1 1 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 12px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.empty-state {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.cell-select-field,
.cell-date-field {
  width: 100%;
  min-height: 36px;
}

.cell-radio-field {
  display: inline-flex;
  align-items: center;
  min-height: 24px;

  :deep(.el-radio-group) {
    display: inline-flex;
    flex-wrap: nowrap;
    gap: 16px;
  }

  :deep(.el-radio) {
    margin-right: 0;
    height: 24px;
  }

  :deep(.el-radio__label) {
    font-size: 13px;
    padding-left: 6px;
  }
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

.cell-select-edit-wrap,
.cell-date-edit-wrap {
  display: flex;
  align-items: center;
  width: 100%;
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

.rd-detail-edit-cell {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  vertical-align: middle;
}

.editable-plain {
  display: inline-block;
  max-width: 100%;
  min-height: 24px;
  line-height: 24px;
  cursor: text;
  color: var(--el-text-color-regular);
  word-break: break-all;
}

.cell-readonly {
  color: var(--el-text-color-secondary);
}

.cell-input {
  width: auto;
  min-width: 120px;
  max-width: min(100%, 480px);

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: none;
    border: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-input__wrapper.is-focus) {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
  }
}
</style>

<style lang="scss">
.rd-detail-select-popper.el-popper {
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: var(--el-box-shadow-light);
  overflow: hidden;
}

.rd-detail-select-popper .el-select-dropdown__list {
  padding: 6px 4px;
}

.rd-detail-select-popper .el-select-dropdown__item {
  margin: 2px 4px;
  border-radius: 6px;
  height: 34px;
  line-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

.rd-detail-select-popper .el-select-dropdown__item.is-hovering,
.rd-detail-select-popper .el-select-dropdown__item:hover {
  background-color: var(--el-fill-color-light);
}

.rd-detail-select-popper .el-select-dropdown__item.is-selected {
  font-weight: 600;
  color: var(--el-color-primary);
}
</style>
