<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PayablesAccountingList from './List/index.vue'
import PayablesAccountingDetail from './Detail/index.vue'

defineOptions({ name: 'FinancePayablesAccountingDefault' })

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
    route.name === 'FinancePayableAccountingDetail'
    && route.params.id != null
    && route.params.id !== '',
)
</script>

<template>
  <PayablesAccountingDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <PayablesAccountingList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
    :list-filter="listFilter"
  />
</template>
