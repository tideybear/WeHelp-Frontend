<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useMenu } from '@/stores/menuStore'
  import { useUserStore } from '@/stores/userStore'
  import { Expand, Fold, ArrowUp, ArrowDown } from '@element-plus/icons-vue'

  const menuStore = useMenu()
  const userStore = useUserStore()
  const router = useRouter()

  const displayName = computed(() => userStore.userInfo?.account || '用户')
  const avatarLetter = computed(() => {
    const s = (displayName.value || '用').trim()
    return s ? s.charAt(0).toUpperCase() : '用'
  })

  const handleUserCommand = async (cmd) => {
    if (cmd === 'profile') {
      ElMessage.info('个人信息页面开发中')
      return
    }
    if (cmd === 'logout') {
      userStore.clearUserInfo()
      await router.replace('/login')
    }
  }
  const isOpen = ref(false)
  const namespaceName = ref('请选择项目')

  const props = defineProps({
    isCollapse: {
      type: Boolean,
      default: false
    }
  })


  

  const emit = defineEmits(['handleCollapse', 'width-change'])
  const handleCollapse = () => {
    emit('handleCollapse', !props.isCollapse)
    emit('width-change', !props.isCollapse ? '64px' : '200px')
  }



  const selectnamespace= (namespace) => {
    menuStore.setCurrentNamespaceId(namespace.id)
    namespaceName.value = namespace.name
    isOpen.value = !isOpen.value
  }
  const toggleDropdown= () => {
    isOpen.value = !isOpen.value
  }
  // 获取菜单数据
  onMounted(async () => {
    await menuStore.getNamespaceMenu()
    // 根据 currentNamespaceId 找到对应的项目
    const currentNamespace = menuStore.namespaceMenuList.find(p => p.id === menuStore.currentNamespaceId)
    if (currentNamespace) {
      namespaceName.value = currentNamespace.name
    } else if (menuStore.namespaceMenuList.length > 0) {
      // 如果找不到，使用第一个项目
      namespaceName.value = menuStore.namespaceMenuList[0].name
    }
  })
</script>

<template>
  <header class='app-header'>
    <div class="header-container">
      <div class="collapse-btn">
        <el-icon @click="handleCollapse" v-if="props.isCollapse"><Expand/></el-icon>
        <el-icon @click="handleCollapse" v-else><Fold/></el-icon>
      </div>
      <div class="header-content">
        <el-row>
          <el-col :span="4">
            <div class="dropdown">
              <button @click="toggleDropdown" class="dropdown-toggle">
                <div class="namespacespan">{{ namespaceName || '请选择' }}</div>
                <el-icon v-if="isOpen"><ArrowUp /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
              </button>
              <ul v-show="isOpen" class="dropdown-menu">
                <li 
                  v-for="namespace in menuStore.namespaceMenuList" 
                  :key="namespace.id"
                  :index="namespace.id.toString()"
                  @click="selectnamespace(namespace)"
                  :class="{ 'selected': namespace.id === menuStore.currentNamespaceId }"
                >
                {{ namespace.name }}
                </li>
              </ul>
            </div>
          </el-col>
          <el-col :span="20" class="header-user-col">
            <div v-if="userStore.userInfo?.token" class="header-user">
              <el-dropdown trigger="click" @command="handleUserCommand">
                <div class="header-user__trigger" role="button" tabindex="0">
                  <el-avatar
                    class="header-user__avatar"
                    :size="36"
                    :src="userStore.userInfo.avatar || undefined"
                  >
                    {{ avatarLetter }}
                  </el-avatar>
                  <span class="header-user__name">{{ displayName }}</span>
                  <el-icon class="header-user__caret"><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                    <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </header>
</template>


<style scoped lang='scss'>
.app-header {
  background-color: #545c64;
  height: 60px;
  position: relative;
  z-index: 10;
  
  .header-container {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .collapse-btn {
    width: 200px;
    height: 60px;
    background-color: #545c64;
    color: #fff;
    padding: 0 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    border: none;
    z-index: 1000;
    
    .el-icon {
      margin-right: 5px;
      width: var(--el-menu-icon-width);
      text-align: center;
      font-size: 18px;
      vertical-align: middle;
    }
  }

  .header-content {
    flex: 1;
    height: 100%;
    line-height: 60px;

    :deep(.el-row) {
      height: 100%;
      align-items: center;
    }

    .header-user-col {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      height: 100%;
      padding-right: 16px;
      box-sizing: border-box;
    }

    .header-user {
      flex-shrink: 0;
    }

    .header-user__trigger {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      color: #fff;
      outline: none;

      &:hover,
      &:focus-visible {
        background: rgba(255, 255, 255, 0.08);
      }

      &:focus-visible {
        box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.5);
      }
    }

    .header-user__avatar {
      flex-shrink: 0;
    }

    .header-user__name {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }

    .header-user__caret {
      font-size: 12px;
      opacity: 0.85;
    }

    .dropdown {
      position: relative;
      display: inline-block;
      height: 95%;
      width: 100%;
      background: #545c64;
    }

    .dropdown-toggle {
      background: #545c64;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0 20px;
      border: none;
      color: #fff;
      font-size: 14px;
      line-height: 60px;

      .namespacespan {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
      }

      &:hover {
        background-color: #434a50;
      }
    }

    .arrow {
      display: inline-block;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #fff;
      margin-left: 8px;
      transition: transform 0.3s;
    }

    .arrow-up {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 1000;
      width: 100%;
      padding: 5px 0;
      margin: 0;
      background: #545c64;
      list-style: none;
      box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);

      li {
        padding: 0 20px;
        height: 40px;
        line-height: 40px;
        cursor: pointer;
        color: #fff;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        &:hover {
          background-color: #434a50;
        }

        &.selected {
          color: #409eff;
          background-color: #263445;
        }
      }
    }
  }
}
</style>