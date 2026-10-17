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

  // 获取菜单列表
  const getMenuList = async () => {
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
  }

  // 清空菜单数据
  const clearMenuData = () => {
    menuList.value = []
    currentParent.value = null
  }

  return {
    menuList,
    currentParent,
    getMenuList,
    clearMenuData,
  }
})
