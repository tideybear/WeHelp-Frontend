<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Link, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import {
  getPrivateAccountTransactionsListAPI,
  updatePrivateAccountTransactionAPI,
} from '@/apis/fin'
import CopyableCell from '@/components/CopyableCell.vue'
import { formatDateTime } from '@/utils/formatDate'
import { useMenu } from '@/stores/menuStore'
import {
  pushPrivateAccountDetailRoute,
  PRIVATE_ACCOUNT_LIST_COLUMNS,
} from '@/views/Finance/PrivateAccountTransactions/privateAccountTransactionsDefault/List/recordLoader'
import ProjectPrivateAccountLinkDialog from './ProjectPrivateAccountLinkDialog.vue'

defineOptions({ name: 'ProjectDetailPrivateAccountLedger' })

const props = defineProps({
  projectId: {
    type: [Number, null],
    default: null,
  },
  /** 收入：客户/应收侧；支出：供应商/应付侧 */
  direction: {
    type: String,
    required: true,
    validator: (v) => v === '收入' || v === '支出',
  },
  sectionTitle: {
    type: String,
    default: '',
  },
})

const router = useRouter()
const menuStore = useMenu()
const { currentNamespaceId } = storeToRefs(menuStore)

const loading = ref(false)
const dataList = ref([])
const total = ref(0)
const linkVisible = ref(false)
const unlinkingId = ref(null)

const displayTitle = computed(() => {
  if (props.sectionTitle) return props.sectionTitle
  return props.direction === '收入' ? '私账（收入）' : '私账（支出）'
})

const columns = [
  { prop: 'flow_no', label: '流水号', minWidth: 140, showOverflowTooltip: true },
  { prop: 'business_date', label: '业务日期', width: 110, showOverflowTooltip: false },
  { prop: 'counterparty_name', label: '对方名称', minWidth: 120, showOverflowTooltip: true },
  { prop: 'account_type', label: '账户类型', width: 96, showOverflowTooltip: false },
  { prop: 'direction', label: '收支', width: 80, showOverflowTooltip: false },
  { prop: 'amount', label: '金额(元)', width: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'fund_status', label: '资金状态', width: 96, showOverflowTooltip: false },
  { prop: 'approval_status', label: '审批状态', width: 96, showOverflowTooltip: false },
  { prop: 'business_desc', label: '业务事由', minWidth: 160, showOverflowTooltip: true },
]

function formatMoney(val) {
  const n = Number(String(val ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function directionTagType(dir) {
  const s = String(dir ?? '').trim()
  if (s === '收入') return 'success'
  if (s === '支出') return 'danger'
  return 'info'
}

function approvalTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已通过') return 'success'
  if (s === '已驳回') return 'danger'
  return 'warning'
}

function fundTagType(status) {
  const s = String(status ?? '').trim()
  if (s === '已收' || s === '已付' || s === '已核销') return 'success'
  if (s === '未收' || s === '未付' || s === '未核销') return 'warning'
  return 'info'
}

function openLink() {
  if (props.projectId == null) {
    ElMessage.warning('缺少项目信息，无法关联')
    return
  }
  linkVisible.value = true
}

async function fetchList() {
  const pid = props.projectId
  const ns = currentNamespaceId.value
  if (pid == null || ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await getPrivateAccountTransactionsListAPI(ns, 1, 100, {
      project_id: pid,
      direction: props.direction,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取私账列表失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
  } catch (e) {
    console.error('获取项目关联私账失败:', e)
    dataList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function goDetail(row) {
  if (!row?.id) return
  const ns = currentNamespaceId.value
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }
  try {
    await pushPrivateAccountDetailRoute(router, ns, row, PRIVATE_ACCOUNT_LIST_COLUMNS)
  } catch (e) {
    console.error('打开私账详情失败:', e)
    ElMessage.error(e?.message || '打开详情失败')
  }
}

async function unlinkRecord(row) {
  const ns = currentNamespaceId.value
  if (!row?.id || ns == null || ns === '') return
  if (unlinkingId.value != null) return

  try {
    await ElMessageBox.confirm(
      '确认从本项目移除该私账关联？私账记录本身不会被删除。',
      '移除关联',
      { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  unlinkingId.value = row.id
  try {
    const res = await updatePrivateAccountTransactionAPI({
      namespace_id: ns,
      id: Number(row.id),
      data: { project_id: null },
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '移除失败')
      return
    }
    ElMessage.success('已移除关联')
    await fetchList()
  } catch (e) {
    console.error('移除私账关联失败:', e)
    ElMessage.error('移除失败')
  } finally {
    unlinkingId.value = null
  }
}

function onTableRowClick(row, column) {
  if (column?.label === '操作') return
  goDetail(row)
}

watch(
  () => [props.projectId, props.direction],
  () => fetchList(),
)

onMounted(() => fetchList())
</script>

<template>
  <div class="project-detail-ledger project-detail-ledger--private">
    <header class="project-detail-ledger__head">
      <h3 class="project-detail-ledger__title">{{ displayTitle }}</h3>
      <div class="project-detail-ledger__actions">
        <span v-if="projectId != null" class="project-detail-ledger__meta">共 {{ total }} 条</span>
        <el-tooltip :content="`关联已有私账（${direction}）`" placement="top">
          <el-button
            type="primary"
            plain
            :icon="Link"
            circle
            :aria-label="`关联已有私账（${direction}）`"
            @click.stop="openLink"
          />
        </el-tooltip>
      </div>
    </header>
    <div class="project-detail-ledger__body">
      <div class="project-detail-ledger__table-wrap">
        <el-table
          v-loading="loading"
          class="project-detail-ledger__table"
          :data="dataList"
          border
          stripe
          max-height="360"
          :empty-text="`暂无与该项目的${direction}私账数据`"
          row-key="id"
          @row-click="onTableRowClick"
        >
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :align="col.align || 'left'"
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="scope">
              <template v-if="col.prop === 'direction'">
                <el-tag size="small" :type="directionTagType(scope.row?.direction)" effect="plain">
                  {{ scope.row?.direction ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'approval_status'">
                <el-tag size="small" :type="approvalTagType(scope.row?.approval_status)" effect="plain">
                  {{ scope.row?.approval_status ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'fund_status'">
                <el-tag size="small" :type="fundTagType(scope.row?.fund_status)" effect="plain">
                  {{ scope.row?.fund_status ?? '—' }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'business_date'">
                <CopyableCell :value="formatDateTime(scope.row?.business_date) || ''" />
              </template>
              <template v-else-if="col.prop === 'amount'">
                <CopyableCell :value="formatMoney(scope.row?.amount)" />
              </template>
              <CopyableCell
                v-else
                :value="scope.row?.[col.prop] != null && scope.row?.[col.prop] !== '' ? scope.row[col.prop] : ''"
              />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="148" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="goDetail(row)">
                进入详情
              </el-button>
              <el-tooltip content="移除关联" placement="top">
                <el-button
                  type="danger"
                  link
                  size="small"
                  :icon="Delete"
                  :loading="unlinkingId === row.id"
                  aria-label="移除关联"
                  @click.stop="unlinkRecord(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <ProjectPrivateAccountLinkDialog
      v-model="linkVisible"
      :project-id="projectId"
      :direction="direction"
      @success="fetchList"
    />
  </div>
</template>

<style scoped lang="scss">
.project-detail-ledger--private {
  margin-top: 12px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.project-detail-ledger {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  overflow: hidden;
}

.project-detail-ledger__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.project-detail-ledger__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.project-detail-ledger__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.project-detail-ledger__meta {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.project-detail-ledger__body {
  padding: 12px 16px 16px;
}

.project-detail-ledger__table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.project-detail-ledger__table {
  width: 100%;
  min-width: 1100px;

  :deep(.el-table__row) {
    cursor: pointer;
  }
}
</style>
