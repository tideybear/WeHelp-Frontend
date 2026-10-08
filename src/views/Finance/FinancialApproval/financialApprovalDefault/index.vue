<script setup>
import FinancialApprovalList from './List/index.vue'

defineOptions({ name: 'FinancialApprovalDefault' })

defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})
</script>

<template>
  <FinancialApprovalList :namespace-id="namespaceId" />
</template>
