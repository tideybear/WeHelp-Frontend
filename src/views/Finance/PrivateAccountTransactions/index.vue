<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'PrivateAccountTransactionsPage' })

const PRIVATE_ACCOUNT_PACKAGE_NAMES = [
  'privateAccountTransactionsYiLu',
  'privateAccountTransactionsDefault',
]

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: PRIVATE_ACCOUNT_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./privateAccountTransactionsDefault/index.vue'),
  logLabel: '私账流水',
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
