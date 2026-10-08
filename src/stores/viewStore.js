import { ref } from 'vue'
import { defineStore } from 'pinia'
import { get_viewList } from '@/apis/view'
import { findViewComponentName } from '@/utils/viewComponentResolver'

export const useViewStore = defineStore('view', () => {
  const viewList = ref([])
  /** 按 namespace 缓存 viewList，切换空间时先展示缓存再后台刷新 */
  const viewListByNamespace = ref({})
  /** 当前 namespace 的视图列表是否已请求完成（用于避免首页先闪默认 Dashboard） */
  const viewListLoaded = ref(false)
  const viewListLoading = ref(false)

  const getViewList = async (namespaceId) => {
    const nsKey = String(namespaceId ?? '')
    const cached = viewListByNamespace.value[nsKey]

    viewListLoading.value = true
    if (cached?.length) {
      viewList.value = cached
      viewListLoaded.value = true
    } else {
      viewListLoaded.value = false
      viewList.value = []
    }

    try {
      const res = await get_viewList(namespaceId)
      if (res.code === 200 && res.data) {
        const parsed = Array.isArray(res.data)
          ? res.data
              .map((item) => item.component)
              .filter((component) => component !== undefined && component !== null)
          : []
        viewListByNamespace.value[nsKey] = parsed
        viewList.value = parsed
      } else {
        viewListByNamespace.value[nsKey] = []
        viewList.value = []
      }
    } catch (error) {
      console.error('获取视图列表失败:', error)
      if (!cached?.length) {
        viewListByNamespace.value[nsKey] = []
        viewList.value = []
      }
    } finally {
      viewListLoading.value = false
      viewListLoaded.value = true
    }
  }

  /** 在当前空间 viewList 中查找组件名 */
  function findComponent(options = {}) {
    return findViewComponentName(viewList.value, options)
  }

  function findComponentByPrefix(prefix) {
    return findComponent({ prefix })
  }

  function findPackageComponent(packageNames) {
    return findComponent({ packageNames })
  }

  function hasComponent(name) {
    return viewList.value.includes(name)
  }

  return {
    viewList,
    viewListByNamespace,
    viewListLoaded,
    viewListLoading,
    getViewList,
    findComponent,
    findComponentByPrefix,
    findPackageComponent,
    hasComponent,
  }
})
