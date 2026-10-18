<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMenu } from '@/stores/menuStore'

defineOptions({ name: 'BreadcrumbNav' })

const router = useRouter()
const menuStore = useMenu()

const breadcrumbHistory = computed(() => menuStore.breadcrumbHistory)

function handleClick(item) {
  // 如果面包屑只有一个项（首页），点击首页不做任何操作
  if (breadcrumbHistory.value.length === 1 && item.path === '/') {
    return
  }

  if (item.path === '/') {
    // 只有面包屑有多项时才返回
    if (breadcrumbHistory.value.length > 1) {
      menuStore.goBackBreadcrumb()
    }
    router.push('/')
  } else {
    // 如果点击的不是最后一个，跳转到对应路由
    const index = breadcrumbHistory.value.indexOf(item)
    if (index < breadcrumbHistory.value.length - 1) {
      router.push(item.path)
    }
  }
}
</script>

<template>
  <div class="breadcrumb">
    <template v-for="(item, index) in breadcrumbHistory" :key="index">
      <span 
        class="breadcrumb-item" 
        :class="{ active: index === breadcrumbHistory.length - 1 }"
        @click="handleClick(item)"
      >
        {{ item.title }}
      </span>
      <span v-if="index < breadcrumbHistory.length - 1" class="breadcrumb-separator">/</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;

  .breadcrumb-item {
    font-size: 16px;
    font-weight: 500;
    color: #909399;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    transition: all 0.3s;

    &:not(.active):hover {
      color: #019899;
      background: #f0f9f9;
    }

    &.active {
      color: #fff;
      background: linear-gradient(135deg, #019899 0%, #017a7d 100%);
    }
  }

  .breadcrumb-separator {
    color: #c0c4cc;
    font-size: 14px;
  }
}
</style>
