<script setup>
import StreamingTimelineList from './List/index.vue'

defineOptions({ name: 'StreamingTimelineDefault' })

defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})
</script>

<template>
  <StreamingTimelineList />
</template>
