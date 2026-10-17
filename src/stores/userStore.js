// 管理用户数据相关

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginAPI, getUserListAPI } from '@/apis/user.js'
import { touchLastActivity, clearLastActivity } from '@/utils/sessionActivity'
import { useNamespace } from '@/stores/namespaceStore'
import { useMenu } from '@/stores/menuStore'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const userList = ref([])

  const getUserInfo = async ({ account, password }) => {
    const res = await loginAPI({ account, password })
    if (!res?.result) {
      throw new Error(res?.msg || '登录返回数据异常')
    }
    // 合并 token 到 userInfo
    userInfo.value = { ...res.result }
    touchLastActivity()
  }

  const fetchUserList = async (namespace_id) => {
    const res = await getUserListAPI({ namespace_id })
    userList.value = (res?.data || []).filter((u) => Number(u.id) !== 1)
  }

  const clearUserInfo = () => {
    userInfo.value = {}
    userList.value = []
    clearLastActivity()
    // 清空其他 store 数据
    useNamespace().clearNamespaceData()
    useMenu().clearMenuData()
  }

  return {
    userInfo,
    userList,
    getUserInfo,
    fetchUserList,
    clearUserInfo,
  }
}, {
  persist: true,
})
