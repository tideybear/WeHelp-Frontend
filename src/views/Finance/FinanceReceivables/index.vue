<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'FinanceReceivablesPage' })

/** view_authorize.component 与目录名一致，按优先级匹配 */
const RECEIVABLES_PACKAGE_NAMES = ['financeReceivablesYiLu', 'financeReceivablesDefault']

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

/** 财务应收列表固定筛选：排除账务手续类 */
const listFilter = { is_accounting_procedures: 0 }

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: RECEIVABLES_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./financeReceivablesDefault/index.vue'),
  logLabel: '应收账款',
})
</script>

<template>
  <component
    v-if="ready && currentView"
    :is="currentView"
    :key="viewInstanceKey"
    :namespace-id="currentNamespaceId"
    :list-filter="listFilter"
  />
</template>
