<script setup>
import { useCopyToClipboard } from '@/composables/ui/useCopyToClipboard'

const props = defineProps({
  value: {
    type: [String, Number],
    default: ''
  }
})

// 使用复制到剪贴板的 composable
const { copyToClipboard } = useCopyToClipboard()

// 处理双击事件
const handleDoubleClick = () => {
  copyToClipboard(props.value)
}
</script>

<template>
  <span 
    class="copyable-cell" 
    :title="'双击复制: ' + value"
    @dblclick="handleDoubleClick">
    {{ value }}
  </span>
</template>

<style scoped lang="scss">
.copyable-cell {
  cursor: pointer;
  user-select: text;
  
//   &:hover {
//     color: #409eff;
//   }
}
</style>
