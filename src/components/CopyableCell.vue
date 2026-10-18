<script setup>
defineProps({
  value: {
    type: [String, Number],
    default: '',
  },
})

const copyText = (text) => {
  if (!text) return
  navigator.clipboard.writeText(String(text)).then(() => {
    // 可选：添加复制成功的反馈
  })
}
</script>

<template>
  <span class="copyable-cell" @click="copyText(value)" :title="'点击复制: ' + value">
    {{ value || '—' }}
  </span>
</template>

<style scoped>
.copyable-cell {
  cursor: pointer;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copyable-cell:hover {
  color: var(--el-color-primary);
}
</style>
