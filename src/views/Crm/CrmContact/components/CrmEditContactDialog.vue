<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { updateCrmCustomerContactAPI } from '@/apis/crm'
import { useNamespace } from '@/stores/namespaceStore'
import {
  emptyContactForm,
  buildContactPayload,
  loadCustomerOptions,
  customerDisplayName,
  normalizeCustomerId,
} from './shared'
import CrmContactFormFields from './CrmContactFormFields.vue'

defineOptions({ name: 'CrmEditContactDialog' })

const props = defineProps({
  /**
   * 固定所属客户 ID。
   * 传入后弹窗内不再提供客户切换（客户详情页场景：联系人归属于当前客户）。
   */
  fixedCustomerId: {
    type: [String, Number],
    default: '',
  },
  /** 固定客户的展示名（可选，缺省时从行数据/客户列表推导） */
  fixedCustomerName: {
    type: String,
    default: '',
  },
  /** 命名空间 ID，缺省时取当前空间 */
  namespaceId: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits(['success'])

const namespaceStore = useNamespace()

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const formRef = ref(null)

const form = ref(emptyContactForm())
const customerOptions = ref([])
const customerOptionsLoading = ref(false)
const resolvedCustomerName = ref('')

const rules = {
  name: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
}

// 优先用外部传入的 namespaceId，其次取当前空间
function currentNamespaceId() {
  if (props.namespaceId != null && props.namespaceId !== '') return props.namespaceId
  return namespaceStore.currentNamespaceId
}

// 打开弹窗：回填行数据
function open(row) {
  editingId.value = row?.id ?? null

  // 固定客户优先：客户详情页的联系人归属于当前客户
  const fixedId = normalizeCustomerId(props.fixedCustomerId)
  const customerId = fixedId !== '' ? fixedId : normalizeCustomerId(row?.customer_id)

  form.value = {
    customer_id: customerId,
    name: row?.name ?? '',
    title: row?.title ?? '',
    department: row?.department ?? '',
    gender: Number(row?.gender ?? 0),
    phone: row?.phone ?? '',
    mobile: row?.mobile ?? '',
    email: row?.email ?? '',
    wechat: row?.wechat ?? '',
    whatsapp: row?.whatsapp ?? '',
    linkedin: row?.linkedin ?? '',
    language: row?.language ?? '',
    is_primary: Number(row?.is_primary ?? 0),
    birthday: row?.birthday ?? '',
    notes: row?.notes ?? '',
  }

  // 固定客户模式下展示只读客户名；非固定模式留空，交回可选择的 el-select
  const isFixedCustomer = normalizeCustomerId(props.fixedCustomerId) !== ''
  resolvedCustomerName.value = isFixedCustomer
    ? props.fixedCustomerName || customerDisplayName(row)
    : ''

  customerOptions.value = []
  dialogVisible.value = true
  loadOptions(row)
}

async function loadOptions(row) {
  // 固定客户模式下不需要加载客户下拉（弹窗内不提供切换）
  if (normalizeCustomerId(props.fixedCustomerId) !== '') {
    customerOptions.value = []
    customerOptionsLoading.value = false
    return
  }

  customerOptionsLoading.value = true
  try {
    const options = await loadCustomerOptions(currentNamespaceId())
    customerOptions.value = ensureCurrentCustomer(options, row)
  } catch (e) {
    console.error('获取客户列表失败:', e)
    customerOptions.value = ensureCurrentCustomer([], row)
  } finally {
    customerOptionsLoading.value = false
  }
}

// 客户列表接口有分页上限，当前联系人所属的客户可能不在拉取结果中。
// 此时补一条选项，避免下拉框因找不到对应 option 而显示空白/原始 id。
function ensureCurrentCustomer(options, row) {
  const customerId = row?.customer_id
  if (customerId == null || customerId === '') return options
  const id = normalizeCustomerId(customerId)
  if (id === '') return options
  if (options.some((opt) => opt.id === id)) return options
  return [...options, { id, name: customerDisplayName(row) }]
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = buildContactPayload(form.value, currentNamespaceId())
    const res = await updateCrmCustomerContactAPI(Number(editingId.value), payload)
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '保存失败')
      return
    }
    ElMessage.success('更新成功')
    dialogVisible.value = false
    emit('success')
  } catch (e) {
    console.error('更新联系人失败:', e)
    ElMessage.error('保存失败')
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
    title="编辑联系人"
    width="720px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <CrmContactFormFields
        :form="form"
        :customer-options="customerOptions"
        :customer-options-loading="customerOptionsLoading"
        :customer-fixed="normalizeCustomerId(fixedCustomerId) !== ''"
        :fixed-customer-name="resolvedCustomerName"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
