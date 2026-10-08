<script setup>
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'ProjectTaskPage' })

/** view_authorize.component 与目录名一致，按优先级匹配 */
const PROJECT_TASK_PACKAGE_NAMES = ['projectTaskYiLu', 'projectTaskDefault']

const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: PROJECT_TASK_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./projectTaskDefault/index.vue'),
  logLabel: '项目任务',
})
</script>

<template>
  <component
    v-if="ready && currentView"
    :is="currentView"
    :key="viewInstanceKey"
    :namespace-id="currentNamespaceId"
  />
</template>
