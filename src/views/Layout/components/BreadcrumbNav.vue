<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMenu } from '@/stores/menuStore'

defineOptions({ name: 'BreadcrumbNav' })

const router = useRouter()
const menuStore = useMenu()

// 从 store 获取面包屑数据
const breadcrumbHistory = computed(() => menuStore.breadcrumbHistory)

/**
 * 处理面包屑项点击
 * 逻辑规则：
 * 1. 点击末项（当前页面）- 不做任何操作
 * 2. 点击首页 - 导航到首页（路由变化后 store 会自动重置面包屑）
 * 3. 点击其他项 - 导航到对应路由
 */
function handleClick(item, index) {
  const isLastItem = index === breadcrumbHistory.value.length - 1

  // 点击末项，不做任何操作
  if (isLastItem) {
    return
  }

  // 点击首页或其他项，导航到对应路由
  router.push(item.path)
}
</script>

<template>
  <div class="breadcrumb">
    <template v-for="(item, index) in breadcrumbHistory" :key="index">
      <span
        class="breadcrumb-item"
        :class="{ active: index === breadcrumbHistory.length - 1 }"
        @click="handleClick(item, index)"
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
