<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'BankStatementsPage' })

const BANK_STATEMENTS_PACKAGE_NAMES = ['bankStatementsYiLu', 'bankStatementsDefault']

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: BANK_STATEMENTS_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./bankStatementsDefault/index.vue'),
  logLabel: '银行流水',
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
