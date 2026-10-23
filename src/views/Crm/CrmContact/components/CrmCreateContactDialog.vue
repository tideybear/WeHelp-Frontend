<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCrmCustomerContactAPI } from '@/apis/crm'
import { useNamespace } from '@/stores/namespaceStore'
import {
  emptyContactForm,
  buildContactPayload,
  loadCustomerOptions,
  normalizeCustomerId,
} from './shared'
import CrmContactFormFields from './CrmContactFormFields.vue'

defineOptions({ name: 'CrmCreateContactDialog' })

const props = defineProps({
  /**
   * 固定所属客户 ID。
   * 传入后弹窗内不再提供客户切换（客户详情页场景：新增的联系人归属于当前客户）。
   */
  fixedCustomerId: {
    type: [String, Number],
    default: '',
  },
  /** 固定客户的展示名（可选） */
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
const formRef = ref(null)

const form = ref(emptyContactForm())
const customerOptions = ref([])
const customerOptionsLoading = ref(false)

const rules = {
  name: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
}

// 优先用外部传入的 namespaceId，其次取当前空间
function currentNamespaceId() {
  if (props.namespaceId != null && props.namespaceId !== '') return props.namespaceId
  return namespaceStore.currentNamespaceId
}

// 打开弹窗：重置表单并加载可选客户
async function open() {
  const fixedId = normalizeCustomerId(props.fixedCustomerId)
  form.value = { ...emptyContactForm(), customer_id: fixedId }
  customerOptions.value = []
  dialogVisible.value = true

  // 固定客户模式下不需要加载客户下拉（弹窗内不提供切换）
  if (fixedId !== '') {
    customerOptionsLoading.value = false
    return
  }
  await loadOptions()
}

async function loadOptions() {
  customerOptionsLoading.value = true
  try {
    customerOptions.value = await loadCustomerOptions(currentNamespaceId())
  } catch (e) {
    console.error('获取客户列表失败:', e)
    customerOptions.value = []
  } finally {
    customerOptionsLoading.value = false
  }
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
    const res = await createCrmCustomerContactAPI(payload)
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '保存失败')
      return
    }
    ElMessage.success('新增成功')
    dialogVisible.value = false
    emit('success')
  } catch (e) {
    console.error('新增联系人失败:', e)
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
    title="新增联系人"
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
        :fixed-customer-name="fixedCustomerName"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
