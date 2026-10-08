<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getPrivateAccountTransactionsListAPI, updatePrivateAccountTransactionAPI } from '@/apis/fin'
import CopyableCell from '@/components/CopyableCell.vue'
import {
  PRIVATE_ACCOUNT_LIST_COLUMNS,
  pushPrivateAccountDetailRoute,
} from '@/views/Finance/PrivateAccountTransactions/privateAccountTransactionsDefault/List/recordLoader'
import { fetchBankStatementRow } from '../List/recordLoader'
import { formatDateTime } from '@/utils/formatDate'
import { useMenu } from '@/stores/menuStore'

const route = useRoute()
const router = useRouter()
const menuStore = useMenu()

const DATE_DISPLAY_PROPS = new Set(['transaction_time', 'created_at'])

const defaultColumns = [
  { prop: 'flow_no', label: '流水号', width: 168, fixed: false, showOverflowTooltip: true },
  { prop: 'voucher_no', label: '凭证号', width: 150, fixed: false, showOverflowTooltip: false },
  { prop: 'our_account_no', label: '本方账号', width: 150, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_account_no', label: '对方账号', width: 150, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_bank_no', label: '对方行号', width: 120, fixed: false, showOverflowTooltip: true },
  { prop: 'counterparty_name', label: '对方单位名称', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'transaction_time', label: '交易时间', width: 300, fixed: false, showOverflowTooltip: true },
  { prop: 'direction', label: '借/贷方向', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'debit_amount', label: '借方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'credit_amount', label: '贷方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
  { prop: 'balance', label: '余额(元)', width: 180, fixed: false, showOverflowTooltip: false },
  { prop: 'abstract_text', label: '摘要', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'purpose', label: '用途', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'personalized_info', label: '个性化信息', width: 200, fixed: false, showOverflowTooltip: true },
  { prop: 'created_at', label: '记录创建时间', width: 200, fixed: false, showOverflowTooltip: true },
]

const RELATED_PAT_HIDDEN_PROPS = new Set([
  'fund_status',
  'approval_status',
  'operator',
  'approver',
  'reconciliation_status',
  'created_at',
])

const APPROVAL_PASSED = '已通过'
const RECONCILIATION_PENDING = '未对账'
const RECONCILIATION_RECONCILED = '已对账'
const LINKABLE_FUND_STATUSES = ['已收', '已付', '已核销']

const relatedPatColumns = PRIVATE_ACCOUNT_LIST_COLUMNS.filter(
  (col) => !RELATED_PAT_HIDDEN_PROPS.has(col.prop),
)

const columns = computed(() => {
  const raw = route.query.columns
  if (!raw || typeof raw !== 'string') return defaultColumns
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultColumns
    return parsed
  } catch (error) {
    console.error('解析银行流水列配置失败:', error)
    return defaultColumns
  }
})

const parsedRowData = computed(() => {
  const raw = route.query.rowData
  if (!raw || typeof raw !== 'string') return {}

  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch (error) {
    console.error('解析银行流水详情参数失败:', error)
    return {}
  }
})

const currentFlowNo = computed(() => {
  const fromQuery = String(parsedRowData.value?.flow_no ?? '').trim()
  if (fromQuery) return fromQuery
  return String(resolvedBankRow.value?.flow_no ?? '').trim()
})

const routeRecordId = computed(() => {
  const id = route.params.id ?? route.query.id
  return id != null && String(id).trim() !== '' ? String(id).trim() : ''
})

const resolvedBankRow = ref(null)

const namespaceId = computed(() => {
  const q = route.query.namespace_id
  if (q != null && q !== '') return q
  return parsedRowData.value?.namespace_id ?? menuStore.currentNamespaceId
})

const tableRows = computed(() => {
  const dataMap = parsedRowData.value || {}
  return columns.value.map((col) => {
    const raw = dataMap[col.prop]
    if (raw === undefined || raw === null || raw === '') {
      return { prop: col.prop, header: col.label, value: '—' }
    }
    if (DATE_DISPLAY_PROPS.has(col.prop)) {
      return {
        prop: col.prop,
        header: col.label,
        value: formatDateTime(raw) || String(raw),
      }
    }
    return { prop: col.prop, header: col.label, value: raw }
  })
})

const relatedPatList = ref([])
const relatedPatLoading = ref(false)
const relatedPatNavigating = ref(false)
const relatedPatUnlinkingId = ref(null)
const linkablePatPopoverVisible = ref(false)
const linkablePatList = ref([])
const linkablePatLoading = ref(false)
const linkablePatLinkingId = ref(null)
const linkablePatSearchKeyword = ref('')
const confirmReconciling = ref(false)

function isPatReconciled(row) {
  return String(row?.reconciliation_status ?? '').trim() === RECONCILIATION_RECONCILED
}

const isRelatedPatReconciled = computed(() => {
  const list = relatedPatList.value
  if (!list.length) return false
  return list.every(isPatReconciled)
})

const canAddRelatedPatLink = computed(() => !isRelatedPatReconciled.value)

const canManageRelatedPatLink = computed(() => {
  const list = relatedPatList.value
  if (!list.length) return false
  return !list.every(isPatReconciled)
})

function directionTagType(dir) {
  const s = String(dir ?? '').trim()
  if (s === '收入') return 'success'
  if (s === '支出') return 'danger'
  return 'info'
}

async function resolveBankRowIfNeeded() {
  if (String(parsedRowData.value?.flow_no ?? '').trim()) {
    resolvedBankRow.value = null
    return
  }
  const ns = namespaceId.value
  const id = routeRecordId.value
  if (ns == null || ns === '' || !id) {
    resolvedBankRow.value = null
    return
  }
  try {
    resolvedBankRow.value = await fetchBankStatementRow(ns, id)
  } catch (e) {
    console.error('补全银行流水信息失败:', e)
    resolvedBankRow.value = null
  }
}

async function loadRelatedPrivateAccounts(options = {}) {
  const { silent = false } = options
  const flowNo = currentFlowNo.value
  const ns = namespaceId.value
  if (!flowNo || ns == null || ns === '') {
    relatedPatList.value = []
    return
  }

  relatedPatLoading.value = true
  try {
    const res = await getPrivateAccountTransactionsListAPI(ns, 1, 200, {
      related_flow_no: flowNo,
    })
    if (res?.code !== 200) {
      if (!silent) ElMessage.error(res?.msg || '加载关联私账往来失败')
      relatedPatList.value = []
      return
    }
    relatedPatList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载关联私账往来失败:', e)
    if (!silent) ElMessage.error(e?.response?.data?.msg || '加载关联私账往来失败')
    relatedPatList.value = []
  } finally {
    relatedPatLoading.value = false
  }
}

async function loadLinkablePrivateAccounts(options = {}) {
  const { silent = false } = options
  const ns = namespaceId.value
  if (ns == null || ns === '') {
    linkablePatList.value = []
    return
  }

  linkablePatLoading.value = true
  try {
    const res = await getPrivateAccountTransactionsListAPI(ns, 1, 200, {
      approval_status: APPROVAL_PASSED,
      fund_status_in: LINKABLE_FUND_STATUSES.join(','),
      reconciliation_status: RECONCILIATION_PENDING,
      related_flow_no_empty: '1',
    })
    if (res?.code !== 200) {
      if (!silent) ElMessage.error(res?.msg || '加载可关联私账往来失败')
      linkablePatList.value = []
      return
    }
    linkablePatList.value = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载可关联私账往来失败:', e)
    if (!silent) ElMessage.error(e?.response?.data?.msg || '加载可关联私账往来失败')
    linkablePatList.value = []
  } finally {
    linkablePatLoading.value = false
  }
}

async function onLinkablePatPopoverShow() {
  linkablePatSearchKeyword.value = ''
  await loadLinkablePrivateAccounts()
}

function getLinkablePatRowSearchText(item) {
  if (!item) return ''
  const parts = relatedPatColumns.map((col) => {
    const prop = col.prop
    if (prop === 'direction') return String(item.direction ?? '')
    if (prop === 'business_date') return formatDateTime(item.business_date) || String(item.business_date ?? '')
    return String(item[prop] ?? '')
  })
  return parts.join(' ').toLowerCase()
}

const filteredLinkablePatList = computed(() => {
  const kw = linkablePatSearchKeyword.value.trim().toLowerCase()
  const list = linkablePatList.value
  if (!kw) return list
  return list.filter((row) => getLinkablePatRowSearchText(row).includes(kw))
})

async function linkPrivateAccountToBankFlow(row) {
  const flowNo = currentFlowNo.value
  const ns = namespaceId.value
  const rowId = row?.id
  if (!flowNo) {
    ElMessage.warning('当前银行流水号为空，无法关联')
    return
  }
  if (ns == null || ns === '' || rowId == null || rowId === '') return
  if (linkablePatLinkingId.value != null) return

  linkablePatLinkingId.value = rowId
  linkablePatPopoverVisible.value = true
  try {
    const res = await updatePrivateAccountTransactionAPI({
      namespace_id: ns,
      id: rowId,
      data: { related_flow_no: flowNo },
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '添加关联失败')
      return
    }
    ElMessage.success(res?.msg || '已添加关联')
    await Promise.all([
      loadRelatedPrivateAccounts({ silent: true }),
      loadLinkablePrivateAccounts({ silent: true }),
    ])
    linkablePatPopoverVisible.value = true
  } catch (e) {
    console.error('添加私账关联失败:', e)
    ElMessage.error(e?.response?.data?.msg || '添加关联失败')
  } finally {
    linkablePatLinkingId.value = null
  }
}

watch(
  [routeRecordId, namespaceId, () => parsedRowData.value?.flow_no],
  () => {
    resolveBankRowIfNeeded()
  },
  { immediate: true },
)

watch(
  [currentFlowNo, namespaceId],
  ([flowNo, ns]) => {
    if (flowNo && ns != null && ns !== '') {
      loadRelatedPrivateAccounts({ silent: true })
    } else {
      relatedPatList.value = []
    }
  },
  { immediate: true },
)

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  router.push('/finance/bank/statements')
}

async function openRelatedPatDetail(row) {
  const ns = namespaceId.value
  if (ns == null || ns === '' || relatedPatNavigating.value) return
  const rowId = row?.id
  if (rowId == null || rowId === '') {
    ElMessage.warning('缺少私账记录 id')
    return
  }
  relatedPatNavigating.value = true
  try {
    await pushPrivateAccountDetailRoute(router, ns, row, PRIVATE_ACCOUNT_LIST_COLUMNS)
  } catch (e) {
    console.error('打开私账详情失败:', e)
    ElMessage.error(e?.message || e?.response?.data?.msg || '打开私账详情失败')
  } finally {
    relatedPatNavigating.value = false
  }
}

async function unlinkRelatedPat(row) {
  const ns = namespaceId.value
  const rowId = row?.id
  if (ns == null || ns === '' || rowId == null || rowId === '') return
  if (relatedPatUnlinkingId.value != null) return

  try {
    await ElMessageBox.confirm(
      '确认是否删除该关联',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  relatedPatUnlinkingId.value = rowId
  try {
    const res = await updatePrivateAccountTransactionAPI({
      namespace_id: ns,
      id: rowId,
      data: { related_flow_no: null },
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除关联失败')
      return
    }
    ElMessage.success(res?.msg || '已删除关联')
    await loadRelatedPrivateAccounts({ silent: true })
  } catch (e) {
    console.error('删除关联失败:', e)
    ElMessage.error(e?.response?.data?.msg || '删除关联失败')
  } finally {
    relatedPatUnlinkingId.value = null
  }
}

async function confirmRelatedReconciliation() {
  const ns = namespaceId.value
  const list = relatedPatList.value
  if (ns == null || ns === '' || !list.length || confirmReconciling.value) return
  if (!canManageRelatedPatLink.value) return

  try {
    await ElMessageBox.confirm(
      `确认对账？当前操作不可逆！`,
      '确认对账',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  confirmReconciling.value = true
  try {
    const results = await Promise.all(
      list.map((row) =>
        updatePrivateAccountTransactionAPI({
          namespace_id: ns,
          id: row.id,
          data: { reconciliation_status: RECONCILIATION_RECONCILED },
        }),
      ),
    )
    const failed = results.filter((res) => res?.code !== 200)
    if (failed.length > 0) {
      ElMessage.error(failed[0]?.msg || `有 ${failed.length} 条记录对账失败`)
      await loadRelatedPrivateAccounts({ silent: true })
      return
    }
    ElMessage.success('已确认对账')
    await loadRelatedPrivateAccounts({ silent: true })
  } catch (e) {
    console.error('确认对账失败:', e)
    ElMessage.error(e?.response?.data?.msg || '确认对账失败')
  } finally {
    confirmReconciling.value = false
  }
}
</script>

<template>
  <div class="detail-page">
    <div class="detail-header-row">
      <div class="detail-header">银行流水详情</div>
      <el-button type="primary" plain size="small" @click="goBack">返回上一页</el-button>
    </div>
    <div class="detail-main">
      <div class="detail-table-container">
        <div v-if="tableRows.length > 0" class="detail-table">
          <el-table
            class="detail-table__grid"
            :data="tableRows"
            border
            height="100%"
            style="width: 100%"
          >
            <el-table-column prop="header" label="标题" width="260" />
            <el-table-column prop="value" label="数据内容">
              <template #default="{ row }">
                <CopyableCell :value="row.value" />
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else class="empty-state">未接收到详情数据</div>
      </div>

      <div class="related-pat-panel">
        <div class="related-pat-title-row">
          <div class="related-pat-title-group">
            <div class="related-pat-title">关联私账往来申请</div>
            <el-tag
              v-if="isRelatedPatReconciled"
              size="small"
              type="success"
              effect="plain"
              class="related-pat-reconciled-tag"
            >
              已完成对账
            </el-tag>
          </div>
          <el-popover
            v-if="canAddRelatedPatLink"
            v-model:visible="linkablePatPopoverVisible"
            placement="top-start"
            :width="960"
            trigger="click"
            popper-class="bank-linkable-pat-popover"
            @show="onLinkablePatPopoverShow"
          >
            <template #reference>
              <el-button
                link
                type="primary"
                class="related-pat-add-btn"
                title="新增关联私账往来"
                @click.stop
              >
                <el-icon><Plus /></el-icon>
              </el-button>
            </template>
            <div class="linkable-pat-popover-body" @click.stop>
              <div class="linkable-pat-popover-title">可关联私账往来</div>
              <el-input
                v-model="linkablePatSearchKeyword"
                class="linkable-pat-search"
                size="small"
                clearable
                placeholder="搜索所有展示字段（模糊匹配）"
              />
              <el-table
                :data="filteredLinkablePatList"
                size="small"
                border
                max-height="320"
                v-loading="linkablePatLoading"
                :empty-text="
                  linkablePatList.length ? '无匹配的可关联私账往来' : '暂无可关联私账往来'
                "
              >
                <el-table-column
                  v-for="col in relatedPatColumns"
                  :key="`linkable-${col.prop}`"
                  :prop="col.prop"
                  :label="col.label"
                  :width="col.width"
                  :min-width="col.minWidth"
                  :show-overflow-tooltip="col.showOverflowTooltip || false"
                >
                  <template #default="{ row: item }">
                    <el-tag
                      v-if="col.prop === 'direction'"
                      size="small"
                      :type="directionTagType(item?.direction)"
                      effect="plain"
                    >
                      {{ item?.direction ?? '—' }}
                    </el-tag>
                    <span v-else-if="col.prop === 'business_date'">
                      {{ formatDateTime(item?.business_date) || '—' }}
                    </span>
                    <span v-else>{{ item?.[col.prop] ?? '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" fixed="right" width="128" align="center">
                  <template #default="{ row: item }">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="openRelatedPatDetail(item)"
                    >
                      查看
                    </el-button>
                    <el-button
                      link
                      type="success"
                      size="small"
                      :loading="linkablePatLinkingId === item?.id"
                      :disabled="linkablePatLinkingId != null && linkablePatLinkingId !== item?.id"
                      @click.stop="linkPrivateAccountToBankFlow(item)"
                    >
                      添加
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-popover>
        </div>
        <el-table
          class="related-pat-table"
          :data="relatedPatList"
          border
          size="small"
          v-loading="relatedPatLoading"
          element-loading-text="加载中…"
          empty-text="暂无关联私账往来"
        >
          <el-table-column
            v-for="col in relatedPatColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="{ row }">
              <template v-if="col.prop === 'direction'">
                <el-tag size="small" :type="directionTagType(row?.direction)" effect="plain">
                  {{ row?.direction ?? '—' }}
                </el-tag>
              </template>
              <CopyableCell
                v-else-if="col.prop === 'business_date'"
                :value="formatDateTime(row?.[col.prop]) || '—'"
              />
              <CopyableCell v-else :value="row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                :disabled="relatedPatNavigating || relatedPatUnlinkingId != null"
                @click.stop="openRelatedPatDetail(row)"
              >
                查看
              </el-button>
              <el-button
                v-if="canManageRelatedPatLink"
                link
                type="danger"
                size="small"
                :loading="relatedPatUnlinkingId === row?.id"
                :disabled="
                  (relatedPatUnlinkingId != null && relatedPatUnlinkingId !== row?.id) ||
                  relatedPatNavigating
                "
                @click.stop="unlinkRelatedPat(row)"
              >
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="relatedPatList.length > 0 && canManageRelatedPatLink" class="related-pat-actions">
          <el-button
            type="primary"
            size="small"
            :loading="confirmReconciling"
            :disabled="relatedPatLoading || confirmReconciling"
            @click="confirmRelatedReconciliation"
          >
            确认对账
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  font-size: 18px;
  font-weight: 600;
}

.detail-header-row {
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-main {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.detail-table-container {
  flex: 1 1 0;
  min-height: 180px;
  box-sizing: border-box;
  padding: 0 16px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-table {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-table__grid {
  width: 100%;
  height: 100%;
}

.related-pat-panel {
  flex: 0 0 auto;
  max-height: 42%;
  min-height: 180px;
  box-sizing: border-box;
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.related-pat-title-row {
  flex: 0 0 auto;
  padding-top: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.related-pat-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.related-pat-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.related-pat-reconciled-tag {
  font-size: 12px;
  height: 20px;
  line-height: 18px;
  padding: 0 6px;
}

.related-pat-add-btn {
  padding: 0;
  height: 24px;
  min-height: 24px;
}

.related-pat-actions {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  padding-top: 12px;
}

.linkable-pat-popover-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.linkable-pat-search {
  margin-bottom: 8px;
}

.related-pat-table {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
</style>
