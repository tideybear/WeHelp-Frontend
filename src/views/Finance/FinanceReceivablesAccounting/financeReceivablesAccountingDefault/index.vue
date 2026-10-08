<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ReceivablesAccountingList from './List/index.vue'
import ReceivablesAccountingDetail from './Detail/index.vue'

defineOptions({ name: 'FinanceReceivablesAccountingDefault' })

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
  () =>
    route.name === 'FinanceReceivableAccountingDetail'
    && route.params.id != null
    && route.params.id !== '',
)
</script>

<template>
  <ReceivablesAccountingDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <ReceivablesAccountingList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
    :list-filter="listFilter"
  />
</template>
