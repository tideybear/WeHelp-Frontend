<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ModuleGrid from './components/ModuleGrid.vue'
import WelcomeBanner from './components/WelcomeBanner.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import { useMenu } from '@/stores/menuStore'
import { Fold } from '@element-plus/icons-vue'

defineOptions({
  name: 'HomeIndex',
})

const router = useRouter()
const menuStore = useMenu()

// 当前展示的模块列表（顶层或某个模块的子模块）
const currentModules = computed(() => menuStore.menuList || [])

// 当前查看的父模块（用于返回）
const currentParent = computed(() => menuStore.currentParent)

// 切换到子模块
function handleModuleClick(module) {
  if (module.children && module.children.length > 0) {
    // 有子模块，切换到子模块列表
    menuStore.currentParent = module
  } else {
    // 无子模块，跳转到对应路由
    router.push(module.path)
  }
}

// 返回上级
function goBack() {
  menuStore.currentParent = null
}

// 获取菜单列表
onMounted(async () => {
  await menuStore.getMenuList()
})
</script>

<template>
  <div class="home-container">
    <!-- 欢迎横幅 -->
    <WelcomeBanner />

    <!-- 主内容区 -->
    <div class="home-content">
      <!-- 左侧模块列表 -->
      <div class="module-section">
        <div class="section-header">
          <!-- 面包屑导航 -->
          <div class="breadcrumb">
            <span 
              class="breadcrumb-item" 
              :class="{ active: !currentParent }"
              @click="goBack"
            >
              功能模块
            </span>
            <template v-if="currentParent">
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-item active">
                {{ currentParent.meta?.title }}
              </span>
            </template>
          </div>
        </div>
        <ModuleGrid 
          :modules="currentParent ? currentParent.children : currentModules" 
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
  }
}
</style>
