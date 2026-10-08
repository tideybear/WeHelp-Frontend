<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PrivateAccountTransactionsList from './List/index.vue'
import PrivateAccountTransactionsDetail from './Detail/index.vue'

defineOptions({ name: 'PrivateAccountTransactionsDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const route = useRoute()

const isDetailRoute = computed(
  () =>
    route.name === 'PrivateAccountTransactionsDetail'
    && route.params.id != null
    && route.params.id !== '',
)
</script>

<template>
  <PrivateAccountTransactionsDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <PrivateAccountTransactionsList
    v-else
    :key="`default-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
  />
</template>
