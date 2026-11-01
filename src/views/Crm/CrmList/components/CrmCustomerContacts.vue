<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCrmCustomerContactListAPI,
  removeCrmCustomerContactCustomerAPI,
} from '@/apis/crm'
import { GENDER_OPTIONS } from '@/views/Crm/CrmContact/components/shared'
import CrmUnassignedContactDialog from '@/views/Crm/CrmContact/components/CrmUnassignedContactDialog.vue'
import CrmEditContactDialog from '@/views/Crm/CrmContact/components/CrmEditContactDialog.vue'

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
  /** 当前客户名称（用于弹窗内只读展示所属客户） */
  customerName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['refresh'])

const loading = ref(false)
const contactList = ref([])

const createDialogRef = ref(null)
const editDialogRef = ref(null)

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
      pageSize: 100,
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

// 打开「添加联系人」弹窗：先展示未关联客户的联系人列表
function openCreateDialog() {
  createDialogRef.value?.open()
}

// 打开编辑弹窗
function openEditDialog(row) {
  editDialogRef.value?.open(row)
}

// 移除联系人与所属客户的关联（联系人本身保留，仅解绑 customer_id）
async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(
      `确定要将联系人「${row.name}」从当前客户移除吗？移除后该联系人不再归属本客户，但联系人本身会保留。`,
      '移除确认',
      {
        confirmButtonText: '确定移除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  try {
    const res = await removeCrmCustomerContactCustomerAPI(Number(row.id))
    // 后端成功时返回 { result: { id } }；失败时返回 404/400（会被 http 层拦截抛错）
    if (res?.result?.id == null) {
      ElMessage.error(res?.message || res?.msg || '移除失败')
      return
    }
    ElMessage.success('已移除该联系人的客户归属')
    loadContacts()
    emit('refresh')
  } catch (e) {
    console.error(e)
    ElMessage.error('移除失败')
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
          <el-button link type="warning" size="small" @click="handleRemove(row)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加联系人弹窗：先展示未关联客户的联系人列表，其中可再点「新增联系人」 -->
    <CrmUnassignedContactDialog
      ref="createDialogRef"
      :fixed-customer-id="customerId"
      :fixed-customer-name="customerName"
      :namespace-id="namespaceId"
      @success="loadContacts"
    />
    <CrmEditContactDialog
      ref="editDialogRef"
      :fixed-customer-id="customerId"
      :fixed-customer-name="customerName"
      :namespace-id="namespaceId"
      @success="loadContacts"
    />
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
</style>
