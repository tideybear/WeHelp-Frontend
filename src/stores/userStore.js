// 管理用户数据相关

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loginAPI, getUserListAPI, getUserDetailAPI } from '@/apis/user.js'
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
    // 登录成功后拉取用户详情（含 ai_use_key 等信息），失败不阻断登录
    try {
      const detailRes = await getUserDetailAPI({ id: res.result.id })
      const raw = detailRes?.result ?? detailRes?.data
      // 后端可能返回单条对象，也可能返回列表（取第一条）
      const detail = Array.isArray(raw) ? raw[0] : raw
      if (detail) {
        // 详情覆盖其他字段，但保留登录接口返回的 token 与 id
        userInfo.value = {
          ...userInfo.value,
          ...detail,
          token: userInfo.value.token ?? detail.token,
          id: userInfo.value.id ?? detail.id,
        }
      }
    } catch (e) {
      console.error('[用户信息] 获取用户详情失败:', e)
    }
    touchLastActivity()
  }

  const fetchUserList = async (namespace_id) => {
    // 缺少空间 id 时不请求，避免后端拿到空参数报错
    if (namespace_id === undefined || namespace_id === null || namespace_id === '') return
    const res = await getUserListAPI({ namespace_id })
    userList.value = (res?.data || []).filter((u) => Number(u.id) !== 0)
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
