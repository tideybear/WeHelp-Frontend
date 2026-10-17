import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getMenuListAPI } from '@/apis/menu'
import { useNamespace } from '@/stores/namespaceStore'
import { useUserStore } from '@/stores/userStore'

export const useMenu = defineStore('Menu', () => {
  // 导航列表的数据管理
  const menuList = ref([])
  
  // 当前查看的父模块
  const currentParent = ref(null)

  // 面包屑历史记录
  const breadcrumbHistory = ref([{ title: '首页', path: '/' }])

  // 加载状态
  const loading = ref(false)

  // 根据路径获取模块
  const getModuleByPath = (path, list = menuList.value) => {
    for (const item of list) {
      if (item.path === path) {
        return item
      }
      if (item.children?.length > 0) {
        const found = getModuleByPath(path, item.children)
        if (found) return found
      }
    }
    return null
  }

  // 获取菜单列表
  const getMenuList = async () => {
    loading.value = true
    try {
      const namespaceStore = useNamespace()

      if (await namespaceStore.redirectToLoginIfNoUser()) {
        menuList.value = []
        return
      }

      const nsid = namespaceStore.currentNamespaceId
      const userStore = useUserStore()
      const uid = userStore.userInfo?.id

      if (nsid == null || nsid === '' || uid == null || uid === '') {
        menuList.value = []
        return
      }

      const res = await getMenuListAPI(Number(nsid), Number(uid))
      menuList.value = res.data
    } finally {
      loading.value = false
    }
  }

  // 根据路由路径设置当前模块
  const setCurrentByPath = (path) => {
    if (path === '/') {
      currentParent.value = null
      breadcrumbHistory.value = [{ title: '首页', path: '/' }]
    } else {
      const module = getModuleByPath(path)
      if (module && module.children?.length > 0) {
        currentParent.value = module
        breadcrumbHistory.value = [
          { title: '首页', path: '/' },
          { title: module.meta?.title, path: module.path }
        ]
      } else if (module) {
        // 叶子节点，跳转到对应路由
        currentParent.value = null
        breadcrumbHistory.value = [
          { title: '首页', path: '/' }
        ]
      }
    }
  }

  // 清空菜单数据
  const clearMenuData = () => {
    menuList.value = []
    currentParent.value = null
    breadcrumbHistory.value = [{ title: '首页', path: '/' }]
  }

  // 添加到面包屑历史
  const addToBreadcrumb = (module) => {
    breadcrumbHistory.value.push({
      title: module.meta?.title,
      path: module.path
    })
  }

  // 返回上一级面包屑
  const goBackBreadcrumb = () => {
    breadcrumbHistory.value = breadcrumbHistory.value.slice(0, -1)
  }

  return {
    menuList,
    currentParent,
    breadcrumbHistory,
    loading,
    getMenuList,
    getModuleByPath,
    setCurrentByPath,
    clearMenuData,
    addToBreadcrumb,
    goBackBreadcrumb,
  }
})
