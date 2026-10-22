<script setup>
import { defineOptions, watch, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutHeader from './components/LayoutHeader.vue'
import BreadcrumbNav from './components/BreadcrumbNav.vue'
import { useMenu } from '@/stores/menuStore'

defineOptions({
  name: 'LayoutIndex',
})

const route = useRoute()
const router = useRouter()
const menuStore = useMenu()

// 菜单是否已加载完成
const menuLoaded = ref(false)

// 根据路由路径构建面包屑
function buildBreadcrumbFromRoute(path) {
  // 首页
  if (path === '/') {
    menuStore.breadcrumbHistory = [{ title: '首页', path: '/' }]
    return
  }

  // 详情页路由（/crm/list/detail/:id）
  if (path.includes('/detail/')) {
    const basePath = path.replace(/\/detail\/[^/]+$/, '')
    const detailRoute = router.getRoutes().find(r => r.path === path)
    const listRoute = router.getRoutes().find(r => r.path === basePath)
    const parentRoute = router.getRoutes().find(r => r.path === basePath.replace(/\/[^/]+$/, ''))

    menuStore.breadcrumbHistory = [
      { title: '首页', path: '/' },
      ...(parentRoute?.meta?.title ? [{ title: parentRoute.meta.title, path: parentRoute.path }] : []),
      ...(listRoute?.meta?.title ? [{ title: listRoute.meta.title, path: basePath }] : []),
      { title: detailRoute?.meta?.title || '详情', path: path }
    ]
    return
  }

  // 其他路由使用菜单配置
  menuStore.setCurrentByPath(path)
}

// 监听路由变化，更新面包屑（仅在菜单加载完成后执行）
watch(
  () => route.path,
  (path) => {
    if (menuLoaded.value) {
      buildBreadcrumbFromRoute(path)
    }
  }
)

// 加载菜单数据完成后，再设置面包屑
onMounted(async () => {
  await menuStore.getMenuList()
  menuLoaded.value = true
  buildBreadcrumbFromRoute(route.path)
})
</script>

<template>
  <el-container class="app-container">
    <el-header>
      <LayoutHeader />
    </el-header>
    <el-container class="layout-container">
      <div class="breadcrumb-bar">
        <BreadcrumbNav />
      </div>
      <div class="content-box">
        <div class="content-wrapper">
          <el-main>
            <RouterView />
          </el-main>
        </div>
      </div>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.breadcrumb-bar {
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.el-main {
  margin: 0;
  padding: 20px;
  height: 100%;
  overflow: auto;
}

.content-box {
  flex: 1;
  min-width: 0;
  height: calc(100% - 50px);
  display: flex;

  .content-wrapper {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;

    .el-main {
      margin: 0;
      padding: 20px;
      height: 100%;
      overflow: auto;
      flex: 1;
    }
  }
}

.el-aside {
  width: 200px;
  height: 100%;
  transition: width 0.3s ease-in-out;
}

.el-header {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 60px;
}

.el-footer {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 10px;
}

.layout-container {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}
</style>
