<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  getFinanceReceivablesListAPI,
  updateFinanceReceivableAPI,
} from '@/apis/financeReceivables'
import { useMenu } from '@/stores/menuStore'

defineOptions({ name: 'ProjectReceivableLinkDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  projectId: { type: [Number, null], default: null },
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

/** 未关联任何项目（project_id 为空） */
function isUnlinkedRecord(row) {
  const rowPid = row?.project_id
  return rowPid == null || rowPid === ''
}

/** 排除账务手续类（is_accounting_procedures=1） */
function isNonAccountingProceduresRecord(row) {
  const flag = row?.is_accounting_procedures
  return flag == null || flag === '' || Number(flag) === 0
}

const candidateList = computed(() =>
  rawList.value.filter((row) => isUnlinkedRecord(row) && isNonAccountingProceduresRecord(row)),
)

async function fetchCandidates() {
  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    rawList.value = []
    return
  }
  loading.value = true
  try {
    const filters = { namespace_id: Number(ns), is_accounting_procedures: 0 }
    const kw = String(keyword.value ?? '').trim()
    if (kw) filters.keyword = kw
    const res = await getFinanceReceivablesListAPI(1, 500, filters)
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取应收账款列表失败')
      rawList.value = []
      return
    }
    rawList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('获取可关联应收账款失败:', e)
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
  if (pid == null) {
    ElMessage.warning('缺少项目信息')
    return
  }
  if (!selectedRows.value.length) {
    ElMessage.warning('请选择要关联的应收账款')
    return
  }

  linking.value = true
  try {
    let okCount = 0
    for (const row of selectedRows.value) {
      if (!row?.id) continue
      const res = await updateFinanceReceivableAPI({
        id: Number(row.id),
        project_id: Number(pid),
      })
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || `关联失败（ID: ${row.id}）`)
        return
      }
      okCount += 1
    }
    ElMessage.success(`已关联 ${okCount} 条应收账款`)
    emit('update:modelValue', false)
    emit('success')
  } catch (e) {
    console.error('关联应收账款失败:', e)
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
    class="receivables-link-dialog"
    title="关联已有应收账款"
    width="860px"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetState"
  >
    <div class="link-dialog-toolbar">
      <el-input
        v-model="keyword"
        placeholder="客户 / 合同 / 货款名称"
        clearable
        class="link-dialog-search"
        :prefix-icon="Search"
        @keyup.enter="fetchCandidates"
      />
      <el-button type="primary" :loading="loading" @click="fetchCandidates">查询</el-button>
    </div>
    <p class="link-dialog-hint">仅展示未关联任何项目、且非账务手续类的应收账款，可多选后确认关联。</p>
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="candidateList"
      border
      stripe
      max-height="400"
      empty-text="暂无可关联的应收账款"
      row-key="id"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" :reserve-selection="false" />
      <el-table-column prop="customer_name" label="客户" min-width="110" show-overflow-tooltip />
      <el-table-column prop="contract_no" label="合同编号" min-width="110" show-overflow-tooltip />
      <el-table-column prop="product_name" label="货款名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="amount" label="金额" width="110" align="right">
        <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="收款状态" width="96" />
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

<style lang="scss">
.receivables-link-dialog.el-dialog {
  --el-color-primary: #409eff;
}
</style>
