<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ReimbursementDetailsList from './List/index.vue'
import ReimbursementDetailsDetail from './Detail/index.vue'

defineOptions({ name: 'ReimbursementDetailsDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const route = useRoute()

const isDetailRoute = computed(
  () =>
    route.name === 'ReimbursementDetailsDetail' && route.params.id != null && route.params.id !== '',
)
</script>

<template>
  <div class="reimbursement-details-package">
    <ReimbursementDetailsDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
    <ReimbursementDetailsList
      v-else
      :key="`default-list-${namespaceId ?? 'none'}`"
      :namespace-id="namespaceId"
    />
  </div>
</template>

<style scoped lang="scss">
.reimbursement-details-package {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
