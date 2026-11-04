<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createFinReimbursementAPI } from '@/apis/fin'
import { useNamespace } from '@/stores/namespaceStore'

defineOptions({ name: 'FinReimbursementCreateDialog' })

const emit = defineEmits(['success'])

const namespaceStore = useNamespace()

const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const EXPENSE_TYPE_OPTIONS = ['交通', '餐饮', '住宿', '办公用品', '差旅', '招待', '维修', '活动物料', '其他']
const INVOICE_TYPE_OPTIONS = ['增值税专票', '普票', '电子票', '无票']

const emptyForm = () => ({
  applicant: '',
  applicant_dept: '',
  apply_date: '',
  expense_date: '',
  expense_type: '',
  expense_amount: '',
  expense_currency: 'CNY',
  expense_desc: '',
  expense_remark: '',
  invoice_type: '',
  invoice_no: '',
  invoice_code: '',
  invoice_date: '',
  is_invoice_received: false,
  related_flow_no: '',
  remark: '',
})

const form = ref(emptyForm())

const rules = {
  applicant: [{ required: true, message: '申请人不能为空', trigger: 'blur' }],
  apply_date: [{ required: true, message: '申请日期不能为空', trigger: 'change' }],
  expense_date: [{ required: true, message: '费用日期不能为空', trigger: 'change' }],
  expense_type: [{ required: true, message: '费用类型不能为空', trigger: 'change' }],
  expense_amount: [{ required: true, message: '费用金额不能为空', trigger: 'blur' }],
}

function open() {
  form.value = emptyForm()
  dialogVisible.value = true
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
      applicant_dept: f.applicant_dept,
      apply_date: f.apply_date,
      expense_date: f.expense_date,
      expense_type: f.expense_type,
      expense_amount: f.expense_amount,
      expense_currency: f.expense_currency,
      expense_desc: f.expense_desc,
      expense_remark: f.expense_remark,
      invoice_type: f.invoice_type,
      invoice_no: f.invoice_no,
      invoice_code: f.invoice_code,
      invoice_date: f.invoice_date,
      is_invoice_received: f.is_invoice_received ? 1 : 0,
      related_flow_no: f.related_flow_no,
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
            <el-input v-model="form.applicant" placeholder="申请人姓名" />
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
          <el-form-item label="发票类型">
            <el-select v-model="form.invoice_type" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in INVOICE_TYPE_OPTIONS"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发票号码">
            <el-input v-model="form.invoice_no" placeholder="发票号码" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票代码">
            <el-input v-model="form.invoice_code" placeholder="发票代码" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发票日期">
            <el-date-picker
              v-model="form.invoice_date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="已收发票">
            <el-switch v-model="form.is_invoice_received" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="费用说明">
        <el-input v-model="form.expense_desc" type="textarea" :rows="2" placeholder="费用说明" />
      </el-form-item>

      <el-form-item label="费用备注">
        <el-input v-model="form.expense_remark" type="textarea" :rows="2" placeholder="费用备注" />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="关联流水号">
            <el-input v-model="form.related_flow_no" placeholder="关联流水号" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="备注">
            <el-input v-model="form.remark" placeholder="备注" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
