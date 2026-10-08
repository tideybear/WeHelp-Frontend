<script setup>
defineOptions({ name: 'ProjectList' })

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['open-detail'])

const statusTagType = (status) => {
  if (status === '进行中') return 'success'
  if (status === '未开始') return 'warning'
  if (status === '已结束') return 'info'
  return 'info'
}

const onOpen = (id) => {
  emit('open-detail', id)
}
</script>

<template>
  <div class="project-list" v-loading="loading">
    <el-row v-if="items.length" :gutter="20">
      <el-col
        v-for="item in items"
        :key="item.id"
        :xs="12"
        :sm="8"
        :md="6"
        :lg="6"
        :xl="6"
        class="project-col"
      >
        <el-card
          class="project-card"
          :body-style="{ padding: '0' }"
          shadow="hover"
          role="button"
          tabindex="0"
          @click="onOpen(item.id)"
          @keydown.enter.prevent="onOpen(item.id)"
        >
          <div class="project-card__footer">
            <div class="project-card__main">
              <span class="project-card__title" :title="item.name">{{ item.name }}</span>
              <div
                v-if="item.categoryName || item.projectCode"
                class="project-card__meta"
              >
                <span
                  v-if="item.categoryName"
                  class="project-card__category"
                  :title="item.categoryName"
                >{{ item.categoryName }}</span>
                <span
                  v-if="item.projectCode"
                  class="project-card__code"
                  :title="item.projectCode"
                >{{ item.projectCode }}</span>
              </div>
            </div>
            <el-tag
              class="project-card__status"
              size="small"
              effect="plain"
              :type="statusTagType(item.status)"
              :title="item.status"
            >
              {{ item.status }}
            </el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-else class="project-empty" description="暂无符合条件的项目" />
  </div>
</template>

<style scoped lang="scss">
.project-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 4px 8px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

$project-card-height: 88px;

.project-col {
  margin-bottom: 20px;
  display: flex;
}

.project-card {
  width: 100%;
  height: $project-card-height;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: $project-card-height;
  }
}

.project-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 100%;
  min-height: $project-card-height;
  box-sizing: border-box;
  padding: 12px 14px;
  background: #fff;
}

.project-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.project-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__meta {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
}

.project-card__category {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__code {
  flex-shrink: 0;
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);

  &:first-child {
    margin-left: 0;
  }
}

.project-card__status {
  flex-shrink: 0;
  max-width: 76px;

  :deep(.el-tag__content) {
    display: inline-block;
    max-width: 76px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
}

.project-empty {
  padding: 48px 16px;
}
</style>
