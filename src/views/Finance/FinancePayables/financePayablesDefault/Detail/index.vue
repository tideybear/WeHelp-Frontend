<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteFinancePayableAPI,
  getFinancePayableDetailAPI,
  updateFinancePayableAPI,
} from '@/apis/financePayables'
import { getProjectListAPI } from '@/apis/project'
import { getSuppliersListAPI } from '@/apis/purchase'
import FinanceProductItemsEditor from '@/components/FinanceProductItemsEditor.vue'
import FinancePaymentRecordsEditor from '@/components/FinancePaymentRecordsEditor.vue'
import { useMenu } from '@/stores/menuStore'
import { useUserStore } from '@/stores/userStore'
import { formatDateOnly, formatDateTime } from '@/utils/formatDate'
import { formatFinanceListMoney } from '@/utils/financeListDisplay'
import { mapApiItemsToEditorRows, validateItemsForSubmit } from '@/utils/financeProductItems'
import {
  mapApiPaymentRecordsToEditorRows,
  validatePaymentRecordsForSubmit,
} from '@/utils/financePaymentRecords'
import { useFinanceCreatePaymentSync } from '@/composables/useFinanceCreatePaymentSync'

defineOptions({ name: 'FinancePayableDetailDefault' })

const INVOICE_STATUS_OPTIONS = [
  { label: '未开票', value: '未开票' },
  { label: '已开票', value: '已开票' },
  { label: '部分开票', value: '部分开票' },
  { label: '已作废', value: '已作废' },
]

const INVOICE_STATUS_INVOICED = '已开票'

const PAYMENT_STATUS_OPTIONS = [
  { label: '待付款', value: '待付款' },
  { label: '部分付款', value: '部分付款' },
  { label: '已付清', value: '已付清' },
  { label: '逾期', value: '逾期' },
]

const route = useRoute()
const router = useRouter()
const menuStore = useMenu()
const userStore = useUserStore()

const formRef = ref()
const detailLoading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const supplierOptions = ref([])
const projectOptions = ref([])
const productItems = ref([])
const itemsTotalAmount = ref(0)
const paymentRecords = ref([])
const paymentRecordsTotal = ref(0)
const meta = ref({ created_at: '', updated_at: '' })

const form = reactive({
  project_id: undefined,
  customer_name: '',
  contract_no: '',
  contract_account: undefined,
  discount_amount: 0,
  invoice_status: '未开票',
  invoice_no: '',
  invoice_amount: undefined,
  paid_amount: 0,
  status: '待付款',
  remark: '',
})

const {
  paymentRecordsAddEnabled,
  paymentRecordsAddHint,
  applyPaymentSync,
  paidAmountDisplay,
  balanceDisplay,
} = useFinanceCreatePaymentSync({
  createForm: form,
  financeType: 'payable',
  paymentRecords,
  paymentRecordsTotal,
})

const rules = {
  customer_name: [{ required: true, message: '请选择供应商', trigger: 'change' }],
}

const recordId = computed(() => {
  const p = route.params.id
  if (p != null && p !== '') return String(p)
  const q = route.query.id
  return q != null && q !== '' ? String(q) : ''
})

const namespaceId = computed(() => {
  const q = route.query.namespace_id
  if (q != null && q !== '') {
    const n = Number(q)
    return Number.isFinite(n) ? n : undefined
  }
  const ns = menuStore.currentNamespaceId
  return ns != null && ns !== '' ? Number(ns) : undefined
})

const invoiceFieldsEnabled = computed(
  () => form.invoice_status === INVOICE_STATUS_INVOICED,
)

const detailTitle = computed(() => {
  const customer = String(form.customer_name ?? '').trim()
  const contract = String(form.contract_no ?? '').trim()
  if (customer && contract) return `应付账款 · ${customer} · ${contract}`
  if (customer) return `应付账款 · ${customer}`
  return '应付账款详情'
})

const amountDisplay = computed(() => formatFinanceListMoney(itemsTotalAmount.value) || '0.00')

function syncInvoiceFields() {
  if (invoiceFieldsEnabled.value) return
  form.invoice_no = ''
  form.invoice_amount = undefined
}

watch(() => form.invoice_status, syncInvoiceFields)

function toNumberOrUndefined(val) {
  if (val == null || val === '') return undefined
  const n = Number(val)
  return Number.isFinite(n) ? n : undefined
}

function applyDetailToForm(data) {
  const d = data || {}
  form.project_id =
    d.project_id != null && d.project_id !== '' ? Number(d.project_id) : undefined
  form.customer_name = String(d.customer_name ?? '')
  form.contract_no = String(d.contract_no ?? '')
  form.contract_account = toNumberOrUndefined(d.contract_account)
  form.discount_amount = toNumberOrUndefined(d.discount_amount) ?? 0
  form.invoice_status = String(d.invoice_status ?? '未开票') || '未开票'
  form.invoice_no = String(d.invoice_no ?? '')
  form.invoice_amount = toNumberOrUndefined(d.invoice_amount)
  form.paid_amount = toNumberOrUndefined(d.paid_amount)
  form.status = String(d.status ?? '待付款') || '待付款'
  form.remark = String(d.remark ?? '')
  productItems.value = mapApiItemsToEditorRows(d.items)
  paymentRecords.value = mapApiPaymentRecordsToEditorRows(d.payment_records)
  meta.value = {
    created_at: d.created_at ? formatDateTime(d.created_at) : '',
    updated_at: d.updated_at ? formatDateTime(d.updated_at) : '',
  }
  applyPaymentSync()
}

async function loadSupplierOptions() {
  const ns = namespaceId.value
  if (ns == null) {
    supplierOptions.value = []
    return
  }
  try {
    const res = await getSuppliersListAPI(1, 500, { namespace_id: ns })
    const list = res?.code === 200 && Array.isArray(res.data) ? res.data : []
    const opts = list
      .map((s) => {
        const name = String(s.supplier_name ?? '').trim()
        if (!name) return null
        return {
          id: s.id,
          label: name,
          value: name,
          bank_name: s.bank_name,
          bank_account: s.bank_account,
        }
      })
      .filter(Boolean)
    const current = String(form.customer_name ?? '').trim()
    if (current && !opts.some((o) => o.value === current)) {
      opts.unshift({ label: current, value: current })
    }
    supplierOptions.value = opts
  } catch (e) {
    console.error('加载供应商列表失败:', e)
    supplierOptions.value = []
  }
}

async function loadProjectOptions() {
  const ns = namespaceId.value
  const uid = userStore.userInfo?.id
  if (ns == null || uid == null || uid === '') {
    projectOptions.value = []
    return
  }
  try {
    const res = await getProjectListAPI({ namespace_id: ns, user_id: Number(uid) })
    const list = res?.code === 200 && Array.isArray(res.data) ? res.data : []
    const opts = list
      .filter((p) => p?.id != null)
      .map((p) => ({
        label: String(p.project_name ?? p.name ?? p.id).trim() || String(p.id),
        value: Number(p.id),
      }))
    const pid = form.project_id
    if (pid != null && !opts.some((o) => Number(o.value) === Number(pid))) {
      opts.unshift({ label: String(pid), value: Number(pid) })
    }
    projectOptions.value = opts
  } catch (e) {
    console.error('加载项目列表失败:', e)
    projectOptions.value = []
  }
}

function onSupplierChange(customerName) {
  const name = String(customerName ?? '').trim()
  if (!name) return
  const row = supplierOptions.value.find((o) => o.value === name)
  if (!row) return
  const first = paymentRecords.value[0]
  if (!first) return
  if (row.bank_name) first.payment_bank = String(row.bank_name).trim()
  if (row.bank_account) first.payment_account = String(row.bank_account).trim()
}

function buildSavePayload(itemCheck, paymentCheck) {
  const payload = {
    id: Number(recordId.value),
    customer_name: form.customer_name.trim(),
    contract_no: form.contract_no.trim() || undefined,
    amount: itemCheck.amount,
    items: itemCheck.items,
    payment_records: paymentCheck.payment_records,
    invoice_status: form.invoice_status,
    status: form.status,
    paid_amount: form.paid_amount ?? 0,
    remark: form.remark.trim() || undefined,
  }
  if (form.project_id != null && form.project_id !== '') {
    payload.project_id = Number(form.project_id)
  } else {
    payload.project_id = null
  }
  if (form.contract_account != null && form.contract_account !== '') {
    payload.contract_account = form.contract_account
  }
  payload.discount_amount = form.discount_amount ?? 0
  if (invoiceFieldsEnabled.value) {
    payload.invoice_no = form.invoice_no.trim() || undefined
    if (form.invoice_amount != null && form.invoice_amount !== '') {
      payload.invoice_amount = form.invoice_amount
    }
  } else {
    payload.invoice_no = null
    payload.invoice_amount = null
  }
  return payload
}

async function loadDetailFromApi() {
  const id = recordId.value
  if (!id) return
  detailLoading.value = true
  try {
    const res = await getFinancePayableDetailAPI(id)
    if (res?.code !== 200 || !res.data) {
      ElMessage.error(res?.msg || '加载详情失败')
      return
    }
    applyDetailToForm(res.data)
    await Promise.all([loadSupplierOptions(), loadProjectOptions()])
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function saveAll() {
  await formRef.value?.validate?.().catch(() => Promise.reject())
  const itemCheck = validateItemsForSubmit(productItems.value)
  if (!itemCheck.ok) {
    ElMessage.warning(itemCheck.message)
    return
  }
  const paymentCheck = validatePaymentRecordsForSubmit(paymentRecords.value)
  if (!paymentCheck.ok) {
    ElMessage.warning(paymentCheck.message)
    return
  }
  applyPaymentSync()
  saving.value = true
  try {
    const res = await updateFinancePayableAPI(buildSavePayload(itemCheck, paymentCheck))
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

async function deleteRecord() {
  const id = recordId.value
  if (!id) {
    ElMessage.warning('缺少记录 id，无法删除')
    return
  }
  const ns = namespaceId.value
  if (ns == null) {
    ElMessage.warning('请先选择空间')
    return
  }
  try {
    await ElMessageBox.confirm('确认删除该应付账款？删除后不可恢复。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    ElMessage.info('已取消删除')
    return
  }
  deleting.value = true
  try {
    const res = await deleteFinancePayableAPI({ id: Number(id), namespace_id: ns })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除失败')
      return
    }
    ElMessage.success(res?.msg || '删除成功')
    goBack()
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  } finally {
    deleting.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'FinancePayables' })
}

onMounted(async () => {
  if (recordId.value) {
    await loadDetailFromApi()
  }
})

watch(namespaceId, () => {
  loadSupplierOptions()
  loadProjectOptions()
})
</script>

<template>
  <div class="finance-detail-page" v-loading="detailLoading">
    <div class="detail-header-row">
      <div class="detail-header-left">
        <el-button type="primary" plain size="small" @click="goBack">返回列表</el-button>
        <span class="detail-title">{{ detailTitle }}</span>
      </div>
    </div>

    <div class="detail-body">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="finance-detail-form"
        @submit.prevent
      >
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="所属项目">
              <el-select
                v-model="form.project_id"
                placeholder="选填"
                filterable
                clearable
                class="form-field-full"
                :disabled="saving || deleting"
              >
                <el-option
                  v-for="opt in projectOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customer_name">
              <el-select
                v-model="form.customer_name"
                filterable
                clearable
                placeholder="请选择供应商"
                class="form-field-full"
                :disabled="saving || deleting"
                @change="onSupplierChange"
              >
                <el-option
                  v-for="opt in supplierOptions"
                  :key="opt.id ?? opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同编号">
              <el-input
                v-model="form.contract_no"
                clearable
                placeholder="选填"
                maxlength="100"
                :disabled="saving || deleting"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同金额">
              <el-input-number
                v-model="form.contract_account"
                :min="0"
                :precision="2"
                :controls="true"
                placeholder="选填"
                class="form-field-full"
                :disabled="saving || deleting"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优惠金额">
              <el-input-number
                v-model="form.discount_amount"
                :min="0"
                :precision="2"
                :controls="true"
                placeholder="选填，默认 0"
                class="form-field-full"
                :disabled="saving || deleting"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <FinanceProductItemsEditor
          v-model="productItems"
          v-model:total-amount="itemsTotalAmount"
          layout="wide"
          amount-label="金额合计"
          allow-merge
          :disabled="saving || deleting"
        />

        <div class="form-section-title">开票信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开票状态">
              <el-select
                v-model="form.invoice_status"
                placeholder="请选择"
                class="form-field-full"
                :disabled="saving || deleting"
                @change="syncInvoiceFields"
              >
                <el-option
                  v-for="opt in INVOICE_STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发票号码">
              <el-input
                v-model="form.invoice_no"
                clearable
                :disabled="!invoiceFieldsEnabled || saving || deleting"
                :placeholder="invoiceFieldsEnabled ? '选填' : '请先选择「已开票」'"
                maxlength="100"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开票金额">
              <el-input-number
                v-model="form.invoice_amount"
                :min="0"
                :precision="2"
                :controls="true"
                :disabled="!invoiceFieldsEnabled || saving || deleting"
                :placeholder="invoiceFieldsEnabled ? '选填' : '请先选择「已开票」'"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title form-section-title--spaced">付款信息</div>
        <el-row :gutter="20" class="finance-summary-row">
          <el-col :xs="24" :sm="8">
            <el-form-item label="付款状态">
              <el-input
                :model-value="form.status"
                disabled
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="实付金额">
              <el-input
                :model-value="paidAmountDisplay"
                disabled
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="未付金额">
              <span class="readonly-amount">{{ balanceDisplay }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <FinancePaymentRecordsEditor
          v-model="paymentRecords"
          v-model:total-amount="paymentRecordsTotal"
          layout="wide"
          section-title="付款明细"
          amount-label="付款明细合计"
          date-label="付款日期"
          bank-label="付款银行"
          account-label="付款账号/流水"
          :add-disabled="!paymentRecordsAddEnabled || saving || deleting"
          :add-disabled-hint="paymentRecordsAddHint"
          :disabled="saving || deleting"
        />

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
            maxlength="500"
            show-word-limit
            :disabled="saving || deleting"
          />
        </el-form-item>

        <div v-if="meta.created_at || meta.updated_at" class="form-section-title">系统信息</div>
        <el-row v-if="meta.created_at || meta.updated_at" :gutter="16">
          <el-col v-if="meta.created_at" :span="12">
            <el-form-item label="创建时间">
              <span class="readonly-text">{{ meta.created_at }}</span>
            </el-form-item>
          </el-col>
          <el-col v-if="meta.updated_at" :span="12">
            <el-form-item label="更新时间">
              <span class="readonly-text">{{ meta.updated_at }}</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="detail-footer">
      <el-button
        type="danger"
        plain
        :loading="deleting"
        :disabled="saving || !recordId"
        @click="deleteRecord"
      >
        删除
      </el-button>
      <el-button type="primary" :loading="saving" :disabled="deleting || !recordId" @click="saveAll">
        保存
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-detail-page {
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

.detail-body {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 24px;
}

.finance-detail-form {
  width: 100%;
  max-width: none;
  min-width: 0;
}

.finance-detail-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.finance-summary-row {
  max-width: 960px;
}

.form-section-title {
  margin: 0 0 14px;
  padding-left: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  border-left: 3px solid var(--el-color-primary);
}

.form-section-title--spaced {
  margin-top: 8px;
}

.finance-detail-form :deep(.finance-items-editor),
.finance-detail-form :deep(.finance-payment-editor) {
  margin-left: 0;
  margin-right: 0;
}

.form-field-full {
  width: 100%;
}

.readonly-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.readonly-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.detail-footer {
  flex: 0 0 auto;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
