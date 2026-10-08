<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ReceivablesList from './List/index.vue'
import ReceivablesDetail from './Detail/index.vue'

defineOptions({ name: 'FinanceReceivablesDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
  listFilter: {
    type: Object,
    default: () => ({}),
  },
})

const route = useRoute()

const isDetailRoute = computed(
  () => route.name === 'FinanceReceivableDetail' && route.params.id != null && route.params.id !== '',
)
</script>

<template>
  <ReceivablesDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <ReceivablesList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
    :list-filter="listFilter"
  />
</template>
