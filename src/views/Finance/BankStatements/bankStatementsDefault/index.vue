<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BankStatementsList from './List/index.vue'
import BankStatementsDetail from './Detail/index.vue'

defineOptions({ name: 'BankStatementsDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const route = useRoute()

const isDetailRoute = computed(
  () => route.name === 'BankStatementsDetail' && route.params.id != null && route.params.id !== '',
)
</script>

<template>
  <BankStatementsDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <BankStatementsList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
  />
</template>
