<script setup>
import { Expand } from '@element-plus/icons-vue'

defineOptions({
  name: 'ActivityPanel',
})
</script>

<template>
  <div class="activity-section">
    <el-card class="activity-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon><Expand /></el-icon>
            最新动态
          </span>
        </div>
      </template>
      <el-empty description="暂无动态" :image-size="80" />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.activity-section {
  width: 340px;
  flex-shrink: 0;

  .activity-card {
    border-radius: 16px;
    border: none;
    background: #fff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    :deep(.el-card__header) {
      padding: 18px 20px;
      border-bottom: 1px solid #ebeef5;
      background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
      border-radius: 16px 16px 0 0;
    }

    :deep(.el-card__body) {
      padding: 32px 20px;
      min-height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }
  }
}

:deep(.el-empty__description p) {
  font-size: 14px;
  color: #909399;
}
</style>
