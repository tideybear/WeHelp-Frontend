<script setup>
const props = defineProps({
  total: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 100 },
  pageSizes: { type: Array, default: () => [100, 200, 300, 400] },
  layout: { type: String, default: 'total, sizes, prev, pager, next, jumper' },
  background: { type: Boolean, default: true }
})

const emit = defineEmits([
  'update:currentPage',
  'update:pageSize',
  'size-change',
  'current-change'
])

const onSizeChange = (val) => {
  emit('update:pageSize', val)
  emit('size-change', val)
}

const onCurrentChange = (val) => {
  emit('update:currentPage', val)
  emit('current-change', val)
}
</script>

<template>
  <div class="pagination-bar">
    <el-pagination
      :background="background"
      :total="total"
      :current-page="currentPage"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      :layout="layout"
      @size-change="onSizeChange"
      @current-change="onCurrentChange"
    />
  </div>
</template>

<style scoped lang="scss">
.pagination-bar {
  padding: 10px 10px;
  text-align: right;
  background-color: #ffffff;
}

/* 选中页背景色 */
:deep(.el-pager .number.is-active) {
  background-color: #409eff !important;
  color: #ffffff !important;
}

:deep(.el-pager .number.is-active:hover) {
  color: #ffffff !important;
}

/* hover 字体色（按你现有的行为：未选中 hover 变黑） */
:deep(.el-pager .number:hover) {
  color: #000000 !important;
}
</style>

