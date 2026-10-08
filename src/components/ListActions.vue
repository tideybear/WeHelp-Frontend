<script setup>
const props = defineProps({
  row: {
    type: Object,
    default: () => ({})
  },
  rowIndex: {
    type: Number,
    default: 0
  },
  // true=可点击正常显示；false=置灰不可点击
  editEnabled: {
    type: Boolean,
    default: true
  },
  // true=可点击正常显示；false=置灰不可点击
  deleteEnabled: {
    type: Boolean,
    default: true
  },
  /** 为 true 时仅显示「查看」，不显示编辑/删除 */
  viewOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['delete', 'edit', 'view'])

const handleEdit = () => {
  if (!props.editEnabled) return
  emit('edit', props.rowIndex)
}

const handleDelete = () => {
  if (!props.deleteEnabled) return
  emit('delete', props.rowIndex)
}

const handleView = () => {
  emit('view', props.rowIndex)
}
</script>


<template>
  <div class="order-actions">
    <el-button
      v-if="viewOnly"
      type="text"
      size="small"
      @click="handleView"
    >
      查看
    </el-button>
    <template v-else>
      <el-button
        :disabled="!editEnabled"
        @click="handleEdit"
        type="text"
        size="small">
        编辑
      </el-button>
      <el-button
        :disabled="!deleteEnabled"
        @click="handleDelete"
        type="text"
        size="small">
        删除
      </el-button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.order-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
  .el-button {
    color: #409eff;

    &.is-disabled {
      color: #c0c4cc;          // 灰色文字
      cursor: not-allowed;     // 禁用指针样式
    }
  }
}
</style>

