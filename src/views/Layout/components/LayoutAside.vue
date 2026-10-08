<script setup>
import { toRef } from 'vue'
import { useLayoutAsideMenu } from '../composables/useLayoutAsideMenu'

const props = defineProps({
  isCollapse: {
    type: Boolean,
    default: false,
  },
})

const { menuStore, menuRef, persistedOpeneds, activeMenuIndex, onSubmenuOpen, onSubmenuClose } =
  useLayoutAsideMenu(toRef(props, 'isCollapse'))
</script>

<template>
  <div class="layout-aside">
    <el-row>
      <el-menu
        ref="menuRef"
        class="el-menu-vertical"
        active-text-color="#ffd04b"
        background-color="#545c64"
        text-color="#fff"
        router
        :collapse="props.isCollapse"
        :default-active="activeMenuIndex"
        :default-openeds="persistedOpeneds"
        @open="onSubmenuOpen"
        @close="onSubmenuClose"
      >
        <template v-for="menu in menuStore.asideMenuList" :key="menu.path">
          <template v-if="menu.children && menu.children.length">
            <el-sub-menu :index="menu.path">
              <template #title>
                <el-icon><component :is="menu.meta.icon" /></el-icon>
                <span>{{ menu.meta.title }}</span>
              </template>
              <template v-for="child in menu.children" :key="child.path">
                <el-sub-menu v-if="child.children && child.children.length" :index="child.path">
                  <template #title>
                    <el-icon><component :is="child.meta.icon" /></el-icon>
                    <span>{{ child.meta.title }}</span>
                  </template>
                  <el-menu-item
                    v-for="grandChild in child.children"
                    :key="grandChild.path"
                    :index="grandChild.path"
                  >
                    <el-icon><component :is="grandChild.meta.icon" /></el-icon>
                    <span>{{ grandChild.meta.title }}</span>
                  </el-menu-item>
                </el-sub-menu>
                <el-menu-item v-else :index="child.path">
                  <el-icon><component :is="child.meta.icon" /></el-icon>
                  <span>{{ child.meta.title }}</span>
                </el-menu-item>
              </template>
            </el-sub-menu>
          </template>
          <el-menu-item v-else :index="menu.path">
            <el-icon><component :is="menu.meta.icon" /></el-icon>
            <span>{{ menu.meta.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.layout-aside {
  height: 100%;
  background-color: #545c64;
}
:deep(.el-menu) {
  border-right: none;
  width: 100%;
}
</style>
