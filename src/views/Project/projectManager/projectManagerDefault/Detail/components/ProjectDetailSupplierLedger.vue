<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Link, Plus } from '@element-plus/icons-vue'
import { getFinancePayablesListAPI } from '@/apis/financePayables'
import CopyableCell from '@/components/CopyableCell.vue'
import { formatDateOnly } from '@/utils/formatDate'
import FinanceListExpandTrigger from '@/components/FinanceListExpandTrigger.vue'
import { useFinanceListExpand } from '@/composables/useFinanceListExpand'
import {
  financeListRowClassName,
  financeListRowHasDetails,
  financeListSpanMethod,
  formatFinanceListMoney,
  formatFinanceListQuantity,
  financeListRowExpandKey,
  formatFinanceListSubRowLabel,
  isFinanceListGroupRow,
  isFinanceListMainRow,
  isProjectDetailLedgerSummaryRow,
  resolveFinanceListRecord,
  shouldShowFinanceListCell,
} from '@/utils/financeListDisplay'
import ProjectPayableCreateDialog from './ProjectPayableCreateDialog.vue'
import ProjectPayableLinkDialog from './ProjectPayableLinkDialog.vue'
import ProjectDetailPrivateAccountLedger from './ProjectDetailPrivateAccountLedger.vue'

defineOptions({ name: 'ProjectDetailSupplierLedger' })

const props = defineProps({
  projectId: {
    type: [Number, null],
    default: null,
  },
})

const router = useRouter()
const loading = ref(false)
const dataList = ref([])
const total = ref(0)
const createVisible = ref(false)
const linkVisible = ref(false)

const listDisplayOptions = {
  paymentDateProp: 'payment_date',
  paidAmountProp: 'paid_amount',
  financeType: 'payable',
  projectDetailStackedMain: true,
  projectDetailGroupByCustomer: true,
  projectDetailNetContract: true,
}

/** 与财务应付列表表头、金额展示逻辑一致 */
const columns = [
  { prop: 'customer_name', label: '供应商', minWidth: 120, showOverflowTooltip: true },
  { prop: 'contract_no', label: '合同编号', minWidth: 120, showOverflowTooltip: true },
  { prop: 'contract_account', label: '合同金额', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'product_name', label: '货款名称', minWidth: 140, showOverflowTooltip: true },
  { prop: 'specification', label: '规格', minWidth: 100, showOverflowTooltip: true },
  { prop: 'unit', label: '单位', minWidth: 64, showOverflowTooltip: false },
  { prop: 'quantity', label: '数量', minWidth: 88, align: 'right', showOverflowTooltip: false },
  { prop: 'unit_price', label: '单价', minWidth: 100, align: 'right', showOverflowTooltip: false },
  { prop: 'amount', label: '金额', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'payment_date', label: '付款日期', minWidth: 110, showOverflowTooltip: false },
  { prop: 'paid_amount', label: '实付', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'status', label: '付款状态', minWidth: 96, showOverflowTooltip: false },
  { prop: 'invoice_status', label: '发票情况', minWidth: 96, showOverflowTooltip: false },
]

const MONEY_COLUMN_PROPS = new Set([
  'unit_price',
  'amount',
  'contract_account',
  'paid_amount',
])
const DATE_COLUMN_PROPS = new Set(['payment_date'])

const { displayList, toggleExpand, isExpanded } = useFinanceListExpand(dataList, listDisplayOptions)

function openCreate() {
  if (props.projectId == null) {
    ElMessage.warning('缺少项目信息，无法新增')
    return
  }
  createVisible.value = true
}

function openLink() {
  if (props.projectId == null) {
    ElMessage.warning('缺少项目信息，无法关联')
    return
  }
  linkVisible.value = true
}

function paymentStatusTagType(val) {
  const s = String(val ?? '').trim()
  if (s === '已付清') return 'success'
  if (s === '部分付款') return 'info'
  if (s === '逾期') return 'danger'
  if (s === '待付款') return 'warning'
  return 'info'
}

function invoiceStatusTagType(val) {
  const s = String(val ?? '').trim()
  if (s === '已开票') return 'success'
  if (s === '部分开票') return 'warning'
  if (s === '已作废') return 'danger'
  return 'info'
}

async function fetchList() {
  const pid = props.projectId
  if (pid == null) {
    dataList.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await getFinancePayablesListAPI(1, 100, { project_id: pid })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取供应商应付账款失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
  } catch (e) {
    console.error('获取供应商应付账款失败:', e)
    dataList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function viewRecord(row) {
  if (!row?.id) return
  router.push({
    name: 'FinancePayableDetail',
    params: { id: String(row.id) },
    query: { rowData: encodeURIComponent(JSON.stringify(row)) },
  })
}

function goDetail(displayRow) {
  const record = resolveFinanceListRecord(displayRow, dataList.value)
  if (record) viewRecord(record)
}

function onTableRowClick(row, column) {
  if (column?.label === '操作') return
  if (row._rowKind === 'main-meta') {
    const record = resolveFinanceListRecord(row, dataList.value)
    if (record) viewRecord(record)
    return
  }
  if (isFinanceListGroupRow(row) && financeListRowHasDetails(row)) {
    toggleExpand(row._groupId)
    return
  }
  if (isFinanceListMainRow(row) && financeListRowHasDetails(row)) {
    toggleExpand(row._recordId)
    return
  }
  const record = resolveFinanceListRecord(row, dataList.value)
  if (record) viewRecord(record)
}

watch(
  () => props.projectId,
  () => fetchList(),
)

onMounted(() => fetchList())
</script>

<template>
  <div class="project-detail-ledger">
    <header class="project-detail-ledger__head">
      <h3 class="project-detail-ledger__title">供应商（应付账款）</h3>
      <div class="project-detail-ledger__actions">
        <span v-if="projectId != null" class="project-detail-ledger__meta">共 {{ total }} 条</span>
        <el-tooltip content="关联已有应付账款" placement="top">
          <el-button
            type="primary"
            plain
            :icon="Link"
            circle
            aria-label="关联已有应付账款"
            @click.stop="openLink"
          />
        </el-tooltip>
        <el-tooltip content="新增应付账款" placement="top">
          <el-button
            type="primary"
            :icon="Plus"
            circle
            aria-label="新增应付账款"
            @click.stop="openCreate"
          />
        </el-tooltip>
      </div>
    </header>
    <div class="project-detail-ledger__body">
      <div class="project-detail-ledger__table-wrap">
        <el-table
          v-loading="loading"
          class="project-detail-ledger__table"
          :data="displayList"
          :row-class-name="financeListRowClassName"
          :span-method="financeListSpanMethod"
          border
          stripe
          max-height="360"
          empty-text="暂无与该项目的供应商应付数据"
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
              <template v-if="!shouldShowFinanceListCell(scope.row, col.prop, listDisplayOptions)">
                <span
                  v-if="col.prop === 'customer_name' && scope.row._rowKind === 'item'"
                  class="ledger-sub-row-label"
                >{{ formatFinanceListSubRowLabel(scope.row, listDisplayOptions) }}</span>
                <span
                  v-else-if="col.prop === 'customer_name' && scope.row._rowKind === 'payment'"
                  class="ledger-sub-row-label"
                >{{ formatFinanceListSubRowLabel(scope.row, listDisplayOptions) }}</span>
              </template>
              <template
                v-else-if="col.prop === 'customer_name' && (isFinanceListMainRow(scope.row) || isFinanceListGroupRow(scope.row))"
              >
                <FinanceListExpandTrigger
                  :row="scope.row"
                  :expanded="isExpanded(financeListRowExpandKey(scope.row))"
                  @toggle="toggleExpand(financeListRowExpandKey(scope.row))"
                />
                <CopyableCell
                  :value="scope.row?.customer_name != null && scope.row?.customer_name !== '' ? scope.row.customer_name : ''"
                />
                <span
                  v-if="isFinanceListGroupRow(scope.row) && scope.row._recordCount > 1"
                  class="ledger-group-count"
                >（{{ scope.row._recordCount }}条）</span>
              </template>
              <template v-else-if="col.prop === 'status'">
                <el-tag
                  v-if="scope.row?.status"
                  size="small"
                  :type="paymentStatusTagType(scope.row?.status)"
                  effect="plain"
                >
                  {{ scope.row.status }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'invoice_status'">
                <el-tag
                  v-if="scope.row?.invoice_status"
                  size="small"
                  :type="invoiceStatusTagType(scope.row?.invoice_status)"
                  effect="plain"
                >
                  {{ scope.row.invoice_status }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'unit_price'">
                <CopyableCell :value="formatFinanceListQuantity(scope.row?.unit_price)" />
              </template>
              <template v-else-if="MONEY_COLUMN_PROPS.has(col.prop)">
                <CopyableCell :value="formatFinanceListMoney(scope.row?.[col.prop])" />
              </template>
              <template v-else-if="col.prop === 'quantity'">
                <CopyableCell :value="formatFinanceListQuantity(scope.row?.quantity)" />
              </template>
              <template v-else-if="DATE_COLUMN_PROPS.has(col.prop)">
                <CopyableCell :value="formatDateOnly(scope.row?.[col.prop]) || ''" />
              </template>
              <CopyableCell
                v-else
                :value="scope.row?.[col.prop] != null && scope.row?.[col.prop] !== '' ? scope.row[col.prop] : ''"
              />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="96" align="center">
            <template #default="{ row }">
              <el-button
                v-if="isProjectDetailLedgerSummaryRow(row)"
                type="primary"
                link
                size="small"
                @click.stop="goDetail(row)"
              >
                进入详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <ProjectPayableCreateDialog
      v-model="createVisible"
      :project-id="projectId"
      @success="fetchList"
    />
    <ProjectPayableLinkDialog
      v-model="linkVisible"
      :project-id="projectId"
      @success="fetchList"
    />

    <ProjectDetailPrivateAccountLedger
      :project-id="projectId"
      direction="支出"
      section-title="私账（支出）"
    />
  </div>
</template>

<style scoped lang="scss">
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
  font-size: 16px;
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
  min-width: 1280px;

  :deep(.finance-list-row--expandable) {
    cursor: pointer;
  }

  :deep(.finance-list-row--item),
  :deep(.finance-list-row--payment) {
    background-color: var(--el-fill-color-lighter);
  }

  :deep(.finance-list-row--merged td) {
    vertical-align: middle;
  }

  :deep(.finance-list-row--item .el-table__cell:first-child .cell),
  :deep(.finance-list-row--payment .el-table__cell:first-child .cell) {
    padding-left: 20px;
  }

  :deep(.finance-list-row--main td) {
    padding-bottom: 6px;
    border-bottom: none;
  }

  :deep(.finance-list-row--main-meta td) {
    padding-top: 0;
    background-color: var(--el-fill-color-blank);
  }

  :deep(.finance-list-row--main-meta .el-table__cell) {
    border-top: none;
  }

  :deep(.finance-list-row--main + .finance-list-row--main-meta td) {
    border-top: 1px dashed var(--el-border-color-extra-light);
  }

  :deep(.finance-list-row--main-meta .el-table__cell) {
    padding-top: 4px;
    padding-bottom: 10px;
    font-size: 13px;
  }

  :deep(.finance-list-row--group td) {
    padding-bottom: 10px;
    font-weight: 500;
    background-color: var(--el-fill-color-blank);
  }

  :deep(.finance-list-row--group + .finance-list-row--group-member td) {
    border-top: 1px dashed var(--el-border-color-extra-light);
  }

  :deep(.finance-list-row--group-member td) {
    padding-top: 4px;
    padding-bottom: 10px;
    font-size: 13px;
  }
}

.ledger-group-count {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}

.ledger-sub-row-label {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
