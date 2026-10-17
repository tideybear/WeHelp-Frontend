import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getNamespaceListAPI } from '@/apis/namespace'
import { useUserStore } from '@/stores/userStore'
import router from '@/router'

export const useNamespace = defineStore('Namespace', () => {
  // 命名空间菜单列表
  const namespaceList = ref([])
  // 控制权限使用
  const namespaceListId = ref([])

  // 从 localStorage 恢复 currentNamespaceId，如果不存在则为 undefined
  const getStoredNamespaceId = () => {
    try {
      const stored = localStorage.getItem('currentNamespaceId')
      return stored ? Number(stored) : undefined
    } catch (e) {
      return undefined
    }
  }

  const currentNamespaceId = ref(getStoredNamespaceId())

  /** 与历史代码兼容：项目/空间 ID 即 currentNamespaceId */
  const currentProjectId = computed(() => currentNamespaceId.value)

  /** 未登录或缺少用户 id 时跳转登录 */
  async function redirectToLoginIfNoUser() {
    const userStore = useUserStore()
    const token = userStore.userInfo?.token
    const uid = userStore.userInfo?.id
    const hasValidId = uid != null && uid !== ''

    if (!token || !hasValidId) {
      userStore.clearUserInfo()
      const redirect =
        typeof router.currentRoute.value?.fullPath === 'string' &&
        router.currentRoute.value.fullPath.startsWith('/') &&
        !router.currentRoute.value.fullPath.startsWith('/login')
          ? router.currentRoute.value.fullPath
          : '/'
      await router.replace({ path: '/login', query: { redirect } })
      return true
    }
    return false
  }

  // 保存 currentNamespaceId 到 localStorage
  const saveNamespaceId = (id) => {
    try {
      if (id !== undefined && id !== null) {
        localStorage.setItem('currentNamespaceId', String(id))
      } else {
        localStorage.removeItem('currentNamespaceId')
      }
    } catch (e) {
      console.error('Failed to save currentNamespaceId to localStorage:', e)
    }
  }

  // 获取命名空间菜单
  const getNamespaceList = async () => {
    if (await redirectToLoginIfNoUser()) {
      return
    }

    const userStore = useUserStore()
    const uid = userStore.userInfo?.id
    const params = { userid: Number(uid) }
    const res = await getNamespaceListAPI(params)
    namespaceList.value = res.data
    // 根据返回数据中的 namespaceid 去重生成 ID 列表
    const uniqueNamespaceIds = Array.from(
      new Set((res.data || []).map((item) => item.namespaceid))
    ).filter((id) => id !== undefined && id !== null)
    namespaceListId.value = uniqueNamespaceIds

    if (namespaceList.value.length > 0) {
      // 优先使用保存的 namespaceId，如果不存在或不在列表中，则使用第一个
      const storedId = getStoredNamespaceId()
      const isValidId =
        storedId !== undefined &&
        namespaceList.value.some((p) => p.id === storedId)

      if (isValidId) {
        currentNamespaceId.value = storedId
      } else {
        currentNamespaceId.value = namespaceList.value[0].id
        saveNamespaceId(currentNamespaceId.value)
      }
    }
  }

  // 设置 currentNamespaceId 的方法，同时保存到 localStorage
  const setCurrentNamespaceId = (id) => {
    currentNamespaceId.value = id
    saveNamespaceId(id)
  }

  // 清空命名空间数据
  const clearNamespaceData = () => {
    namespaceList.value = []
    namespaceListId.value = []
    currentNamespaceId.value = undefined
    localStorage.removeItem('currentNamespaceId')
  }

  return {
    namespaceList,
    namespaceListId,
    currentNamespaceId,
    currentProjectId,
    getNamespaceList,
    setCurrentNamespaceId,
    redirectToLoginIfNoUser,
    clearNamespaceData,
  }
})
