<script setup>
import { defineOptions, watch, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LayoutHeader from './components/LayoutHeader.vue'
import BreadcrumbNav from './components/BreadcrumbNav.vue'
import { useMenu } from '@/stores/menuStore'

defineOptions({
  name: 'LayoutIndex',
})

const route = useRoute()
const menuStore = useMenu()

// 菜单是否已加载完成
const menuLoaded = ref(false)

// 监听路由变化，更新面包屑（仅在菜单加载完成后执行）
watch(
  () => route.path,
  (path) => {
    if (menuLoaded.value) {
      menuStore.setCurrentByPath(path)
    }
  }
)

// 加载菜单数据完成后，再设置面包屑
onMounted(async () => {
  await menuStore.getMenuList()
  menuLoaded.value = true
  menuStore.setCurrentByPath(route.path)
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
