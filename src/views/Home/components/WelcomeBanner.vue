<script setup>
import { computed } from 'vue'

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '上午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const dateStr = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
</script>

<template>
  <div class="welcome-banner">
    <div class="banner-content">
      <h1 class="banner-title">欢迎回来</h1>
      <p class="banner-sub">{{ greeting }} · {{ dateStr }}</p>
    </div>
    <div class="banner-decoration">
      <div class="deco-circle deco-1"></div>
      <div class="deco-circle deco-2"></div>
      <div class="deco-circle deco-3"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.welcome-banner {
  position: relative;
  background: linear-gradient(135deg, #019899 0%, #017a7d 50%, #015f60 100%);
  border-radius: 20px;
  padding: 40px 48px;
  margin-bottom: 28px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(1, 152, 153, 0.3);

  .banner-content {
    position: relative;
    z-index: 1;

    .banner-title {
      font-size: 36px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px;
      letter-spacing: 2px;
    }

    .banner-sub {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.85);
      margin: 0;
    }
  }

  .banner-decoration {
    position: absolute;
    right: 0;
    top: 0;
    width: 400px;
    height: 100%;

    .deco-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
    }

    .deco-1 {
      width: 200px;
      height: 200px;
      right: 60px;
      top: -60px;
    }

    .deco-2 {
      width: 150px;
      height: 150px;
      right: 220px;
      top: 30px;
    }

    .deco-3 {
      width: 80px;
      height: 80px;
      right: 100px;
      bottom: -20px;
    }
  }
}
</style>
