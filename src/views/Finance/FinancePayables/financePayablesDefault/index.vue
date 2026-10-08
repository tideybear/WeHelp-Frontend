<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PayablesList from './List/index.vue'
import PayablesDetail from './Detail/index.vue'

defineOptions({ name: 'FinancePayablesDefault' })

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
  () => route.name === 'FinancePayableDetail' && route.params.id != null && route.params.id !== '',
)
</script>

<template>
  <PayablesDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <PayablesList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
    :list-filter="listFilter"
  />
</template>
