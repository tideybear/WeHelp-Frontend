<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createCrmFollowUpRecordAPI, updateCrmFollowUpRecordAPI } from '@/apis/crm'
import { useNamespace } from '@/stores/namespaceStore'
import {
  emptyFollowUpForm,
  buildFollowUpPayload,
  loadCustomerOptions,
  loadContactOptions,
  loadOwnerOptions,
  toDateTimeValue,
  FOLLOW_UP_TYPE_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  DIRECTION_OPTIONS,
  CHANNEL_OPTIONS,
  PRIORITY_OPTIONS,
} from './shared'

defineOptions({ name: 'CrmFollowUpRecordDialog' })

const props = defineProps({
  /** 编辑时传入记录 id，为空则为新增 */
  recordId: {
    type: [String, Number],
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

const form = ref(emptyFollowUpForm())
const customerOptions = ref([])
const contactOptions = ref([])
const ownerOptions = ref([])
const optionsLoading = ref(false)

const rules = {
  customer_id: [{ required: true, message: '所属客户不能为空', trigger: 'change' }],
  follow_up_at: [{ required: true, message: '跟进时间不能为空', trigger: 'change' }],
  content: [{ required: true, message: '跟进内容不能为空', trigger: 'blur' }],
}

// 优先用外部传入的 namespaceId，其次取当前空间
function currentNamespaceId() {
  if (props.namespaceId != null && props.namespaceId !== '') return props.namespaceId
  return namespaceStore.currentNamespaceId
}

// 所属客户下的联系人：未选客户时不做过滤
const filteredContactOptions = computed(() => {
  const cid = form.value.customer_id
  if (cid === '' || cid == null) return contactOptions.value
  return contactOptions.value.filter((item) => item.customer_id === Number(cid))
})

// 打开弹窗：新增时重置表单，编辑时回填行数据
function open(row) {
  editingId.value = row?.id ?? null

  if (row) {
    form.value = {
      customer_id: row.customer_id == null ? '' : Number(row.customer_id),
      contact_id: row.contact_id == null ? '' : Number(row.contact_id),
      follow_up_at: toDateTimeValue(row.follow_up_at),
      follow_up_type_id: row.follow_up_type_id == null ? '' : Number(row.follow_up_type_id),
      follow_up_status_id:
        row.follow_up_status_id == null ? '' : Number(row.follow_up_status_id),
      owner_id: row.owner_id == null ? '' : Number(row.owner_id),
      direction: row.direction == null ? '' : Number(row.direction),
      channel: row.channel ?? '',
      priority: Number(row.priority ?? 0),
      subject: row.subject ?? '',
      content: row.content ?? '',
      result: row.result ?? '',
      next_follow_up_at: toDateTimeValue(row.next_follow_up_at),
      next_action: row.next_action ?? '',
      language: row.language ?? '',
      message_body: row.message_body ?? '',
    }
  } else {
    form.value = emptyFollowUpForm()
  }

  dialogVisible.value = true
  loadOptions()
}

// 加载下拉选项
async function loadOptions() {
  optionsLoading.value = true
  try {
    const ns = currentNamespaceId()
    const [customers, contacts, owners] = await Promise.all([
      loadCustomerOptions(ns),
      loadContactOptions(ns),
      loadOwnerOptions(ns),
    ])
    customerOptions.value = customers
    contactOptions.value = contacts
    ownerOptions.value = owners
  } catch (e) {
    console.error('获取下拉选项失败:', e)
    customerOptions.value = []
    contactOptions.value = []
    ownerOptions.value = []
  } finally {
    optionsLoading.value = false
  }
}

// 切换客户时清掉不属于该客户的联系人
watch(
  () => form.value.customer_id,
  (val) => {
    const cid = val === '' ? null : Number(val)
    if (form.value.contact_id !== '' && form.value.contact_id != null) {
      const match = contactOptions.value.find(
        (item) => item.id === Number(form.value.contact_id),
      )
      if (!match || (cid != null && match.customer_id !== cid)) {
        form.value.contact_id = ''
      }
    }
  },
)

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = buildFollowUpPayload(form.value, currentNamespaceId())
    const res = editingId.value
      ? await updateCrmFollowUpRecordAPI(Number(editingId.value), payload)
      : await createCrmFollowUpRecordAPI(payload)
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '保存失败')
      return
    }
    ElMessage.success(editingId.value ? '更新成功' : '新增成功')
    dialogVisible.value = false
    emit('success')
  } catch (e) {
    console.error('保存跟进记录失败:', e)
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
    :title="editingId ? '编辑跟进记录' : '新增跟进记录'"
    width="760px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属客户" prop="customer_id">
            <el-select
              v-model="form.customer_id"
              placeholder="请选择客户"
              filterable
              :loading="optionsLoading"
              style="width: 100%"
            >
              <el-option
                v-for="item in customerOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="对接人">
            <el-select
              v-model="form.contact_id"
              placeholder="请选择联系人"
              filterable
              clearable
              :loading="optionsLoading"
              style="width: 100%"
            >
              <el-option
                v-for="item in filteredContactOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="跟进时间" prop="follow_up_at">
            <el-date-picker
              v-model="form.follow_up_at"
              type="datetime"
              placeholder="选择时间"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="跟进方式">
            <el-select v-model="form.follow_up_type_id" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in FOLLOW_UP_TYPE_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="跟进后状态">
            <el-select v-model="form.follow_up_status_id" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in FOLLOW_UP_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="跟进人">
            <el-select
              v-model="form.owner_id"
              placeholder="请选择"
              filterable
              clearable
              :loading="optionsLoading"
              style="width: 100%"
            >
              <el-option
                v-for="item in ownerOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="方向">
            <el-select v-model="form.direction" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in DIRECTION_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="渠道">
            <el-select v-model="form.channel" placeholder="请选择" clearable style="width: 100%">
              <el-option
                v-for="item in CHANNEL_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="优先级">
            <el-select v-model="form.priority" placeholder="请选择" style="width: 100%">
              <el-option
                v-for="item in PRIORITY_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="沟通语言">
            <el-input v-model="form.language" placeholder="如 English" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="主题">
        <el-input v-model="form.subject" placeholder="本次跟进的主题" />
      </el-form-item>

      <el-form-item label="跟进内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="3"
          placeholder="跟进内容"
        />
      </el-form-item>

      <el-form-item label="跟进结果">
        <el-input
          v-model="form.result"
          type="textarea"
          :rows="2"
          placeholder="本次跟进的结果"
        />
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="下次跟进">
            <el-date-picker
              v-model="form.next_follow_up_at"
              type="datetime"
              placeholder="选择时间"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="下一步动作">
            <el-input v-model="form.next_action" placeholder="下一步动作" />
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
