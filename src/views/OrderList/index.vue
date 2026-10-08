<script setup lang="ts">
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'
import OrderListDefault from './components/OrderList.vue'

const menuStore = useMenu()
const currentProjectId = computed(() => menuStore.currentProjectId ?? 1)

const { currentView, ready } = useNamespaceViewModule({
  defaultComponent: OrderListDefault,
  listPrefix: 'OrderList',
  importList: (name) => import(`./components/${name}.vue`),
  logLabel: '订单列表',
})
</script>

<template>
  <component v-if="ready && currentView" :is="currentView" :project-id="currentProjectId" />
</template>

<style lang="scss" scoped>

</style>
