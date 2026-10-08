<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenu } from '@/stores/menuStore'

const menuStore = useMenu()
const route = useRoute()

/** 与顶栏「当前项目」一致，下发给 /finance 子路由页面 */
const currentNamespaceId = computed(() => menuStore.currentNamespaceId ?? 1)

/** KeepAlive 按财务一级菜单名区分，列表/详情共用同一缓存实例 */
const financePageKey = computed(() => {
  const financeIdx = route.matched.findIndex((r) => r.name === 'Finance')
  const pageRecord = financeIdx >= 0 ? route.matched[financeIdx + 1] : null
  return pageRecord?.name ?? route.path
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive :max="16">
      <component
        v-if="Component"
        :is="Component"
        :key="financePageKey"
        :namespace-id="currentNamespaceId"
      />
    </KeepAlive>
  </RouterView>
</template>
