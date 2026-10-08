<script setup>
import { computed } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import {
  financeListRowHasDetails,
  isFinanceListGroupRow,
  isFinanceListMainRow,
} from '@/utils/financeListDisplay'

defineOptions({ name: 'FinanceListExpandTrigger' })

const props = defineProps({
  row: {
    type: Object,
    default: null,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])

const visible = computed(() => {
  if (isFinanceListGroupRow(props.row)) return financeListRowHasDetails(props.row)
  return isFinanceListMainRow(props.row) && financeListRowHasDetails(props.row)
})

function onClick() {
  emit('toggle')
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="finance-list-expand"
    :aria-expanded="expanded"
    aria-label="展开或收起明细"
    @click.stop="onClick"
  >
    <el-icon class="finance-list-expand__icon">
      <ArrowDown v-if="expanded" />
      <ArrowRight v-else />
    </el-icon>
  </button>
</template>

<style scoped lang="scss">
.finance-list-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  vertical-align: middle;
  line-height: 1;

  &:hover {
    color: var(--el-color-primary);
  }
}

.finance-list-expand__icon {
  font-size: 14px;
}
</style>
