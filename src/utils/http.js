import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import router from '@/router'

/**
 * 开发（.env.development）：http://127.0.0.1:5001 直连本机后端
 * 生产（.env.production）：/api 同源，由 Nginx 反代到 Flask
 */
const httpInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
})

httpInstance.interceptors.request.use((config) => {
  const userStore = useUserStore()
  const token = userStore.userInfo?.token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 清理空参数
  if (config.params) {
    config.params = Object.fromEntries(
      Object.entries(config.params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    )
  }
  return config
}, (e) => Promise.reject(e))

httpInstance.interceptors.response.use(
  (res) => res.data,
  (e) => {
    const userStore = useUserStore()
    const msg =
      e.response?.data?.message ??
      e.response?.data?.msg ??
      e.message ??
      '网络异常，请稍后重试'
    ElMessage.warning(msg)
    if (e.response?.status === 401) {
      userStore.clearUserInfo()
      router.push('/login')
    }
    return Promise.reject(e)
  },
)

export default httpInstance
