<script setup>
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'
import supplierListDefault from './List/supplierListDefault/index.vue'

defineOptions({ name: 'PurchaseSuppliersPage' })

const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

const { currentView, ready } = useNamespaceViewModule({
  defaultComponent: supplierListDefault,
  listPrefix: 'supplierList',
  importList: (name) => import(`./List/${name}/index.vue`),
  logLabel: '供应商列表',
})
</script>

<template>
  <router-view v-if="ready" v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <component :is="currentView" v-else :namespace-id="currentNamespaceId" />
  </router-view>
</template>
