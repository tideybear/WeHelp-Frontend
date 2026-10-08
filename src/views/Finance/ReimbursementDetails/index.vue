<script setup>
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'ReimbursementDetailsPage' })

const REIMBURSEMENT_PACKAGE_NAMES = ['reimbursementDetailsYiLu', 'reimbursementDetailsDefault']

const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: REIMBURSEMENT_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./reimbursementDetailsDefault/index.vue'),
  logLabel: '报销明细',
})
</script>

<template>
  <div v-if="ready && currentView" class="reimbursement-details-shell">
    <component
      :is="currentView"
      :key="viewInstanceKey"
      class="reimbursement-details-shell__body"
      :namespace-id="currentNamespaceId"
    />
  </div>
</template>

<style scoped lang="scss">
.reimbursement-details-shell {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.reimbursement-details-shell__body {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
