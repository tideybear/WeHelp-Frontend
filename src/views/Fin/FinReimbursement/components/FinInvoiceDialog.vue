<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

defineOptions({ name: 'FinInvoiceDialog' })

const emit = defineEmits(['confirm'])

const INVOICE_TYPE_OPTIONS = ['增值税专票', '普票', '电子票', '无票']

const dialogVisible = ref(false)
const formRef = ref(null)

const emptyInvoice = () => ({
  invoice_type: '',
  invoice_no: '',
  invoice_code: '',
  invoice_date: '',
  invoice_amount: '',
  tax_rate: '',
  tax_amount: '',
  amount_without_tax: '',
  is_invoice_received: true,
  attachment_ids: [],
  remark: '',
})

// 已添加的发票列表
const invoiceList = ref([])
// 当前正在编辑/新增的发票
const editing = ref(emptyInvoice())
const editingIndex = ref(-1)

const uploadRef = ref(null)
const fileList = ref([])

const rules = {
  invoice_type: [{ required: true, message: '发票类型不能为空', trigger: 'change' }],
  invoice_no: [{ required: true, message: '发票号码不能为空', trigger: 'blur' }],
}

function open(list = []) {
  invoiceList.value = (list || []).map((item) => ({ ...item, attachment_ids: [...(item.attachment_ids || [])] }))
  resetEditing()
  dialogVisible.value = true
}

function resetEditing() {
  editing.value = emptyInvoice()
  editingIndex.value = -1
  fileList.value = []
  uploadRef.value?.clearFiles?.()
}

function handleEdit(row, index) {
  editing.value = { ...row, attachment_ids: [...(row.attachment_ids || [])] }
  editingIndex.value = index
}

function handleCancelEdit() {
  resetEditing()
}

async function handleSaveInvoice() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const item = { ...editing.value }
  if (editingIndex.value >= 0) {
    invoiceList.value = invoiceList.value.map((row, i) => (i === editingIndex.value ? item : row))
  } else {
    invoiceList.value = [...invoiceList.value, item]
  }
  resetEditing()
}

function handleRemove(index) {
  invoiceList.value = invoiceList.value.filter((_, i) => i !== index)
  if (editingIndex.value === index) resetEditing()
}

function handleConfirm() {
  emit('confirm', invoiceList.value.map((item) => ({ ...item })))
  dialogVisible.value = false
}

// ---- 附件上传（样式版，暂未接入后端上传接口）----
function handleFileChange(file, list) {
  const ext = (file.name || '').split('.').pop()?.toLowerCase()
  const isValid = ['jpg', 'jpeg', 'png', 'pdf'].includes(ext)
  const isUnder10MB = (file.size || 0) / 1024 / 1024 < 10
  if (!isValid || !isUnder10MB) {
    ElMessage.error('仅支持 jpg/png/pdf，且单个文件不超过 10MB')
    uploadRef.value?.handleRemove(file)
    return
  }
  fileList.value = [...list]
}

function handleFileRemove(file, list) {
  fileList.value = [...list]
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="发票信息"
    width="860px"
    destroy-on-close
    append-to-body
  >
    <el-table :data="invoiceList" size="small" border max-height="260">
      <el-table-column type="index" label="#" width="50" />
      <el-table-column label="发票类型" width="120">
        <template #default="{ row }">{{ row.invoice_type || '—' }}</template>
      </el-table-column>
      <el-table-column label="发票号码" min-width="140">
        <template #default="{ row }">{{ row.invoice_no || '—' }}</template>
      </el-table-column>
      <el-table-column label="开票日期" width="110">
        <template #default="{ row }">{{ row.invoice_date || '—' }}</template>
      </el-table-column>
      <el-table-column label="发票金额" width="110" align="right">
        <template #default="{ row }">{{ row.invoice_amount || '—' }}</template>
      </el-table-column>
      <el-table-column label="附件数" width="80" align="center">
        <template #default="{ row }">{{ (row.attachment_ids || []).length }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ $index }">
          <el-button link type="primary" @click="handleEdit(invoiceList[$index], $index)">编辑</el-button>
          <el-button link type="danger" @click="handleRemove($index)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <div style="padding: 12px 0; color: #999">暂无发票，请添加</div>
      </template>
    </el-table>

    <el-divider content-position="left">
      {{ editingIndex >= 0 ? '编辑发票' : '新增发票' }}
    </el-divider>

    <el-form ref="formRef" :model="editing" :rules="rules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发票类型" prop="invoice_type">
            <el-select v-model="editing.invoice_type" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in INVOICE_TYPE_OPTIONS"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发票号码" prop="invoice_no">
            <el-input v-model="editing.invoice_no" placeholder="发票号码" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="发票代码">
            <el-input v-model="editing.invoice_code" placeholder="发票代码" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="开票日期">
            <el-date-picker
              v-model="editing.invoice_date"
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
          <el-form-item label="发票金额">
            <el-input v-model="editing.invoice_amount" placeholder="含税金额" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="税率(%)">
            <el-input v-model="editing.tax_rate" placeholder="税率" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="税额">
            <el-input v-model="editing.tax_amount" placeholder="税额" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="不含税金额">
            <el-input v-model="editing.amount_without_tax" placeholder="不含税金额" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="发票附件">
        <el-upload
          ref="uploadRef"
          drag
          multiple
          :auto-upload="false"
          :file-list="fileList"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
        >
          <el-icon class="el-icon--upload"><Upload /></el-icon>
          <div class="el-upload__text">
            将发票拖到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">支持 jpg / png / pdf，单个文件不超过 10MB</div>
          </template>
        </el-upload>
      </el-form-item>

      <el-form-item label="发票备注">
        <el-input v-model="editing.remark" type="textarea" :rows="2" placeholder="发票备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button @click="handleCancelEdit">重置</el-button>
      <el-button type="primary" @click="handleSaveInvoice">
        {{ editingIndex >= 0 ? '保存修改' : '添加发票' }}
      </el-button>
      <el-button type="success" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>
