// 管理用户数据相关

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginAPI, getUserListAPI } from '@/apis/user.js'
import { touchLastActivity, clearLastActivity } from '@/utils/sessionActivity'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const userList = ref([])

  const getUserInfo = async ({ account, password }) => {
    const res = await loginAPI({ account, password })
    if (!res?.result) {
      throw new Error(res?.msg || '登录返回数据异常')
    }
    userInfo.value = res.result
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
