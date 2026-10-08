import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useViewStore } from '@/stores/viewStore'
import { loadNamespaceViewModule } from '@/utils/viewComponentResolver'

/** 按「空间 + 模块」缓存已解析的整包/列表组件，避免菜单切换反复卸载 */
const moduleViewCache = new Map()

function buildModuleCacheKey(namespaceId, spec) {
  const pkg = Array.isArray(spec.packageNames) ? spec.packageNames.join('|') : ''
  const prefix = spec.listPrefix ?? ''
  const label = spec.logLabel ?? ''
  return `${namespaceId ?? ''}::${pkg}::${prefix}::${label}`
}

/**
 * 按当前空间 viewList 动态加载列表/整包视图，并监听 viewList 与 namespace 变化。
 * 同一 namespace 下解析结果会缓存；切换菜单时优先复用缓存，减少空白闪烁。
 *
 * @param {object} spec 传给 loadNamespaceViewModule（importPackage / importList / importDefault 等）
 * @param {import('vue').Component} spec.defaultComponent 同步默认组件（用于 importDefault）
 */
export function useNamespaceViewModule(spec) {
  const viewStore = useViewStore()
  const menuStore = useMenu()
  const currentView = shallowRef(spec.defaultComponent ?? null)
  const viewMode = ref('default')
  const resolvedName = ref(null)
  const ready = ref(false)

  const isPackageMode = computed(() => viewMode.value === 'package')

  /** 外层 component 仅随 namespace / 整包名变化而重建 */
  const viewInstanceKey = computed(() => {
    const ns = menuStore.currentNamespaceId ?? ''
    return `${ns}::${resolvedName.value ?? 'default'}`
  })

  function applyCached(entry) {
    if (!entry?.component) return false
    currentView.value = entry.component
    viewMode.value = entry.mode
    resolvedName.value = entry.name
    ready.value = true
    return true
  }

  function readCache(namespaceId) {
    return moduleViewCache.get(buildModuleCacheKey(namespaceId, spec))
  }

  function writeCache(namespaceId, result) {
    const key = buildModuleCacheKey(namespaceId, spec)
    moduleViewCache.set(key, {
      component: result.component,
      mode: result.mode,
      name: result.name,
    })
  }

  async function reload(options = {}) {
    const { silent = false } = options
    const namespaceId = menuStore.currentNamespaceId
    const cached = readCache(namespaceId)

    if (cached) {
      applyCached(cached)
    } else if (!silent) {
      ready.value = false
    }

    if (!viewStore.viewListLoaded) {
      return
    }

    const result = await loadNamespaceViewModule(viewStore.viewList, {
      ...spec,
      importDefault:
        spec.importDefault ??
        (() => Promise.resolve({ default: spec.defaultComponent })),
    })

    currentView.value = result.component
    viewMode.value = result.mode
    resolvedName.value = result.name
    ready.value = true
    writeCache(namespaceId, result)
  }

  onMounted(() => {
    void reload()
  })

  watch(
    () => viewStore.viewList,
    () => {
      if (viewStore.viewListLoaded) void reload({ silent: true })
    },
    { deep: true },
  )

  watch(
    () => viewStore.viewListLoaded,
    (loaded) => {
      if (loaded) void reload({ silent: true })
      else if (!readCache(menuStore.currentNamespaceId)) ready.value = false
    },
  )

  watch(
    () => menuStore.currentNamespaceId,
    (newId, oldId) => {
      if (newId === oldId) return
      const cached = readCache(newId)
      if (cached) {
        applyCached(cached)
      } else {
        ready.value = false
      }
      void reload({ silent: true })
    },
  )

  return {
    currentView,
    viewMode,
    resolvedName,
    ready,
    viewInstanceKey,
    isPackageMode,
    reload,
  }
}
