<script setup>
import ModuleGrid from './components/ModuleGrid.vue'
import { Fold, Expand } from '@element-plus/icons-vue'

const modules = [
  { id: 1, meta: { icon: 'User', title: '用户管理' }, remark: '管理系统用户' },
  { id: 2, meta: { icon: 'Document', title: '合同管理' }, remark: '合同文档管理' },
  { id: 3, meta: { icon: 'Files', title: '档案管理' }, remark: '企业档案管理' },
  { id: 4, meta: { icon: 'Setting', title: '系统设置' }, remark: '系统配置管理' },
  { id: 5, meta: { icon: 'DataLine', title: '数据分析' }, remark: '数据统计报表' },
  { id: 6, meta: { icon: 'ChatDotRound', title: '消息中心' }, remark: '站内消息通知' },
  { id: 7, meta: { icon: 'Briefcase', title: '项目管理' }, remark: '项目进度跟踪' },
  { id: 8, meta: { icon: 'PieChart', title: '可视化' }, remark: '数据可视化大屏' },
  { id: 9, meta: { icon: 'Setting', title: '系统设置' }, remark: '系统配置管理' },
  { id: 10, meta: { icon: 'DataLine', title: '数据分析' }, remark: '数据统计报表' },
  { id: 11, meta: { icon: 'ChatDotRound', title: '消息中心' }, remark: '站内消息通知' },
  { id: 12, meta: { icon: 'Briefcase', title: '项目管理' }, remark: '项目进度跟踪' },
  { id: 13, meta: { icon: 'PieChart', title: '可视化' }, remark: '数据可视化大屏' }
]

const greeting = '上午好'
const dateStr = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
</script>

<template>
  <div class="home-container">
    <!-- 欢迎横幅 -->
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

    <!-- 主内容区 -->
    <div class="home-content">
      <!-- 左侧模块列表 -->
      <div class="module-section">
        <div class="section-header">
          <h2 class="section-title">
            <el-icon><Fold /></el-icon>
            功能模块
          </h2>
        </div>
        <ModuleGrid :modules="modules" />
      </div>

      <!-- 右侧动态栏 -->
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
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-container {
  padding: 24px;
  min-height: calc(100vh - 120px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
}

// 欢迎横幅
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

// 主内容区
.home-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.module-section {
  flex: 1;

  .section-header {
    margin-bottom: 16px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      margin: 0;
      padding-bottom: 12px;
      border-bottom: 2px solid #019899;
    }
  }
}

.activity-section {
  width: 340px;
  flex-shrink: 0;

  .activity-card {
    border-radius: 16px;
    border: none;
    background: #fff;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);

    :deep(.el-card__header) {
      padding: 18px 20px;
      border-bottom: 1px solid #f0f2f5;
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
