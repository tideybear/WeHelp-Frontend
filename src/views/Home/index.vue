<script setup>
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'HomePage' })

/**
 * view_authorize.component 名（兼容 Pascal / camel）→ dashboard 子目录
 * 目录位于 ./dashboard/{dir}/index.vue
 */
const DASHBOARD_PACKAGE_NAMES = [
  'DashboardDSPT',
  'DashboardYiLu',
  'dashboardYiLu',
  'DashboardDefault',
  'dashboardDefault',
]

const DASHBOARD_DIR_BY_PACKAGE = {
  DashboardDSPT: 'dashboardDefault',
  DashboardYiLu: 'dashboardYiLu',
  dashboardYiLu: 'dashboardYiLu',
  DashboardDefault: 'dashboardDefault',
  dashboardDefault: 'dashboardDefault',
}

function resolveDashboardDir(name) {
  return DASHBOARD_DIR_BY_PACKAGE[name] ?? name
}

const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: DASHBOARD_PACKAGE_NAMES,
  importPackage: (name) => import(`./dashboard/${resolveDashboardDir(name)}/index.vue`),
  importDefault: () => import('./dashboard/dashboardDefault/index.vue'),
  logLabel: '首页 Dashboard',
})
</script>

<template>
  <component
    v-if="ready && currentView"
    :is="currentView"
    :key="viewInstanceKey"
    :namespace-id="currentNamespaceId"
  />
</template>
