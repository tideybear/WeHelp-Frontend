<script setup>
import { useMenu } from '@/stores/menuStore'
import customerListDefault from './List/index.vue'

defineOptions({ name: 'CrmCustomerListPage' })

const menuStore = useMenu()
</script>

<template>
  <div class="crm-list-container">
    <customerListDefault :namespace-id="menuStore.currentNamespaceId" />
  </div>
</template>

<style scoped>
.crm-list-container {
  padding: 16px;
}
</style>
