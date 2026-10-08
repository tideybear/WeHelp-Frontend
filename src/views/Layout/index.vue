<script setup>
import { defineOptions } from 'vue'
import LayoutAside from './components/LayoutAside.vue'
import LayoutHeader from './components/LayoutHeader.vue'
import { useLayoutSidebarCollapse } from './composables/useLayoutSidebarCollapse'
import { useLayoutNamespaceViews } from './composables/useLayoutNamespaceViews'

defineOptions({
  name: 'LayoutIndex',
})

const { isCollapse, asideWidth, updateIsCollapse, updateAsideWidth } = useLayoutSidebarCollapse()
useLayoutNamespaceViews()
</script>

<template>
  <el-container class="app-container">
    <el-header>
      <LayoutHeader
        :isCollapse="isCollapse"
        @handleCollapse="updateIsCollapse"
        @width-change="updateAsideWidth"
      />
    </el-header>
    <el-container class="layout-container">
      <el-aside :style="{ width: asideWidth }">
        <LayoutAside :isCollapse="isCollapse" />
      </el-aside>
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
.el-main {
  margin: 0;
  padding: 20px;
  height: 100%;
  overflow: auto;
}
.content-box {
  flex: 1;
  min-width: 0;
  height: 100%;
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
}
</style>
