<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'FinancePayablesAccountingPage' })

const PAYABLES_ACCOUNTING_PACKAGE_NAMES = [
  'financePayablesAccountingYiLu',
  'financePayablesAccountingDefault',
]

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

/** 账务手续应付：仅账务手续类 */
const listFilter = { is_accounting_procedures: 1 }

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: PAYABLES_ACCOUNTING_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./financePayablesAccountingDefault/index.vue'),
  logLabel: '账务手续应付',
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
