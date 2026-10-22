<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCrmCustomerContactListAPI,
  createCrmCustomerContactAPI,
  updateCrmCustomerContactAPI,
  deleteCrmCustomerContactAPI,
} from '@/apis/crm'

defineOptions({ name: 'CrmCustomerContacts' })

const props = defineProps({
  /** 客户 ID（crm_contacts.customer_id） */
  customerId: {
    type: [String, Number],
    default: '',
  },
  /** 命名空间 ID */
  namespaceId: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits(['refresh'])

const loading = ref(false)
const submitting = ref(false)
const contactList = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

// gender: 0未知 1男 2女
const GENDER_OPTIONS = [
  { label: '未知', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]

const LANGUAGE_OPTIONS = ['中文', 'English', 'French', 'German', 'Arabic', 'Spanish', 'Japanese']

const emptyForm = () => ({
  name: '',
  title: '',
  department: '',
  gender: 0,
  phone: '',
  mobile: '',
  email: '',
  wechat: '',
  whatsapp: '',
  linkedin: '',
  language: '',
  is_primary: 0,
  birthday: '',
  notes: '',
})

const form = ref(emptyForm())

const rules = {
  name: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
}

function genderLabel(value) {
  return GENDER_OPTIONS.find((i) => i.value === Number(value))?.label || '未知'
}

// 单元格取值：空值统一显示 —
function cellText(row, prop) {
  const v = row[prop]
  if (v == null || v === '') return '—'
  return v
}

// 加载联系人列表
async function loadContacts() {
  const cid = props.customerId
  if (cid == null || cid === '') {
    contactList.value = []
    return
  }

  loading.value = true
  try {
    const params = {
      customer_id: Number(cid),
      page: 1,
      page_size: 100,
    }
    if (props.namespaceId != null && props.namespaceId !== '') {
      params.namespace_id = Number(props.namespaceId)
    }

    const res = await getCrmCustomerContactListAPI(params)
    const result = res?.result ?? res
    contactList.value = result?.list ?? result?.data ?? (Array.isArray(result) ? result : [])
  } catch (e) {
    console.error('获取联系人列表失败:', e)
    contactList.value = []
    ElMessage.error('获取联系人列表失败')
  } finally {
    loading.value = false
  }
}

// 打开新增弹窗
function openCreateDialog() {
  editingId.value = null
  form.value = emptyForm()
  dialogVisible.value = true
}

// 打开编辑弹窗
function openEditDialog(row) {
  editingId.value = row.id
  form.value = {
    name: row.name ?? '',
    title: row.title ?? '',
    department: row.department ?? '',
    gender: Number(row.gender ?? 0),
    phone: row.phone ?? '',
    mobile: row.mobile ?? '',
    email: row.email ?? '',
    wechat: row.wechat ?? '',
    whatsapp: row.whatsapp ?? '',
    linkedin: row.linkedin ?? '',
    language: row.language ?? '',
    is_primary: Number(row.is_primary ?? 0),
    birthday: row.birthday ?? '',
    notes: row.notes ?? '',
  }
  dialogVisible.value = true
}

// 空字符串转 null，避免写入脏数据
function toPayload() {
  const payload = {}
  Object.entries(form.value).forEach(([key, value]) => {
    payload[key] = value === '' ? null : value
  })
  return {
    customer_id: Number(props.customerId),
    ...payload,
  }
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = toPayload()
    const res = editingId.value
      ? await updateCrmCustomerContactAPI(Number(editingId.value), payload)
      : await createCrmCustomerContactAPI(payload)

    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '保存失败')
      return
    }

    ElMessage.success(editingId.value ? '更新成功' : '新增成功')
    dialogVisible.value = false
    loadContacts()
    emit('refresh')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    submitting.value = false
  }
}

// 删除联系人
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除联系人「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    const res = await deleteCrmCustomerContactAPI(Number(row.id))
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '删除失败')
      return
    }
    ElMessage.success('删除成功')
    loadContacts()
    emit('refresh')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
}

onMounted(loadContacts)

watch(
  () => props.customerId,
  () => loadContacts(),
)
</script>

<template>
  <div class="contacts-panel">
    <div class="contacts-header">
      <span class="contacts-title">联系人</span>
      <el-tooltip content="新增联系人" placement="top">
        <el-button
          type="primary"
          :icon="Plus"
          circle
          aria-label="新增联系人"
          @click="openCreateDialog"
        />
      </el-tooltip>
    </div>

    <el-table
      v-loading="loading"
      :data="contactList"
      border
      stripe
      size="small"
      empty-text="暂无联系人"
      max-height="360"
    >
      <el-table-column label="姓名" min-width="120" fixed="left">
        <template #default="{ row }">
          <span class="cell-name">{{ row.name }}</span>
          <el-tag v-if="Number(row.is_primary) === 1" size="small" type="warning">主</el-tag>
        </template>
      </el-table-column>

      <!-- <el-table-column label="性别" width="70" align="center">
        <template #default="{ row }">{{ genderLabel(row.gender) }}</template>
      </el-table-column> -->

      <el-table-column label="职位" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'title') }}</template>
      </el-table-column>

      <el-table-column label="部门" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'department') }}</template>
      </el-table-column>

      <!-- <el-table-column label="联系电话" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'phone') }}</template>
      </el-table-column> -->

      <el-table-column label="手机" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'mobile') }}</template>
      </el-table-column>

      <el-table-column label="邮箱" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'email') }}</template>
      </el-table-column>

      <!-- <el-table-column label="微信" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'wechat') }}</template>
      </el-table-column>

      <el-table-column label="WhatsApp" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'whatsapp') }}</template>
      </el-table-column>

      <el-table-column label="LinkedIn" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'linkedin') }}</template>
      </el-table-column>

      <el-table-column label="沟通语言" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'language') }}</template>
      </el-table-column>

      <el-table-column label="备注" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'notes') }}</template>
      </el-table-column> -->

      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑联系人' : '新增联系人'"
      width="720px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" clearable placeholder="请输入姓名" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="职位">
              <el-input v-model="form.title" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门">
              <el-input v-model="form.department" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别">
              <el-select v-model="form.gender" clearable placeholder="请选择">
                <el-option
                  v-for="opt in GENDER_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生日">
              <el-date-picker
                v-model="form.birthday"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选填"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="沟通语言">
              <el-select
                v-model="form.language"
                clearable
                filterable
                placeholder="选填"
                style="width: 100%"
              >
                <el-option v-for="item in LANGUAGE_OPTIONS" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">联系方式</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.phone" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机">
              <el-input v-model="form.mobile" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.email" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="微信">
              <el-input v-model="form.wechat" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="WhatsApp">
              <el-input v-model="form.whatsapp" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="LinkedIn">
              <el-input v-model="form.linkedin" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">其他</div>
        <el-form-item label="主联系人">
          <el-switch v-model="form.is_primary" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.notes"
            type="textarea"
            :rows="3"
            placeholder="选填"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.contacts-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.contacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.contacts-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cell-name {
  font-weight: 500;
  margin-right: 4px;
}

.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
</style>