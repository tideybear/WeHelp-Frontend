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

  // 菜单是否已完成首次加载（用于渲染层区分「无数据」与「加载中」）
  const menuReady = ref(false)

  // 已成功加载的菜单标识（namespaceId:userId），用于避免重复请求
  const loadedKey = ref('')

  // 进行中的菜单请求（同一 key 的并发调用共享同一个 Promise）
  let inflight = null
  let inflightKey = ''

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

  // 根据路径获取父模块
  const getParentModule = (path, list = menuList.value, parent = null) => {
    for (const item of list) {
      if (item.path === path) {
        return parent
      }
      if (item.children?.length > 0) {
        const found = getParentModule(path, item.children, item)
        if (found !== null) return found
      }
    }
    return null
  }

  // 获取菜单列表
  // 说明：同一 (namespaceId, userId) 只真正请求一次，
  // 并发调用共享同一个 Promise，避免 loading 反复抖动导致的页面闪烁
  const getMenuList = async ({ force = false } = {}) => {
    const namespaceStore = useNamespace()

    if (await namespaceStore.redirectToLoginIfNoUser()) {
      menuList.value = []
      menuReady.value = true
      return
    }

    const nsid = namespaceStore.currentNamespaceId
    const userStore = useUserStore()
    const uid = userStore.userInfo?.id

    if (nsid == null || nsid === '' || uid == null || uid === '') {
      menuList.value = []
      menuReady.value = true
      return
    }

    const key = `${nsid}:${uid}`

    // 已有相同 key 的请求在进行中，直接复用
    if (!force && inflight && inflightKey === key) {
      return inflight
    }

    // 已经成功加载过相同 key，直接复用
    if (!force && loadedKey.value === key) {
      return
    }

    loading.value = true
    inflightKey = key
    const current = (async () => {
      try {
        const res = await getMenuListAPI(Number(nsid), Number(uid))
        menuList.value = res.data
        loadedKey.value = key
      } catch (e) {
        menuList.value = []
      } finally {
        loading.value = false
        menuReady.value = true
        if (inflight === current) {
          inflight = null
          inflightKey = ''
        }
      }
    })()
    inflight = current

    return current
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
        // 叶子节点，查找父模块并添加到面包屑
        const parent = getParentModule(path)
        currentParent.value = null
        if (parent) {
          breadcrumbHistory.value = [
            { title: '首页', path: '/' },
            { title: parent.meta?.title, path: parent.path },
            { title: module.meta?.title, path: module.path }
          ]
        } else {
          breadcrumbHistory.value = [
            { title: '首页', path: '/' },
            { title: module.meta?.title, path: module.path }
          ]
        }
      }
    }
  }

  // 清空菜单数据
  const clearMenuData = () => {
    menuList.value = []
    currentParent.value = null
    breadcrumbHistory.value = [{ title: '首页', path: '/' }]
    menuReady.value = false
    loadedKey.value = ''
    inflight = null
    inflightKey = ''
  }

  return {
    menuList,
    currentParent,
    breadcrumbHistory,
    loading,
    menuReady,
    getMenuList,
    getModuleByPath,
    getParentModule,
    setCurrentByPath,
    clearMenuData,
  }
}, {
  // 只持久化 breadcrumbHistory，menuList 从 API 重新获取
  persist: {
    paths: ['breadcrumbHistory'],
  },
})
