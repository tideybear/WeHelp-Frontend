<script setup>
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'
import customerListDefault from './List/customerListDefault/index.vue'

defineOptions({ name: 'SalesCustomersPage' })

const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

const { currentView, ready } = useNamespaceViewModule({
  defaultComponent: customerListDefault,
  listPrefix: 'customerList',
  importList: (name) => import(`./List/${name}/index.vue`),
  logLabel: '客户列表',
})
</script>

<template>
  <router-view v-if="ready" v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <component :is="currentView" v-else :namespace-id="currentNamespaceId" />
  </router-view>
</template>
