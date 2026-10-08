<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ProjectManagerList from './List/index.vue'
import ProjectManagerDetail from './Detail/index.vue'

defineOptions({ name: 'ProjectManagerDefault' })

defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const route = useRoute()

const isDetailRoute = computed(
  () => route.name === 'ProjectDetail' && route.params.id != null && route.params.id !== '',
)
</script>

<template>
  <ProjectManagerDetail v-if="isDetailRoute" :key="String(route.params.id ?? route.fullPath)" />
  <ProjectManagerList
    v-else
    :key="`manager-list-${namespaceId ?? 'none'}`"
    :namespace-id="namespaceId"
  />
</template>
