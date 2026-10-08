<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'FinancialApprovalPage' })

const FINANCIAL_APPROVAL_PACKAGE_NAMES = ['financialApprovalYiLu', 'financialApprovalDefault']

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: FINANCIAL_APPROVAL_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./financialApprovalDefault/index.vue'),
  logLabel: '财务审批',
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
