<script setup lang="ts">
import { computed } from 'vue'
import { useMenu } from '@/stores/menuStore'

defineOptions({ name: 'ProjectPage' })

const menuStore = useMenu()

/** 与顶栏「当前项目」一致，下发给 /project 子路由页面 */
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component
      v-if="Component"
      :is="Component"
      :namespace-id="currentNamespaceId"
    />
  </RouterView>
</template>
