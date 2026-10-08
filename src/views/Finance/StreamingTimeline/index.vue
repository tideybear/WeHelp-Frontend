<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'
import { useNamespaceViewModule } from '@/composables/useNamespaceViewModule'

defineOptions({ name: 'StreamingTimelinePage' })

const STREAMING_TIMELINE_PACKAGE_NAMES = ['streamingTimelineYiLu', 'streamingTimelineDefault']

const route = useRoute()
const menuStore = useMenu()
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? undefined)

const { currentView, ready, viewInstanceKey } = useNamespaceViewModule({
  packageNames: STREAMING_TIMELINE_PACKAGE_NAMES,
  importPackage: (name) => import(`./${name}/index.vue`),
  importDefault: () => import('./streamingTimelineDefault/index.vue'),
  logLabel: '交易时间线',
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
