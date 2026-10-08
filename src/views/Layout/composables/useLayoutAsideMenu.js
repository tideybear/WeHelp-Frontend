import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'

const LAYOUT_ASIDE_MENU_OPENEDS_KEY = 'layout.asideMenuOpeneds'

function readMenuOpenedsFromStorage() {
  try {
    const raw = localStorage.getItem(LAYOUT_ASIDE_MENU_OPENEDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeMenuOpenedsToStorage(arr) {
  try {
    localStorage.setItem(LAYOUT_ASIDE_MENU_OPENEDS_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

/**
 * 与 el-menu-item :index 一致的高亮项：优先等于当前路由，否则取「仍是路由前缀」的最长菜单 path。
 */
export function resolveActiveMenuIndex(routePath, menus) {
  const leaves = []
  function walk(list) {
    for (const node of list || []) {
      if (node.children?.length) {
        walk(node.children)
      } else if (typeof node.path === 'string' && node.path) {
        leaves.push(node.path)
      }
    }
  }
  walk(menus)
  if (!leaves.length) return routePath
  if (leaves.includes(routePath)) return routePath
  let best = ''
  for (const p of leaves) {
    if (routePath === p || routePath.startsWith(`${p}/`)) {
      if (p.length > best.length) best = p
    }
  }
  return best || routePath
}

/** 展开哪些 el-sub-menu 才能看到该叶子项（与侧栏树结构一致） */
export function submenuPathToLeaf(leafIndex, menus) {
  const stack = []
  let found = false
  function dfs(list, acc) {
    for (const node of list || []) {
      if (found) return
      if (!node.children?.length) {
        if (node.path === leafIndex) {
          stack.push(...acc)
          found = true
          return
        }
        continue
      }
      dfs(node.children, [...acc, node.path])
    }
  }
  dfs(menus, [])
  return stack
}

/**
 * 侧栏 el-menu：持久化展开项、按路由高亮、与折叠态联动
 * @param {import('vue').Ref<boolean>} isCollapseRef
 */
export function useLayoutAsideMenu(isCollapseRef) {
  const menuStore = useMenu()
  const route = useRoute()
  const isCollapse = isCollapseRef

  const menuRef = ref(null)
  const persistedOpeneds = ref(readMenuOpenedsFromStorage())

  const activeMenuIndex = computed(() =>
    resolveActiveMenuIndex(route.path, menuStore.asideMenuList),
  )

  function onSubmenuOpen(index) {
    if (!persistedOpeneds.value.includes(index)) {
      persistedOpeneds.value = [...persistedOpeneds.value, index]
      writeMenuOpenedsToStorage(persistedOpeneds.value)
    }
  }

  function onSubmenuClose(index) {
    persistedOpeneds.value = persistedOpeneds.value.filter((i) => i !== index)
    writeMenuOpenedsToStorage(persistedOpeneds.value)
  }

  function reopenStoredSubmenusAndActive() {
    if (isCollapse.value) return
    const menus = menuStore.asideMenuList
    if (!menus?.length) return
    const leaf = activeMenuIndex.value
    const fromRoute = submenuPathToLeaf(leaf, menus)
    const ids = [...new Set([...persistedOpeneds.value, ...fromRoute])]

    nextTick(() => {
      const m = menuRef.value
      if (!m) return
      if (typeof m.updateActiveIndex === 'function') {
        try {
          m.updateActiveIndex(leaf)
        } catch {
          /* ignore */
        }
      }
      if (typeof m.open === 'function') {
        ids.forEach((idx) => {
          try {
            m.open(idx)
          } catch {
            /* index 已不存在于当前菜单时忽略 */
          }
        })
      }
    })
  }

  watch(
    [() => route.path, () => menuStore.asideMenuList, () => isCollapse.value],
    () => {
      reopenStoredSubmenusAndActive()
    },
    { immediate: true },
  )

  onMounted(() => {
    menuStore.getAsideMenu()
  })

  watch(
    () => menuStore.currentNamespaceId,
    (newVal, oldVal) => {
      if (newVal != null && newVal !== '' && newVal !== oldVal) {
        menuStore.getAsideMenu()
      }
    },
  )

  return {
    menuStore,
    menuRef,
    persistedOpeneds,
    activeMenuIndex,
    onSubmenuOpen,
    onSubmenuClose,
  }
}
