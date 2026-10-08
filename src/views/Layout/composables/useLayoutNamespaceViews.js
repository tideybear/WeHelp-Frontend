import { watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useViewStore } from '@/stores/viewStore'
import { useUserStore } from '@/stores/userStore'

/**
 * 随当前空间/项目加载视图列表；切换 namespace 时回首页并刷新列表
 */
export function useLayoutNamespaceViews() {
  const router = useRouter()
  const menuStore = useMenu()
  const viewStore = useViewStore()
  const userStore = useUserStore()

  const loadViewList = async () => {
    if (menuStore.currentNamespaceId) {
      await viewStore.getViewList(menuStore.currentNamespaceId)
    }
  }

  const loadUserList = async () => {
    if (menuStore.currentNamespaceId) {
      await userStore.fetchUserList(menuStore.currentNamespaceId)
    }
  }

  // 在 Layout setup 阶段即发起请求，早于 Home 子组件 mounted，减少首页 Dashboard 闪动
  if (menuStore.currentNamespaceId) {
    void loadViewList()
    void loadUserList()
  }

  onMounted(() => {
    if (menuStore.currentNamespaceId && !viewStore.viewListLoaded && !viewStore.viewListLoading) {
      void loadViewList()
    }
    if (menuStore.currentNamespaceId) {
      void loadUserList()
    }
  })

  watch(
    () => menuStore.currentNamespaceId,
    (newVal, oldVal) => {
      if (newVal && newVal !== oldVal) {
        void loadViewList()
        void loadUserList()
        router.push('/')
      }
    },
  )

  return { loadViewList, loadUserList }
}
