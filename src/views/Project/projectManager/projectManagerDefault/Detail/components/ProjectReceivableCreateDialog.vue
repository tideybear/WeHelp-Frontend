<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { createFinanceReceivableAPI } from '@/apis/financeReceivables'
import { getProjectDetailAPI } from '@/apis/project'
import { getCustomersListAPI } from '@/apis/sales'
import { useMenu } from '@/stores/menuStore'
import FinanceProductItemsEditor from '@/components/FinanceProductItemsEditor.vue'
import FinancePaymentRecordsEditor from '@/components/FinancePaymentRecordsEditor.vue'
import { validateItemsForSubmit } from '@/utils/financeProductItems'
import { validatePaymentRecordsForSubmit } from '@/utils/financePaymentRecords'
import { formatCreatePaymentMoney } from '@/utils/financeCreatePaymentStatus'
import { useFinanceCreatePaymentSync } from '@/composables/useFinanceCreatePaymentSync'

defineOptions({ name: 'ProjectReceivableCreateDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  projectId: { type: [Number, null], default: null },
})

const emit = defineEmits(['update:modelValue', 'success'])

const menuStore = useMenu()
const { currentNamespaceId } = storeToRefs(menuStore)

const RECEIPT_STATUS_OPTIONS = [
  { label: '待收款', value: '待收款' },
  { label: '部分收款', value: '部分收款' },
  { label: '已收清', value: '已收清' },
  { label: '逾期', value: '逾期' },
]

const createFormRef = ref()
const createSubmitting = ref(false)
const projectName = ref('')
const customerOptions = ref([])
const productItems = ref([])
const itemsTotalAmount = ref(0)
const paymentRecords = ref([])
const paymentRecordsTotal = ref(0)

const createForm = reactive({
  project_id: undefined,
  customer_name: '',
  contract_no: '',
  contract_account: undefined,
  invoice_date: '',
  invoice_no: '',
  invoice_amount: undefined,
  received_amount: 0,
  status: '待收款',
  remark: '',
})

const {
  paymentRecordsAddEnabled,
  paymentRecordsAddHint,
  initPaymentFieldsOnReset,
  applyPaymentSync,
} = useFinanceCreatePaymentSync({
  createForm,
  financeType: 'receivable',
  paymentRecords,
  paymentRecordsTotal,
})

const createRules = {
  customer_name: [{ required: true, message: '请选择客户', trigger: 'change' }],
}

const createInvoiceFieldsEnabled = computed(
  () => String(createForm.invoice_date ?? '').trim() !== '',
)

function syncCreateInvoiceFields() {
  if (createInvoiceFieldsEnabled.value) return
  createForm.invoice_no = ''
  createForm.invoice_amount = undefined
}

watch(() => createForm.invoice_date, syncCreateInvoiceFields)

function resolveProjectDisplayName(row, fallbackId) {
  if (!row || typeof row !== 'object') return ''
  const name = String(row.project_name ?? row.name ?? row.projectname ?? '').trim()
  return name || (fallbackId != null ? String(fallbackId) : '')
}

async function loadProjectName() {
  const pid = props.projectId
  if (pid == null) {
    projectName.value = ''
    return
  }
  try {
    const res = await getProjectDetailAPI({ project_id: pid })
    if (res?.code !== 200) {
      projectName.value = String(pid)
      return
    }
    const rows = Array.isArray(res?.data) ? res.data : []
    projectName.value = resolveProjectDisplayName(rows[0], pid)
  } catch {
    projectName.value = String(pid)
  }
}

async function loadCustomerOptions() {
  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    customerOptions.value = []
    return
  }
  try {
    const res = await getCustomersListAPI(1, 500, { namespace_id: Number(ns) })
    if (res?.code !== 200) {
      customerOptions.value = []
      return
    }
    const list = Array.isArray(res.data) ? res.data : []
    customerOptions.value = list
      .map((s) => {
        const name = String(s.customer_name ?? '').trim()
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
  } catch (e) {
    console.error('加载客户列表失败:', e)
    customerOptions.value = []
  }
}

function onCustomerSelectChange(customerName) {
  const name = String(customerName ?? '').trim()
  if (!name) return
  const row = customerOptions.value.find((o) => o.value === name)
  if (!row) return
  const first = paymentRecords.value[0]
  if (!first) return
  if (row.bank_name) first.payment_bank = String(row.bank_name).trim()
  if (row.bank_account) first.payment_account = String(row.bank_account).trim()
}

function resetCreateForm() {
  createForm.project_id = props.projectId ?? undefined
  createForm.customer_name = ''
  createForm.contract_no = ''
  createForm.contract_account = undefined
  productItems.value = []
  itemsTotalAmount.value = 0
  paymentRecords.value = []
  paymentRecordsTotal.value = 0
  createForm.invoice_date = ''
  createForm.invoice_no = ''
  createForm.invoice_amount = undefined
  initPaymentFieldsOnReset()
  createForm.remark = ''
  applyPaymentSync()
  createFormRef.value?.resetFields?.()
}

async function openPrepare() {
  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return false
  }
  if (props.projectId == null) {
    ElMessage.warning('缺少项目信息，无法新增')
    return false
  }
  await Promise.all([loadProjectName(), loadCustomerOptions()])
  resetCreateForm()
  return true
}

async function onDialogOpen() {
  if (!props.modelValue) return
  const ok = await openPrepare()
  if (!ok) emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) onDialogOpen()
  },
)

async function submitCreate() {
  await createFormRef.value?.validate?.().catch(() => Promise.reject())

  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }
  const pid = props.projectId
  if (pid == null) {
    ElMessage.warning('缺少项目信息')
    return
  }

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

  createSubmitting.value = true
  try {
    const payload = {
      namespace_id: Number(ns),
      project_id: Number(pid),
      customer_name: createForm.customer_name.trim(),
      contract_no: createForm.contract_no.trim() || undefined,
      ...(createForm.contract_account != null && createForm.contract_account !== ''
        ? { contract_account: createForm.contract_account }
        : {}),
      amount: itemCheck.amount,
      ...(itemCheck.items.length ? { items: itemCheck.items } : {}),
      ...(paymentCheck.payment_records.length
        ? { payment_records: paymentCheck.payment_records }
        : {}),
      status: createForm.status,
      received_amount: createForm.received_amount ?? 0,
      remark: createForm.remark.trim() || undefined,
    }
    if (createInvoiceFieldsEnabled.value) {
      payload.invoice_date = createForm.invoice_date
      payload.invoice_no = createForm.invoice_no.trim() || undefined
      if (createForm.invoice_amount != null && createForm.invoice_amount !== '') {
        payload.invoice_amount = createForm.invoice_amount
      }
    }
    const res = await createFinanceReceivableAPI(payload)
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '新增失败')
      return
    }
    ElMessage.success('新增成功')
    emit('update:modelValue', false)
    emit('success')
  } catch (e) {
    console.error('新增应收账款失败:', e)
  } finally {
    createSubmitting.value = false
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="receivables-create-dialog"
    title="新增应收账款"
    width="920px"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetCreateForm"
  >
    <el-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      label-width="96px"
      class="receivables-create-form"
      @submit.prevent
    >
      <div class="form-section-title">基本信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属项目">
            <el-input :model-value="projectName" disabled class="form-field-full" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户" prop="customer_name">
            <el-select
              v-model="createForm.customer_name"
              filterable
              clearable
              placeholder="请选择客户"
              no-data-text="当前空间暂无客户"
              class="form-field-full"
              @change="onCustomerSelectChange"
            >
              <el-option
                v-for="opt in customerOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="合同编号">
            <el-input v-model="createForm.contract_no" clearable placeholder="选填" maxlength="100" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="合同金额">
            <el-input-number
              v-model="createForm.contract_account"
              :min="0"
              :precision="2"
              :controls="true"
              placeholder="选填"
              class="form-field-full"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <FinanceProductItemsEditor
        v-model="productItems"
        v-model:total-amount="itemsTotalAmount"
        amount-label="应收金额合计"
        allow-merge
      />

      <div class="form-section-title">开票信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="开票日期">
            <el-date-picker
              v-model="createForm.invoice_date"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择开票日期"
              clearable
              class="form-field-full"
              @change="syncCreateInvoiceFields"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票号码">
            <el-input
              v-model="createForm.invoice_no"
              clearable
              :disabled="!createInvoiceFieldsEnabled"
              :placeholder="createInvoiceFieldsEnabled ? '选填' : '请先填写「开票日期」'"
              maxlength="100"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="开票金额">
            <el-input-number
              v-model="createForm.invoice_amount"
              :min="0"
              :precision="2"
              :controls="true"
              :disabled="!createInvoiceFieldsEnabled"
              :placeholder="createInvoiceFieldsEnabled ? '选填' : '请先填写「开票日期」'"
              class="form-field-full"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="form-section-title">收款信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="收款状态">
            <el-input
              :model-value="createForm.status"
              disabled
              class="form-field-full"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="实收金额">
            <el-input
              :model-value="formatCreatePaymentMoney(createForm.received_amount)"
              disabled
              class="form-field-full"
            />
            <span class="create-field-hint">根据收款明细自动合计</span>
          </el-form-item>
        </el-col>
      </el-row>

      <FinancePaymentRecordsEditor
        v-model="paymentRecords"
        v-model:total-amount="paymentRecordsTotal"
        section-title="收款明细"
        amount-label="收款明细合计"
        date-label="收款日期"
        bank-label="收款银行"
        account-label="收款账号/流水"
        :add-disabled="!paymentRecordsAddEnabled"
        :add-disabled-hint="paymentRecordsAddHint"
      />

      <el-form-item label="备注">
        <el-input
          v-model="createForm.remark"
          type="textarea"
          :rows="3"
          placeholder="选填"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="submitCreate">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.form-section-title {
  margin: 4px 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;

  &:not(:first-child) {
    margin-top: 16px;
  }
}

.form-field-full {
  width: 100%;
}

.create-field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.receivables-create-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}
</style>

<style lang="scss">
.receivables-create-dialog.el-dialog {
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #79bbff;
  --el-color-primary-light-5: #a0cfff;
  --el-color-primary-light-7: #c6e2ff;
  --el-color-primary-light-8: #d9ecff;
  --el-color-primary-light-9: #ecf5ff;
  --el-color-primary-dark-2: #337ecc;
}
</style>
