<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { createFinReimbursementAPI } from '@/apis/fin'
import { useNamespace } from '@/stores/namespaceStore'
import { useUserStore } from '@/stores/userStore'
import FinInvoiceDialog from './FinInvoiceDialog.vue'

defineOptions({ name: 'FinReimbursementCreateDialog' })

const emit = defineEmits(['success'])

const namespaceStore = useNamespace()
const userStore = useUserStore()

const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const invoiceDialogRef = ref(null)

const EXPENSE_TYPE_OPTIONS = ['交通', '餐饮', '住宿', '办公用品', '差旅', '招待', '维修', '活动物料', '其他']

const emptyForm = () => ({
  applicant: '',
  applicant_dept: '',
  apply_date: today(),
  expense_date: '',
  expense_type: '',
  expense_amount: '',
  expense_currency: 'CNY',
  expense_desc: '',
  expense_remark: '',
  invoices: [],
  remark: '',
})

// 当前日期 YYYY-MM-DD
function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 申请人下拉选项（来自 userStore.userList）
const applicantOptions = computed(() =>
  (userStore.userList || []).map((item) => ({
    id: item.id,
    name: item.full_name_en ??item.full_name ?? item.name ?? item.account ?? `用户 ${item.id}`,
    dept: item.department_code ?? item.department ?? item.dept ?? item.dept_name ?? '',
  })),
)

function handleApplicantChange(id) {
  const user = applicantOptions.value.find((item) => String(item.id) === String(id))
  if (!user) {
    form.value.applicant = ''
    form.value.applicant_dept = ''
    return
  }
  // applicant 与 created_by 均写入 user_id
  form.value.applicant = String(user.id)
  form.value.applicant_dept = user.dept || ''
}

const form = ref(emptyForm())

const rules = {
  applicant: [{ required: true, message: '申请人不能为空', trigger: 'change' }],
  apply_date: [{ required: true, message: '申请日期不能为空', trigger: 'change' }],
  expense_date: [{ required: true, message: '费用日期不能为空', trigger: 'change' }],
  expense_type: [{ required: true, message: '费用类型不能为空', trigger: 'change' }],
  expense_amount: [{ required: true, message: '费用金额不能为空', trigger: 'blur' }],
}

function open() {
  form.value = emptyForm()
  dialogVisible.value = true
  loadApplicantOptions()
}

// 拉取当前空间的用户列表（userStore 中为空时）
async function loadApplicantOptions() {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') return
  if ((userStore.userList || []).length > 0) return
  try {
    await userStore.fetchUserList(Number(ns))
  } catch (e) {
    console.error('获取用户列表失败:', e)
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }

  submitting.value = true
  try {
    const f = form.value
    const res = await createFinReimbursementAPI({
      namespace_id: Number(ns),
      applicant: f.applicant,
      created_by: f.applicant,
      applicant_dept: f.applicant_dept,
      apply_date: f.apply_date,
      expense_date: f.expense_date,
      expense_type: f.expense_type,
      expense_amount: f.expense_amount,
      expense_currency: f.expense_currency,
      expense_desc: f.expense_desc,
      expense_remark: f.expense_remark,
      invoices: f.invoices.map((item) => ({
        invoice_type: item.invoice_type,
        invoice_no: item.invoice_no,
        invoice_code: item.invoice_code,
        invoice_date: item.invoice_date,
        invoice_amount: item.invoice_amount,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        amount_without_tax: item.amount_without_tax,
        is_invoice_received: item.is_invoice_received ? 1 : 0,
        attachment_ids: item.attachment_ids,
        remark: item.remark,
      })),
      remark: f.remark,
    })
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '新增失败')
      return
    }
    ElMessage.success('新增成功')
    dialogVisible.value = false
    emit('success')
  } catch (e) {
    console.error('新增报销明细失败:', e)
    ElMessage.error('新增失败')
  } finally {
    submitting.value = false
  }
}

function handleClosed() {
  formRef.value?.clearValidate?.()
}

// ---- 发票弹窗 ----
function handleOpenInvoiceDialog() {
  invoiceDialogRef.value?.open(form.value.invoices)
}

function handleInvoicesConfirm(list) {
  form.value.invoices = list
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="新增报销明细"
    width="760px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="申请人" prop="applicant">
            <el-select
              v-model="form.applicant"
              placeholder="请选择申请人"
              filterable
              clearable
              style="width: 100%"
              @change="handleApplicantChange"
            >
              <el-option
                v-for="item in applicantOptions"
                :key="item.id"
                :label="item.name"
                :value="String(item.id)"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="申请部门">
            <el-input v-model="form.applicant_dept" placeholder="所属部门" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="申请日期" prop="apply_date">
            <el-date-picker
              v-model="form.apply_date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              disabled
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="费用日期" prop="expense_date">
            <el-date-picker
              v-model="form.expense_date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="费用类型" prop="expense_type">
            <el-select v-model="form.expense_type" placeholder="请选择" style="width: 100%">
              <el-option
                v-for="item in EXPENSE_TYPE_OPTIONS"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="费用金额" prop="expense_amount">
            <el-input v-model="form.expense_amount" placeholder="请输入金额" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="币种">
            <el-select v-model="form.expense_currency" placeholder="请选择" style="width: 100%">
              <el-option label="CNY" value="CNY" />
              <el-option label="USD" value="USD" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票">
            <el-button type="primary" plain @click="handleOpenInvoiceDialog">
              发票信息（{{ form.invoices.length }}）
            </el-button>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="费用说明">
        <el-input v-model="form.expense_desc" type="textarea" :rows="2" placeholder="费用说明" />
      </el-form-item>

      <el-form-item label="费用备注">
        <el-input v-model="form.expense_remark" type="textarea" :rows="2" placeholder="费用备注" />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.remark" placeholder="备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>

  <FinInvoiceDialog
    ref="invoiceDialogRef"
    @confirm="handleInvoicesConfirm"
  />
</template>
