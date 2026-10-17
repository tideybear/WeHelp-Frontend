<script setup>
import { useNamespace } from '@/stores/namespaceStore'
import customerListDefault from './List/index.vue'

defineOptions({ name: 'CrmCustomerListPage' })

const namespaceStore = useNamespace()
</script>

<template>
  <div class="crm-list-container">
    <customerListDefault :namespace-id="namespaceStore.currentNamespaceId" />
  </div>
</template>

<style scoped>
.crm-list-container {
  padding: 16px;
}
</style>
