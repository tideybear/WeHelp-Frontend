<script setup>
import { computed, watch } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import {
  createEmptyPaymentRecord,
  PAYMENT_METHOD_OPTIONS,
} from '@/utils/financePaymentRecords'

defineOptions({ name: 'FinancePaymentRecordsEditor' })

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  sectionTitle: {
    type: String,
    default: '收付款明细',
  },
  amountLabel: {
    type: String,
    default: '明细合计',
  },
  dateLabel: {
    type: String,
    default: '收付款日期',
  },
  bankLabel: {
    type: String,
    default: '银行',
  },
  accountLabel: {
    type: String,
    default: '账号/流水号',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 禁止新增行（如合同金额为 0） */
  addDisabled: {
    type: Boolean,
    default: false,
  },
  addDisabledHint: {
    type: String,
    default: '请先填写大于 0 的合同金额后，方可添加收付款明细',
  },
  layout: {
    type: String,
    default: 'default',
  },
})

const emit = defineEmits(['update:modelValue', 'update:totalAmount'])

const records = computed({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue : []),
  set: (val) => emit('update:modelValue', val),
})

const totalAmount = computed(() => {
  let sum = 0
  for (const row of records.value) {
    const n = Number(row.amount)
    if (Number.isFinite(n)) sum += n
  }
  return Math.round(sum * 100) / 100
})

watch(totalAmount, (v) => emit('update:totalAmount', v), { immediate: true })

function addRow() {
  emit('update:modelValue', [...records.value, createEmptyPaymentRecord()])
}

function removeRow(index) {
  emit('update:modelValue', records.value.filter((_, i) => i !== index))
}

function formatMoney(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div
    class="finance-payment-editor"
    :class="{ 'finance-payment-editor--wide': layout === 'wide' }"
  >
    <div class="finance-payment-editor__head">
      <span class="finance-payment-editor__title">{{ sectionTitle }}</span>
      <el-button
        v-if="!disabled && !addDisabled"
        type="primary"
        link
        :icon="Plus"
        @click="addRow"
      >
        添加一行
      </el-button>
    </div>

    <div v-if="!records.length" class="finance-payment-editor__empty">
      <template v-if="addDisabled">{{ addDisabledHint }}</template>
      <template v-else>暂无明细，如需录入请点击「添加一行」</template>
    </div>

    <div v-else class="finance-payment-editor__table-wrap">
      <el-table
        :data="records"
        border
        size="small"
        class="finance-payment-editor__table"
        :header-cell-style="{
          background: 'var(--el-fill-color-light)',
          color: 'var(--el-text-color-primary)',
          fontWeight: 600,
        }"
      >
        <el-table-column label="金额" :width="layout === 'wide' ? 120 : 108">
          <template #header>
            <span class="finance-payment-editor__required">金额</span>
          </template>
          <template #default="{ row }">
            <el-input-number
              v-model="row.amount"
              :disabled="disabled"
              :min="0"
              :precision="2"
              :controls="true"
              controls-position="right"
              class="finance-payment-editor__num"
            />
          </template>
        </el-table-column>
        <el-table-column :min-width="layout === 'wide' ? 140 : 120">
          <template #header>
            <span class="finance-payment-editor__required">{{ dateLabel }}</span>
          </template>
          <template #default="{ row }">
            <el-date-picker
              v-model="row.payment_date"
              :disabled="disabled"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="必填"
              class="finance-payment-editor__date"
            />
          </template>
        </el-table-column>
        <el-table-column :label="bankLabel" :min-width="layout === 'wide' ? 130 : 100">
          <template #default="{ row }">
            <el-input
              v-model="row.payment_bank"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="100"
            />
          </template>
        </el-table-column>
        <el-table-column :label="accountLabel" :min-width="layout === 'wide' ? 140 : 110">
          <template #default="{ row }">
            <el-input
              v-model="row.payment_account"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="50"
            />
          </template>
        </el-table-column>
        <el-table-column label="方式" width="108">
          <template #default="{ row }">
            <el-select
              v-model="row.payment_method"
              :disabled="disabled"
              placeholder="方式"
              class="finance-payment-editor__method"
            >
              <el-option
                v-for="opt in PAYMENT_METHOD_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="单号" min-width="90">
          <template #default="{ row }">
            <el-input
              v-model="row.payment_no"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="50"
            />
          </template>
        </el-table-column>
        <el-table-column label="凭证号" min-width="90">
          <template #default="{ row }">
            <el-input
              v-model="row.voucher_no"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="50"
            />
          </template>
        </el-table-column>
        <el-table-column label="经办人" width="88">
          <template #default="{ row }">
            <el-input
              v-model="row.handler"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="50"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="88">
          <template #default="{ row }">
            <el-input
              v-model="row.remark"
              :disabled="disabled"
              clearable
              placeholder="选填"
              maxlength="200"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="!disabled" label="操作" width="56" align="center" fixed="right">
          <template #default="{ $index }">
            <el-button
              type="danger"
              link
              :icon="Delete"
              @click="removeRow($index)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="records.length" class="finance-payment-editor__total">
      <span class="finance-payment-editor__total-label">{{ amountLabel }}</span>
      <strong class="finance-payment-editor__total-value">{{ formatMoney(totalAmount) }}</strong>
      <span class="finance-payment-editor__total-hint">（按明细行金额汇总）</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-payment-editor {
  margin: 12px 0 8px;
  padding: 12px 14px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
}

.finance-payment-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.finance-payment-editor__title {
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

.finance-payment-editor__required::after {
  content: '*';
  color: var(--el-color-danger);
  margin-left: 2px;
}

.finance-payment-editor__empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px dashed var(--el-border-color-lighter);
}

.finance-payment-editor__table-wrap {
  border-radius: 6px;
  overflow: hidden;
}

.finance-payment-editor--wide .finance-payment-editor__table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.finance-payment-editor--wide .finance-payment-editor__table {
  min-width: 1320px;
}

.finance-payment-editor__table {
  width: 100%;

  :deep(.el-table__cell) {
    padding: 6px 4px;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
  }
}

.finance-payment-editor__num {
  width: 100%;
}

.finance-payment-editor__date {
  width: 100%;
}

.finance-payment-editor__method {
  width: 100%;
}

.finance-payment-editor__total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.finance-payment-editor__total-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.finance-payment-editor__total-value {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-primary);
}

.finance-payment-editor__total-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
