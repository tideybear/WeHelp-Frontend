<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { updateCrmCustomerContactAPI } from '@/apis/crm'
import { useNamespace } from '@/stores/namespaceStore'
import { loadUnassignedContacts } from './shared'
import CrmCreateContactDialog from './CrmCreateContactDialog.vue'

defineOptions({ name: 'CrmUnassignedContactDialog' })

const props = defineProps({
  /**
   * 固定所属客户 ID。
   * 传入后，用户可把未关联的联系人关联到该客户。
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
const loading = ref(false)
const linkingId = ref(null)
const contactList = ref([])
const keyword = ref('')

// 「新增联系人」弹窗
const createDialogRef = ref(null)

// 优先用外部传入的 namespaceId，其次取当前空间
function currentNamespaceId() {
  if (props.namespaceId != null && props.namespaceId !== '') return props.namespaceId
  return namespaceStore.currentNamespaceId
}

// 关键词过滤：姓名 / 手机 / 邮箱 / 职位 / 部门
const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return contactList.value
  return contactList.value.filter((row) =>
    [row?.name, row?.mobile, row?.email, row?.title, row?.department]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ')
      .includes(kw),
  )
})

// 打开弹窗：拉取未关联客户的联系人
async function open() {
  keyword.value = ''
  contactList.value = []
  dialogVisible.value = true
  await loadList()
}

async function loadList() {
  loading.value = true
  try {
    contactList.value = await loadUnassignedContacts(currentNamespaceId())
  } catch (e) {
    console.error('获取未关联联系人失败:', e)
    contactList.value = []
    ElMessage.error('获取未关联联系人失败')
  } finally {
    loading.value = false
  }
}

// 打开「新增联系人」弹窗
function handleCreate() {
  createDialogRef.value?.open()
}

// 把未关联的联系人关联到当前客户
async function handleLink(row) {
  if (props.fixedCustomerId == null || props.fixedCustomerId === '') {
    ElMessage.warning('未指定所属客户，无法关联')
    return
  }

  linkingId.value = row.id
  try {
    const res = await updateCrmCustomerContactAPI(Number(row.id), {
      customer_id: Number(props.fixedCustomerId),
    })
    if (res?.result?.id == null) {
      ElMessage.error(res?.message || res?.msg || '关联失败')
      return
    }
    ElMessage.success('已关联到当前客户')
    loadList()
    emit('success')
  } catch (e) {
    console.error(e)
    ElMessage.error('关联失败')
  } finally {
    linkingId.value = null
  }
}

// 新增联系人保存成功：刷新列表
function handleCreateSuccess() {
  loadList()
  emit('success')
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="添加联系人"
    width="860px"
    destroy-on-close
  >
    <div class="picker-header">
      <div class="picker-actions">
        <el-input
          v-model="keyword"
          placeholder="搜索姓名/手机/邮箱/职位"
          clearable
          :prefix-icon="Search"
          style="width: 220px"
        />
        <el-button type="primary" :icon="Plus" @click="handleCreate">新增联系人</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="filteredList"
      border
      stripe
      size="small"
      empty-text="暂无未关联的联系人"
      max-height="380"
    >
      <el-table-column label="姓名" min-width="120">
        <template #default="{ row }">
          <span class="cell-name">{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column label="职位" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.title || '—' }}</template>
      </el-table-column>

      <el-table-column label="部门" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row.department || '—' }}</template>
      </el-table-column>

      <el-table-column label="手机" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.mobile || '—' }}</template>
      </el-table-column>

      <el-table-column label="邮箱" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.email || '—' }}</template>
      </el-table-column>

      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            size="small"
            :loading="linkingId === row.id"
            @click="handleLink(row)"
          >
            关联
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>

    <!-- 「新增联系人」：复用 CrmContact 模块的同一套弹窗，所属客户固定为当前客户 -->
    <CrmCreateContactDialog
      ref="createDialogRef"
      :fixed-customer-id="fixedCustomerId"
      :fixed-customer-name="fixedCustomerName"
      :namespace-id="namespaceId"
      @success="handleCreateSuccess"
    />
  </el-dialog>
</template>

<style scoped lang="scss">
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.picker-tip {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.picker-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cell-name {
  font-weight: 500;
}
</style>
