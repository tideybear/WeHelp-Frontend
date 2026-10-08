<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  getPrivateAccountTransactionsListAPI,
  updatePrivateAccountTransactionAPI,
} from '@/apis/fin'
import { useMenu } from '@/stores/menuStore'

defineOptions({ name: 'ProjectPrivateAccountLinkDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  projectId: { type: [Number, null], default: null },
  /** 收入 | 支出，与应收/应付模块对应 */
  direction: {
    type: String,
    required: true,
    validator: (v) => v === '收入' || v === '支出',
  },
})

const emit = defineEmits(['update:modelValue', 'success'])

const menuStore = useMenu()
const { currentNamespaceId } = storeToRefs(menuStore)

const keyword = ref('')
const loading = ref(false)
const linking = ref(false)
const rawList = ref([])
const selectedRows = ref([])
const tableRef = ref()

function formatMoney(val) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isUnlinkedRecord(row) {
  const rowPid = row?.project_id
  return rowPid == null || rowPid === ''
}

const candidateList = computed(() => rawList.value.filter(isUnlinkedRecord))

const directionLabel = computed(() => (props.direction === '收入' ? '收入' : '支出'))

async function fetchCandidates() {
  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    rawList.value = []
    return
  }
  loading.value = true
  try {
    const filters = {
      direction: props.direction,
      project_id_empty: '1',
    }
    const kw = String(keyword.value ?? '').trim()
    if (kw) filters.business_desc = kw
    const res = await getPrivateAccountTransactionsListAPI(ns, 1, 500, filters)
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取私账列表失败')
      rawList.value = []
      return
    }
    rawList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('获取可关联私账失败:', e)
    rawList.value = []
  } finally {
    loading.value = false
  }
}

function resetState() {
  keyword.value = ''
  rawList.value = []
  selectedRows.value = []
  tableRef.value?.clearSelection?.()
}

function onSelectionChange(rows) {
  selectedRows.value = Array.isArray(rows) ? rows : []
}

async function submitLink() {
  const pid = props.projectId
  const ns = currentNamespaceId.value
  if (pid == null) {
    ElMessage.warning('缺少项目信息')
    return
  }
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }
  if (!selectedRows.value.length) {
    ElMessage.warning('请选择要关联的私账记录')
    return
  }

  linking.value = true
  try {
    let okCount = 0
    for (const row of selectedRows.value) {
      if (!row?.id) continue
      const res = await updatePrivateAccountTransactionAPI({
        namespace_id: ns,
        id: Number(row.id),
        data: { project_id: Number(pid) },
      })
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || `关联失败（ID: ${row.id}）`)
        return
      }
      okCount += 1
    }
    ElMessage.success(`已关联 ${okCount} 条私账记录`)
    emit('update:modelValue', false)
    emit('success')
  } catch (e) {
    console.error('关联私账失败:', e)
    ElMessage.error('关联失败')
  } finally {
    linking.value = false
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      resetState()
      return
    }
    const ns = currentNamespaceId.value
    if (ns == null || ns === '') {
      ElMessage.warning('请先选择空间')
      emit('update:modelValue', false)
      return
    }
    if (props.projectId == null) {
      ElMessage.warning('缺少项目信息，无法关联')
      emit('update:modelValue', false)
      return
    }
    fetchCandidates()
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="private-account-link-dialog"
    :title="`关联已有私账（${directionLabel}）`"
    width="860px"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetState"
  >
    <div class="link-dialog-toolbar">
      <el-input
        v-model="keyword"
        placeholder="业务事由关键词"
        clearable
        class="link-dialog-search"
        :prefix-icon="Search"
        @keyup.enter="fetchCandidates"
      />
      <el-button type="primary" :loading="loading" @click="fetchCandidates">查询</el-button>
    </div>
    <p class="link-dialog-hint">
      仅展示未关联项目、收支为「{{ directionLabel }}」的私账记录，可多选后确认关联。
    </p>
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="candidateList"
      border
      stripe
      max-height="400"
      empty-text="暂无可关联的私账记录"
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" :reserve-selection="false" />
      <el-table-column prop="flow_no" label="流水号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="business_date" label="业务日期" width="110" show-overflow-tooltip />
      <el-table-column prop="counterparty_name" label="对方名称" min-width="110" show-overflow-tooltip />
      <el-table-column prop="amount" label="金额" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="fund_status" label="资金状态" width="96" />
      <el-table-column prop="approval_status" label="审批状态" width="96" />
      <el-table-column prop="business_desc" label="业务事由" min-width="160" show-overflow-tooltip />
    </el-table>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="linking" :disabled="!selectedRows.length" @click="submitLink">
        确认关联{{ selectedRows.length ? `（${selectedRows.length}）` : '' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.link-dialog-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.link-dialog-search {
  flex: 1;
  min-width: 200px;
}

.link-dialog-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
