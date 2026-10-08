import { ref } from 'vue'

const LAYOUT_SIDEBAR_COLLAPSE_KEY = 'layout.sidebarCollapse'

function readSidebarCollapseFromStorage() {
  try {
    const v = localStorage.getItem(LAYOUT_SIDEBAR_COLLAPSE_KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* private mode / quota */
  }
  return false
}

function writeSidebarCollapseToStorage(collapsed) {
  try {
    localStorage.setItem(LAYOUT_SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * 左侧栏折叠宽度与 localStorage 同步（与 LayoutHeader / LayoutAside 一致）
 */
export function useLayoutSidebarCollapse() {
  const initialCollapse = readSidebarCollapseFromStorage()
  const asideWidth = ref(initialCollapse ? '64px' : '200px')
  const isCollapse = ref(initialCollapse)

  const updateIsCollapse = (value) => {
    isCollapse.value = value
    writeSidebarCollapseToStorage(value)
  }

  const updateAsideWidth = (value) => {
    asideWidth.value = value
  }

  return {
    isCollapse,
    asideWidth,
    updateIsCollapse,
    updateAsideWidth,
  }
}
