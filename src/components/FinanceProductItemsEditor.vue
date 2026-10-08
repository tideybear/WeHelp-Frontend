<script setup>
import { computed, ref, watch } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  createEmptyFinanceItem,
  createClientItemId,
  calcLineAmount,
  DEFAULT_TAX_RATE,
  isMergedItemRow,
  isMergeGroupLeader,
  getMergeGroupRows,
  resolveRowAmountForTotal,
  prepareEditorItemsForDisplay,
  financeProductItemsSpanMethod,
} from '@/utils/financeProductItems'

defineOptions({ name: 'FinanceProductItemsEditor' })

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  amountLabel: {
    type: String,
    default: '合计金额',
  },
  productLabel: {
    type: String,
    default: '产品/货款名称',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 允许多选合并单价、金额 */
  allowMerge: {
    type: Boolean,
    default: false,
  },
  /** default=弹窗等窄容器；wide=详情页全宽横向滚动 */
  layout: {
    type: String,
    default: 'default',
  },
})

const emit = defineEmits(['update:modelValue', 'update:totalAmount'])

const items = computed({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue : []),
  set: (val) => emit('update:modelValue', val),
})

const selectedClientIds = ref(new Set())

const totalAmount = computed(() => {
  let sum = 0
  for (const row of items.value) {
    const amt = resolveRowAmountForTotal(row, items.value)
    if (Number.isFinite(amt)) sum += amt
  }
  return Math.round(sum * 100) / 100
})

watch(totalAmount, (v) => emit('update:totalAmount', v), { immediate: true })

function emitItems(next) {
  emit('update:modelValue', prepareEditorItemsForDisplay(next))
}

function taxRateText(row) {
  const n = row.tax_rate
  if (n == null || n === '') return String(DEFAULT_TAX_RATE)
  return String(n)
}

function onTaxRateInput(row, val) {
  const s = String(val ?? '').replace(/%/g, '').trim()
  if (s === '') {
    row.tax_rate = DEFAULT_TAX_RATE
    return
  }
  const n = Number(s)
  row.tax_rate = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_TAX_RATE
}

function onTaxRateBlur(row) {
  row.tax_rate = parseTaxRate(row.tax_rate)
}

function parseTaxRate(raw) {
  const n = Number(String(raw ?? '').replace(/%/g, '').trim())
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_TAX_RATE
  return Math.round(n * 100) / 100
}

function syncRowAmount(index) {
  const row = items.value[index]
  if (!row || isMergedItemRow(row)) return
  const amt = calcLineAmount(row.quantity, row.unit_price)
  const next = items.value.map((r, i) =>
    i === index ? { ...r, amount: amt } : { ...r },
  )
  emitItems(next)
}

function syncMergeGroupPricing(mergeGroupId, patch) {
  const gid = String(mergeGroupId ?? '').trim()
  if (!gid) return
  const next = items.value.map((r) => {
    if (String(r._mergeGroupId ?? '') !== gid) return { ...r }
    return { ...r, ...patch }
  })
  emitItems(next)
}

function onMergedUnitPriceChange(mergeGroupId, val) {
  syncMergeGroupPricing(mergeGroupId, { unit_price: val })
}

function onMergedAmountChange(mergeGroupId, val) {
  syncMergeGroupPricing(mergeGroupId, { amount: val })
}

function addRow() {
  emitItems([...items.value, createEmptyFinanceItem()])
}

function clearMergeOnRow(row) {
  return {
    ...row,
    _mergeGroupId: null,
    merged_display_ids: undefined,
  }
}

function removeRow(index) {
  const removed = items.value[index]
  const gid = removed?._mergeGroupId
  let next = items.value.filter((_, i) => i !== index)
  if (gid) {
    const remaining = next.filter((r) => r._mergeGroupId === gid)
    if (remaining.length <= 1) {
      next = next.map((r) =>
        r._mergeGroupId === gid ? clearMergeOnRow(r) : r,
      )
    }
  }
  if (removed?._clientId) {
    const sel = new Set(selectedClientIds.value)
    sel.delete(removed._clientId)
    selectedClientIds.value = sel
  }
  emitItems(next)
}

function removeRowByClientId(clientId) {
  const index = items.value.findIndex((r) => r._clientId === clientId)
  if (index >= 0) removeRow(index)
}

function toggleSelect(clientId, checked) {
  const sel = new Set(selectedClientIds.value)
  if (checked) sel.add(clientId)
  else sel.delete(clientId)
  selectedClientIds.value = sel
}

function toggleSelectAll(checked) {
  if (!checked) {
    selectedClientIds.value = new Set()
    return
  }
  selectedClientIds.value = new Set(
    items.value.map((r) => r._clientId).filter(Boolean),
  )
}

const allSelected = computed(
  () =>
    items.value.length > 0 &&
    items.value.every((r) => selectedClientIds.value.has(r._clientId)),
)

const mergeSelectionCount = computed(() => selectedClientIds.value.size)

function mergeSelectedRows() {
  const ids = [...selectedClientIds.value]
  if (ids.length < 2) {
    ElMessage.warning('请至少选择两条明细进行合并')
    return
  }
  const selected = items.value.filter((r) => ids.includes(r._clientId))
  const existingGroups = [
    ...new Set(selected.map((r) => r._mergeGroupId).filter(Boolean)),
  ]
  if (existingGroups.length > 1) {
    ElMessage.warning('请先取消已有合并，再重新选择')
    return
  }
  const mergeGroupId = existingGroups[0] || `mg-${createClientItemId()}`
  const leader = selected.find((r) => r._mergeGroupId === mergeGroupId) || selected[0]
  const patch = {
    _mergeGroupId: mergeGroupId,
    unit_price: leader?.unit_price,
    amount: leader?.amount,
  }
  const next = items.value.map((r) =>
    ids.includes(r._clientId) ? { ...r, ...patch } : { ...r },
  )
  selectedClientIds.value = new Set()
  emitItems(next)
  ElMessage.success(`已合并 ${ids.length} 条明细，请填写合并后的单价与金额`)
}

function unmergeRow(row) {
  const gid = row?._mergeGroupId
  if (!gid) return
  const next = items.value.map((r) =>
    r._mergeGroupId === gid ? clearMergeOnRow(r) : { ...r },
  )
  emitItems(next)
}

function formatMoney(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function displayAmount(row) {
  if (isMergedItemRow(row)) {
    return row.amount
  }
  return calcLineAmount(row.quantity, row.unit_price) ?? row.amount
}

function rowClassName({ row }) {
  if (isMergedItemRow(row)) return 'finance-items-editor__row--merged'
  return ''
}
</script>

<template>
  <div
    class="finance-items-editor"
    :class="{ 'finance-items-editor--wide': layout === 'wide' }"
  >
    <div class="finance-items-editor__head">
      <span class="finance-items-editor__title">产品明细</span>
      <div class="finance-items-editor__head-actions">
        <el-button
          v-if="allowMerge && !disabled && items.length >= 2"
          type="primary"
          link
          :disabled="mergeSelectionCount < 2"
          @click="mergeSelectedRows"
        >
          合并{{ mergeSelectionCount >= 2 ? `（${mergeSelectionCount}）` : '' }}
        </el-button>
        <el-button
          v-if="!disabled"
          type="primary"
          link
          :icon="Plus"
          @click="addRow"
        >
          添加一行
        </el-button>
      </div>
    </div>

    <div v-if="!items.length" class="finance-items-editor__empty">
      暂无产品明细，如需录入请点击「添加一行」
    </div>

    <div v-else class="finance-items-editor__table-wrap">
      <el-table
        :data="items"
        border
        size="small"
        class="finance-items-editor__table"
        :row-class-name="rowClassName"
        :span-method="financeProductItemsSpanMethod"
        :header-cell-style="{
          background: 'var(--el-fill-color-light)',
          color: 'var(--el-text-color-primary)',
          fontWeight: 600,
        }"
      >
        <el-table-column
          v-if="allowMerge && !disabled"
          width="44"
          align="center"
        >
          <template #header>
            <el-checkbox
              :model-value="allSelected"
              @change="toggleSelectAll"
            />
          </template>
          <template #default="{ row }">
            <el-checkbox
              :model-value="selectedClientIds.has(row._clientId)"
              @change="(v) => toggleSelect(row._clientId, v)"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="product_name"
          min-width="132"
        >
          <template #header>
            <span class="finance-items-editor__required">{{ productLabel }}</span>
          </template>
          <template #default="{ row }">
            <el-input
              v-model="row.product_name"
              :disabled="disabled"
              clearable
              placeholder="必填"
              maxlength="100"
            />
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格型号" min-width="100">
          <template #default="{ row }">
            <el-input
              v-model="row.specification"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="100"
            />
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="72">
          <template #default="{ row }">
            <el-input
              v-model="row.unit"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="20"
            />
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="108">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.quantity"
              :disabled="disabled"
              :min="0"
              :precision="4"
              :controls="true"
              controls-position="right"
              class="finance-items-editor__num"
              @change="syncRowAmount(items.findIndex((r) => r._clientId === row._clientId))"
            />
          </template>
        </el-table-column>
        <el-table-column prop="unit_price" label="单价" width="120">
          <template #default="{ row }">
            <template v-if="isMergedItemRow(row)">
              <template v-if="isMergeGroupLeader(row, items)">
                <el-input-number
                  v-if="!disabled"
                  :model-value="row.unit_price"
                  :min="0"
                  :precision="4"
                  :controls="true"
                  controls-position="right"
                  class="finance-items-editor__num"
                  placeholder="合并单价"
                  @update:model-value="(v) => onMergedUnitPriceChange(row._mergeGroupId, v)"
                />
                <span v-else class="finance-items-editor__amount-cell">
                  {{ formatMoney(row.unit_price) }}
                </span>
                <div v-if="!disabled" class="finance-items-editor__merge-hint">
                  已合并 {{ getMergeGroupRows(items, row._mergeGroupId).length }} 行
                </div>
              </template>
              <span v-else class="finance-items-editor__merged-follow">同组合并</span>
            </template>
            <template v-else-if="!disabled">
              <el-input-number
                v-model="row.unit_price"
                :min="0"
                :precision="4"
                :controls="true"
                controls-position="right"
                class="finance-items-editor__num"
                @change="syncRowAmount(items.findIndex((r) => r._clientId === row._clientId))"
              />
            </template>
            <span v-else class="finance-items-editor__amount-cell">
              {{ formatMoney(row.unit_price) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }">
            <template v-if="isMergedItemRow(row)">
              <template v-if="isMergeGroupLeader(row, items)">
                <el-input-number
                  v-if="!disabled"
                  :model-value="row.amount"
                  :min="0"
                  :precision="2"
                  :controls="true"
                  controls-position="right"
                  class="finance-items-editor__num finance-items-editor__num--amount"
                  placeholder="合并金额"
                  @update:model-value="(v) => onMergedAmountChange(row._mergeGroupId, v)"
                />
                <span v-else class="finance-items-editor__amount-cell">
                  {{ formatMoney(row.amount) }}
                </span>
              </template>
              <span v-else class="finance-items-editor__merged-follow">同组合并</span>
            </template>
            <span v-else class="finance-items-editor__amount-cell">
              {{ formatMoney(displayAmount(row)) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="tax_rate" label="税率" width="96" align="center">
          <template #default="{ row }">
            <el-input
              :model-value="taxRateText(row)"
              :disabled="disabled"
              placeholder="13"
              maxlength="6"
              class="finance-items-editor__tax-input"
              @update:model-value="(v) => onTaxRateInput(row, v)"
              @blur="onTaxRateBlur(row)"
            >
              <template #append>%</template>
            </el-input>
          </template>
        </el-table-column>
        <el-table-column v-if="!disabled" label="操作" width="88" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="allowMerge && isMergedItemRow(row)"
              type="primary"
              link
              @click="unmergeRow(row)"
            >
              拆分
            </el-button>
            <el-button
              type="danger"
              link
              :icon="Delete"
              @click="removeRowByClientId(row._clientId)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="items.length" class="finance-items-editor__total">
      <span class="finance-items-editor__total-label">{{ amountLabel }}</span>
      <strong class="finance-items-editor__total-value">{{ formatMoney(totalAmount) }}</strong>
      <span class="finance-items-editor__total-hint">
        （不含税{{ allowMerge ? '；合并组金额只计一次' : '，按明细行金额汇总' }}）
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-items-editor {
  margin: 12px 0 8px;
  padding: 12px 14px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
}

.finance-items-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.finance-items-editor__head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.finance-items-editor__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  &::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 12px;
    margin-right: 8px;
    border-radius: 2px;
    background: var(--el-color-primary);
    vertical-align: -1px;
  }
}

.finance-items-editor__required::after {
  content: '*';
  color: var(--el-color-danger);
  margin-left: 2px;
}

.finance-items-editor__empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px dashed var(--el-border-color-lighter);
}

.finance-items-editor__table-wrap {
  border-radius: 6px;
  overflow: hidden;
}

.finance-items-editor--wide .finance-items-editor__table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.finance-items-editor--wide .finance-items-editor__table {
  min-width: 1180px;
}

.finance-items-editor__table {
  width: 100%;

  :deep(.el-table__cell) {
    padding: 6px 4px;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }

  :deep(.finance-items-editor__row--merged) {
    background: var(--el-color-primary-light-9);
  }

  :deep(.finance-items-editor__row--merged td) {
    vertical-align: middle;
  }
}

.finance-items-editor__num {
  width: 100%;
}

.finance-items-editor__num--amount {
  :deep(.el-input__inner) {
    text-align: right;
  }
}

.finance-items-editor__merge-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-color-primary);
  line-height: 1.2;
}

.finance-items-editor__merged-follow {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.finance-items-editor__tax-input {
  width: 100%;

  :deep(.el-input-group__append) {
    padding: 0 8px;
    background: var(--el-fill-color-light);
  }
}

.finance-items-editor__amount-cell {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.finance-items-editor__total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.finance-items-editor__total-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.finance-items-editor__total-value {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
}

.finance-items-editor__total-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
