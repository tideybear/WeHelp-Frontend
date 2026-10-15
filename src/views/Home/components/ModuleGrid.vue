<script setup>
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

defineOptions({ name: 'ModuleGrid' })

const props = defineProps({
  modules: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['module-click'])

// 将模块数组按4个一组拆分
const moduleRows = computed(() => {
  const rows = []
  for (let i = 0; i < props.modules.length; i += 4) {
    rows.push(props.modules.slice(i, i + 4))
  }
  return rows
})

// 获取图标组件
const getIcon = (iconName) => {
  if (!iconName) return ElementPlusIconsVue.FolderOpened
  return ElementPlusIconsVue[iconName] || ElementPlusIconsVue.FolderOpened
}

// 点击模块
function handleClick(module) {
  emit('module-click', module)
}
</script>

<template>
  <div class="module-grid">
    <el-row :gutter="20" align="top" v-for="(row, index) in moduleRows" :key="index">
      <el-col 
        v-for="module in row" 
        :key="module.id"
        :span="6"
      >
        <div class="module-card" @click="handleClick(module)">
          <div class="module-icon">
            <el-icon :size="48">
              <component :is="getIcon(module.meta?.icon)" />
            </el-icon>
          </div>
          <div class="module-info">
            <h3>{{ module.meta?.title }}</h3>
            <p>{{ module.remark }}</p>
          </div>
          <div v-if="module.children?.length > 0" class="has-children">
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.module-card {
  background: #fff;
  border-radius: 12px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
  position: relative;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    border-color: #409eff;
  }

  .module-icon {
    width: 72px;
    height: 72px;
    margin: 0 auto 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #019899 0%, #017a7d 100%);
    border-radius: 18px;
    color: #fff;
  }

  .module-info {
    h3 {
      font-size: 18px;
      color: #303133;
      margin-bottom: 6px;
    }

    p {
      font-size: 14px;
      color: #909399;
    }
  }

  .has-children {
    position: absolute;
    right: 10px;
    top: 10px;
    color: #909399;
  }
}
</style>
