<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ModuleGrid from './components/ModuleGrid.vue'
import WelcomeBanner from './components/WelcomeBanner.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import BreadcrumbNav from '../Layout/components/BreadcrumbNav.vue'
import { useMenu } from '@/stores/menuStore'
import { Loading } from '@element-plus/icons-vue'

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

// 加载状态
const loading = computed(() => menuStore.loading)

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

// 获取菜单列表
onMounted(async () => {
  await menuStore.getMenuList()
  updateByRoute()
})
</script>

<template>
  <div class="home-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-icon" :size="40"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <template v-else>
      <!-- 欢迎横幅 -->
      <WelcomeBanner />

      <!-- 主内容区 -->
      <div class="home-content">
        <!-- 左侧模块列表 -->
        <div class="module-section">
          <div class="section-header">
            <!-- 面包屑导航 -->
            <BreadcrumbNav />
          </div>
          <ModuleGrid 
            :modules="currentParent ? currentParent.children : currentModules" 
            @module-click="handleModuleClick" 
          />
        </div>

        <!-- 右侧动态栏 -->
        <ActivityPanel />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.home-container {
  padding: 24px;
  min-height: calc(100vh - 120px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
  color: #909399;
  font-size: 16px;

  .loading-icon {
    animation: rotate 1s linear infinite;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
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

  .section-header {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;
  }
}
</style>
