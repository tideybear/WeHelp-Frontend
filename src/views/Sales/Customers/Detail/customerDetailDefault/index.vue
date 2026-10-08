<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCustomerDetailAPI, updateCustomerAPI } from '@/apis/sales'
import { formatDateTime } from '@/utils/formatDate'
import { useUserStore } from '@/stores/userStore'

defineOptions({ name: 'CustomerDetailDefault' })

const STATUS_OPTIONS = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
  { label: '黑名单', value: 2 },
]

const LEVEL_OPTIONS = [
  { label: '普通', value: 1 },
  { label: '重要', value: 2 },
  { label: 'VIP', value: 3 },
  { label: '战略合作', value: 4 },
]

const TYPE_OPTIONS = [
  { label: '企业', value: 1 },
  { label: '个人', value: 2 },
  { label: '政府机构', value: 3 },
  { label: '事业单位', value: 4 },
]

const DETAIL_COLUMNS = [
  { prop: 'customer_code', label: '客户编码', readonly: true },
  { prop: 'customer_name', label: '客户名称' },
  { prop: 'short_name', label: '简称' },
  { prop: 'contact_person', label: '联系人' },
  { prop: 'phone', label: '联系电话' },
  { prop: 'mobile', label: '手机' },
  { prop: 'fax', label: '传真' },
  { prop: 'email', label: '邮箱' },
  { prop: 'qq', label: 'QQ' },
  { prop: 'wechat', label: '微信' },
  { prop: 'province', label: '省' },
  { prop: 'city', label: '市' },
  { prop: 'district', label: '区' },
  { prop: 'address', label: '详细地址' },
  { prop: 'zip_code', label: '邮编' },
  { prop: 'bank_name', label: '开户银行' },
  { prop: 'bank_account', label: '银行账号' },
  { prop: 'tax_number', label: '税号' },
  { prop: 'status', label: '状态', type: 'select', options: STATUS_OPTIONS },
  { prop: 'customer_level', label: '客户等级', type: 'select', options: LEVEL_OPTIONS },
  { prop: 'customer_type', label: '客户类型', type: 'select', options: TYPE_OPTIONS },
  { prop: 'payment_terms', label: '付款条件' },
  { prop: 'credit_limit', label: '信用额度', type: 'number' },
  { prop: 'used_credit', label: '已用信用额度', type: 'number' },
  { prop: 'receivable_amount', label: '应收余额', type: 'number' },
  { prop: 'industry', label: '所属行业' },
  { prop: 'source', label: '客户来源' },
  { prop: 'sales_person', label: '负责销售' },
  { prop: 'follow_up_cycle', label: '跟进周期(天)', type: 'number' },
  { prop: 'last_contact_date', label: '最近联系日期', type: 'date' },
  { prop: 'next_contact_date', label: '下次联系日期', type: 'date' },
  { prop: 'remark', label: '备注', type: 'textarea' },
  { prop: 'created_at', label: '创建时间', readonly: true },
  { prop: 'created_by', label: '创建人', readonly: true },
  { prop: 'updated_at', label: '更新时间', readonly: true },
  { prop: 'updated_by', label: '更新人', readonly: true },
]

const READONLY_PROPS = new Set(
  DETAIL_COLUMNS.filter((c) => c.readonly).map((c) => c.prop),
)
const SELECT_PROPS = new Set(
  DETAIL_COLUMNS.filter((c) => c.type === 'select').map((c) => c.prop),
)
const NUMBER_PROPS = new Set(
  DETAIL_COLUMNS.filter((c) => c.type === 'number').map((c) => c.prop),
)
const TEXTAREA_PROPS = new Set(
  DETAIL_COLUMNS.filter((c) => c.type === 'textarea').map((c) => c.prop),
)
const DATE_PROPS = new Set(
  DETAIL_COLUMNS.filter((c) => c.type === 'date').map((c) => c.prop),
)
const DATETIME_PROPS = new Set(['created_at', 'updated_at'])

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = ref({})
const detailLoading = ref(false)
const saving = ref(false)
const editingProp = ref(null)
const editBuffer = ref('')
const editingSelectProp = ref(null)
const editingNumberProp = ref(null)
const editingTextareaProp = ref(null)
const editingDateProp = ref(null)

const parsedRowData = computed(() => {
  const raw = route.query.rowData
  if (!raw || typeof raw !== 'string') return {}
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch (e) {
    console.error('解析客户详情参数失败:', e)
    return {}
  }
})

watch(
  parsedRowData,
  (data) => {
    if (data && Object.keys(data).length) {
      form.value = { ...data }
    }
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

function statusLabel(val) {
  const hit = STATUS_OPTIONS.find((o) => o.value === Number(val))
  return hit?.label ?? '—'
}

function levelLabel(val) {
  const hit = LEVEL_OPTIONS.find((o) => o.value === Number(val))
  return hit?.label ?? '—'
}

function typeLabel(val) {
  const hit = TYPE_OPTIONS.find((o) => o.value === Number(val))
  return hit?.label ?? '—'
}

function formatDateOnlyValue(val) {
  if (val === undefined || val === null || val === '') return ''
  const s = String(val)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function formatMoney(val) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function displayValue(prop) {
  const val = form.value?.[prop]
  if (val === undefined || val === null || val === '') return '—'
  if (prop === 'status') return statusLabel(val)
  if (prop === 'customer_level') return levelLabel(val)
  if (prop === 'customer_type') return typeLabel(val)
  if (['credit_limit', 'used_credit', 'receivable_amount'].includes(prop)) return formatMoney(val)
  if (prop === 'follow_up_cycle') return val
  if (DATE_PROPS.has(prop)) return formatDateOnlyValue(val) || '—'
  if (DATETIME_PROPS.has(prop)) return formatDateTime(val) || String(val)
  return val
}

const tableRows = computed(() =>
  DETAIL_COLUMNS.map((col) => ({
    prop: col.prop,
    header: col.label,
    type: col.type,
    options: col.options,
    readonly: !!col.readonly,
    value: displayValue(col.prop),
  })),
)

const detailTitle = computed(() => {
  const code = String(form.value?.customer_code ?? '').trim()
  const name = String(form.value?.customer_name ?? '').trim()
  if (code && name) return `客户 · ${code} · ${name}`
  if (code) return `客户 · ${code}`
  return '客户详情'
})

function isReadonly(prop) {
  return READONLY_PROPS.has(prop)
}

function isTextEditable(prop) {
  return (
    !isReadonly(prop) &&
    !SELECT_PROPS.has(prop) &&
    !NUMBER_PROPS.has(prop) &&
    !TEXTAREA_PROPS.has(prop) &&
    !DATE_PROPS.has(prop)
  )
}

function isDateEditable(prop) {
  return DATE_PROPS.has(prop)
}

function isSelectEditable(prop) {
  return SELECT_PROPS.has(prop)
}

function isNumberEditable(prop) {
  return NUMBER_PROPS.has(prop)
}

function isTextareaEditable(prop) {
  return TEXTAREA_PROPS.has(prop)
}

function cancelAllEdits() {
  editingProp.value = null
  editingSelectProp.value = null
  editingNumberProp.value = null
  editingTextareaProp.value = null
  editingDateProp.value = null
}

function getSelectOptions(prop) {
  const col = DETAIL_COLUMNS.find((c) => c.prop === prop)
  return col?.options ?? []
}

function selectModelValue(prop) {
  const v = form.value?.[prop]
  return v === undefined || v === null ? undefined : Number(v)
}

function numberModelValue(prop) {
  const v = form.value?.[prop]
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function startEdit(row) {
  if (!isTextEditable(row.prop) || saving.value) return
  cancelAllEdits()
  editingProp.value = row.prop
  const raw = form.value?.[row.prop]
  editBuffer.value = raw === undefined || raw === null ? '' : String(raw)
  nextTick(() => {
    document.querySelector('.customer-detail-edit-cell .el-input__inner')?.focus?.()
  })
}

function commitTextEdit() {
  if (editingProp.value == null) return
  const prop = editingProp.value
  const next = editBuffer.value.trim()
  form.value[prop] = next || null
  editingProp.value = null
}

function startSelectEdit(prop) {
  if (!isSelectEditable(prop) || saving.value) return
  cancelAllEdits()
  editingSelectProp.value = prop
}

function onSelectChange(prop, val) {
  form.value[prop] = val === undefined || val === null ? null : Number(val)
  editingSelectProp.value = null
}

function startNumberEdit(prop) {
  if (!isNumberEditable(prop) || saving.value) return
  cancelAllEdits()
  editingNumberProp.value = prop
}

function onNumberChange(prop, val) {
  form.value[prop] = val === undefined || val === null || val === '' ? null : val
  editingNumberProp.value = null
}

function startTextareaEdit(prop) {
  if (!isTextareaEditable(prop) || saving.value) return
  cancelAllEdits()
  editingTextareaProp.value = prop
  const raw = form.value?.[prop]
  editBuffer.value = raw === undefined || raw === null ? '' : String(raw)
}

function commitTextareaEdit() {
  if (editingTextareaProp.value == null) return
  const prop = editingTextareaProp.value
  form.value[prop] = editBuffer.value.trim() || null
  editingTextareaProp.value = null
}

function startDateEdit(prop) {
  if (!isDateEditable(prop) || saving.value) return
  cancelAllEdits()
  editingDateProp.value = prop
}

function dateModelValue(prop) {
  return formatDateOnlyValue(form.value?.[prop]) || undefined
}

function onDateChange(prop, val) {
  form.value[prop] = val ? String(val).trim() : null
  editingDateProp.value = null
}

function isInsideSelectEditor(target) {
  if (!(target instanceof Element)) return false
  return (
    target.closest('.cell-select-edit-wrap') != null ||
    target.closest('.customer-detail-select-popper') != null ||
    target.closest('.el-select-dropdown') != null
  )
}

function handleDocMouseDown(e) {
  const t = e.target
  if (t instanceof Element && t.closest('.customer-detail-edit-cell')) return
  if (editingProp.value != null) {
    commitTextEdit()
    return
  }
  if (editingTextareaProp.value != null) {
    if (t instanceof Element && t.closest('.customer-detail-textarea-wrap')) return
    commitTextareaEdit()
    return
  }
  if (editingSelectProp.value != null) {
    if (isInsideSelectEditor(t)) return
    editingSelectProp.value = null
  }
  if (editingNumberProp.value != null) {
    if (t instanceof Element && t.closest('.customer-detail-number-wrap')) return
    editingNumberProp.value = null
  }
  if (editingDateProp.value != null) {
    if (t instanceof Element && t.closest('.customer-detail-date-wrap')) return
    editingDateProp.value = null
  }
}

function buildSavePayload() {
  const editableProps = DETAIL_COLUMNS.filter((c) => !c.readonly).map((c) => c.prop)
  const data = {}
  for (const prop of editableProps) {
    if (NUMBER_PROPS.has(prop)) {
      const v = form.value?.[prop]
      data[prop] = v === undefined || v === null || v === '' ? null : v
    } else if (DATE_PROPS.has(prop)) {
      const raw = form.value?.[prop]
      data[prop] = raw ? formatDateOnlyValue(raw) || null : null
    } else if (SELECT_PROPS.has(prop)) {
      data[prop] = form.value?.[prop] == null ? 1 : Number(form.value[prop])
    } else {
      const raw = form.value?.[prop]
      data[prop] = raw === undefined || raw === null ? null : String(raw).trim() || null
    }
  }
  return data
}

async function saveAll() {
  const id = recordId.value
  if (!id) {
    ElMessage.warning('缺少记录 id，无法保存')
    return
  }
  const name = String(form.value?.customer_name ?? '').trim()
  if (!name) {
    ElMessage.warning('客户名称不能为空')
    return
  }
  const uid = userStore.userInfo?.id
  if (uid == null || uid === '') {
    ElMessage.warning('请先登录')
    return
  }
  cancelAllEdits()
  saving.value = true
  try {
    const res = await updateCustomerAPI({
      id: Number(id),
      user_id: Number(uid),
      ...buildSavePayload(),
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '保存失败')
      return
    }
    ElMessage.success('保存成功')
    await loadDetailFromApi()
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadDetailFromApi() {
  const id = recordId.value
  if (!id) return
  try {
    detailLoading.value = true
    const res = await getCustomerDetailAPI(id)
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
  if (recordId.value) {
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
  router.push({ name: 'SalesCustomers' })
}
</script>

<template>
  <div class="detail-page" v-loading="detailLoading">
    <div class="detail-header-row">
      <div class="detail-header-left">
        <el-button type="primary" plain size="small" @click="goBack">返回列表</el-button>
        <span class="detail-title">{{ detailTitle }}</span>
      </div>
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
        <el-table-column prop="header" label="项目" width="140" />
        <el-table-column prop="value" label="内容" min-width="320">
          <template #default="{ row }">
            <div v-if="isSelectEditable(row.prop)" class="cell-select-field">
              <div
                v-if="editingSelectProp === row.prop"
                class="cell-select-edit-wrap"
                @mousedown.stop
              >
                <el-select
                  class="cell-select"
                  popper-class="customer-detail-select-popper"
                  :model-value="selectModelValue(row.prop)"
                  placeholder="请选择"
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
              <div
                v-else
                class="editable-plain"
                title="双击修改"
                @dblclick.stop="startSelectEdit(row.prop)"
              >
                {{ row.value }}
              </div>
            </div>

            <div v-else-if="isNumberEditable(row.prop)" class="customer-detail-number-wrap">
              <el-input-number
                v-if="editingNumberProp === row.prop"
                :model-value="numberModelValue(row.prop)"
                :min="0"
                :precision="row.prop === 'follow_up_cycle' ? 0 : 2"
                :controls="true"
                class="cell-number"
                :disabled="saving"
                @change="(v) => onNumberChange(row.prop, v)"
                @mousedown.stop
              />
              <div
                v-else
                class="editable-plain"
                title="双击修改"
                @dblclick.stop="startNumberEdit(row.prop)"
              >
                {{ row.value }}
              </div>
            </div>

            <div v-else-if="isDateEditable(row.prop)" class="customer-detail-date-wrap">
              <el-date-picker
                v-if="editingDateProp === row.prop"
                class="cell-date-picker"
                :model-value="dateModelValue(row.prop)"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                :disabled="saving"
                teleported
                @change="(v) => onDateChange(row.prop, v)"
                @mousedown.stop
              />
              <div
                v-else
                class="editable-plain"
                title="双击修改"
                @dblclick.stop="startDateEdit(row.prop)"
              >
                {{ row.value }}
              </div>
            </div>

            <div v-else-if="isTextareaEditable(row.prop)" class="customer-detail-textarea-wrap">
              <el-input
                v-if="editingTextareaProp === row.prop"
                v-model="editBuffer"
                type="textarea"
                :rows="3"
                :disabled="saving"
                @blur="commitTextareaEdit"
                @mousedown.stop
              />
              <div
                v-else
                class="editable-plain editable-plain--multiline"
                title="双击修改"
                @dblclick.stop="startTextareaEdit(row.prop)"
              >
                {{ row.value }}
              </div>
            </div>

            <span v-else-if="isReadonly(row.prop)" class="cell-readonly">{{ row.value }}</span>

            <div v-else-if="isTextEditable(row.prop)" class="customer-detail-edit-cell">
              <el-input
                v-if="editingProp === row.prop"
                v-model="editBuffer"
                size="small"
                class="cell-input"
                :disabled="saving"
                @blur="commitTextEdit"
                @keyup.enter="commitTextEdit"
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

    <div class="detail-footer">
      <el-button type="primary" :loading="saving" @click="saveAll">保存</el-button>
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
  gap: 12px;
  min-width: 0;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-table-container {
  flex: 1 1 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-table__grid {
  width: 100%;

  :deep(.el-table__cell) {
    vertical-align: middle;
  }
}

.detail-footer {
  flex: 0 0 auto;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.cell-readonly {
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.editable-plain {
  min-height: 22px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  cursor: text;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.editable-plain--multiline {
  white-space: pre-wrap;
  word-break: break-word;
}

.cell-select,
.cell-number {
  width: 100%;
  max-width: 280px;
}

.cell-date-picker {
  width: 100%;
  max-width: 280px;
}

.cell-input {
  width: 100%;
}
</style>

<style lang="scss">
.customer-detail-select-popper {
  z-index: 3000 !important;
}
</style>
