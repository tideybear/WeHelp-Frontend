<script setup>
defineProps({
  row: {
    type: Object,
    default: () => ({}),
  },
  rowIndex: {
    type: Number,
    default: 0,
  },
  editEnabled: {
    type: Boolean,
    default: true,
  },
  deleteEnabled: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['view', 'edit', 'delete'])

const handleView = () => emit('view')
const handleEdit = () => emit('edit')
const handleDelete = () => emit('delete')
</script>

<template>
  <div class="list-actions">
    <el-button link type="primary" size="small" @click="handleView">查看</el-button>
    <el-button link type="primary" size="small" @click="handleEdit" v-if="editEnabled">编辑</el-button>
    <el-button link type="danger" size="small" @click="handleDelete" v-if="deleteEnabled">删除</el-button>
  </div>
</template>

<style scoped>
.list-actions {
  display: flex;
  gap: 8px;
}
</style>
