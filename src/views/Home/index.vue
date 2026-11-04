<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ModuleGrid from './components/ModuleGrid.vue'
import WelcomeBanner from './components/WelcomeBanner.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import { useMenu } from '@/stores/menuStore'

defineOptions({
  name: 'HomeIndex',
})

const route = useRoute()
const router = useRouter()
const menuStore = useMenu()

// 当前展示的模块列表（顶层或某个模块的子模块）
const currentModules = computed(() => menuStore.menuList || [])

// 当前查看的父模块（用于返回）
const currentParent = computed(() => menuStore.currentParent)

// 菜单是否已就绪（区分「加载中」与「已加载但为空」）
const menuReady = computed(() => menuStore.menuReady)

// 展示中的模块：下钻时取父模块的子模块，否则取顶层菜单
const visibleModules = computed(() =>
  currentParent.value ? currentParent.value.children || [] : currentModules.value
)

// 根据路由更新状态
function updateByRoute() {
  const path = route.path
  menuStore.setCurrentByPath(path)
}

// 监听路由变化
watch(
  () => route.path,
  () => {
    updateByRoute()
  }
)

// 点击模块
function handleModuleClick(module) {
  if (module.children && module.children.length > 0) {
    // 有子模块，跳转到对应路由
    router.push(module.path)
  } else {
    // 叶子节点，跳转到对应路由
    router.push(module.path)
  }
}

// 菜单数据由 Layout 统一加载，这里只同步一次当前路由对应的模块状态
onMounted(() => {
  updateByRoute()
})
</script>

<template>
  <div class="home-container">
    <!-- 欢迎横幅（常驻，不随菜单加载变化） -->
    <WelcomeBanner />

    <!-- 主内容区 -->
    <div class="home-content">
      <!-- 左侧模块列表 -->
      <div class="module-section">
        <!-- 菜单加载中：展示骨架占位，避免整块卸载重挂造成闪烁 -->
        <div v-if="!menuReady" class="module-skeleton">
          <div v-for="i in 4" :key="i" class="skeleton-card"></div>
        </div>

        <!-- 菜单已就绪：原地渲染，数据到达时不发生结构切换 -->
        <ModuleGrid
          v-else
          :modules="visibleModules"
          @module-click="handleModuleClick"
        />
      </div>

      <!-- 右侧动态栏 -->
      <ActivityPanel />
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-container {
  padding: 24px;
  min-height: calc(100vh - 120px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
}

// 菜单骨架屏：占位卡片与真实卡片尺寸一致，数据到达后原地替换
.module-skeleton {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  .skeleton-card {
    height: 190px;
    border-radius: 12px;
    border: 1px solid #ebeef5;
    background: linear-gradient(90deg, #f5f7fa 25%, #fafbfc 37%, #f5f7fa 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.home-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.module-section {
  flex: 1;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}
</style>
