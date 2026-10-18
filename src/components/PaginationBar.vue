<script setup>
const props = defineProps({
  currentPage: {
    type: Number,
    default: 1,
  },
  pageSize: {
    type: Number,
    default: 50,
  },
  total: {
    type: Number,
    default: 0,
  },
  pageSizes: {
    type: Array,
    default: () => [50, 100, 200],
  },
})

const emit = defineEmits(['update:currentPage', 'update:pageSize', 'size-change', 'current-change'])

const handleSizeChange = (val) => {
  emit('update:pageSize', val)
  emit('size-change', val)
}

const handleCurrentChange = (val) => {
  emit('update:currentPage', val)
  emit('current-change', val)
}
</script>

<template>
  <el-pagination
    :current-page="currentPage"
    :page-size="pageSize"
    :page-sizes="pageSizes"
    :total="total"
    layout="total, sizes, prev, pager, next, jumper"
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
  />
</template>

<style scoped>
/* 自定义分页样式 */
</style>
