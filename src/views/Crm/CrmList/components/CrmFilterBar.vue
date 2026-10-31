<script setup>
import { ref, reactive } from 'vue'
import { Search } from '@element-plus/icons-vue'
import CrmCreateCustomerDialog from './CrmCreateCustomerDialog.vue'
import { REGION_OPTIONS, COUNTRY_OPTIONS } from './shared'

defineOptions({ name: 'CrmFilterBar' })

const emit = defineEmits(['search', 'reset'])

// 过滤表单数据
const filters = reactive({
  keyword: '',
  customer_code: '',
  customer_name: '',
  contact_person: '',
  region_id: '',
  country_id: '',
  is_important: '',
})

/**
 * 获取过滤参数
 */
function buildFilterParams() {
  const out = {}
  for (const [key, val] of Object.entries(filters)) {
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s !== '') out[key] = s
  }
  return out
}

/**
 * 触发表单搜索
 */
function handleSearch() {
  emit('search', buildFilterParams())
}

/**
 * 重置表单
 */
function handleReset() {
  filters.keyword = ''
  filters.customer_code = ''
  filters.customer_name = ''
  filters.contact_person = ''
  filters.region_id = ''
  filters.country_id = ''
  filters.is_important = ''
  emit('reset')
}

// 暴露方法和属性给父组件
defineExpose({
  filters,
  buildFilterParams,
})
</script>

<template>
  <div class="filter-container">
    <div class="filter-row">
      <el-form class="filter-form" :inline="true" label-width="88px">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="编码/名称/简称"
            clearable
            class="filter-input-wide"
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="客户编码">
          <el-input
            v-model="filters.customer_code"
            placeholder="模糊搜索"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input
            v-model="filters.customer_name"
            placeholder="模糊搜索"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input
            v-model="filters.contact_person"
            placeholder="模糊搜索"
            clearable
            class="filter-input"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="区域">
          <el-select
            v-model="filters.region_id"
            placeholder="请选择区域"
            clearable
            filterable
            class="filter-select"
          >
            <el-option
              v-for="opt in REGION_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否重要">
          <el-select
            v-model="filters.is_important"
            placeholder="请选择"
            clearable
            class="filter-select"
          >
            <el-option label="是" :value="1" />
            <el-option label="否" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="国家">
          <el-select
            v-model="filters.country_id"
            placeholder="请选择国家"
            clearable
            filterable
            class="filter-select"
          >
            <el-option
              v-for="opt in COUNTRY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="filter-toolbar">
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
      <div class="filter-toolbar-extra">
        <CrmCreateCustomerDialog @success="emit('reset')" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$toolbar-primary: #409eff;
$toolbar-primary-light-3: #79bbff;
$toolbar-primary-light-5: #a0cfff;
$toolbar-primary-light-7: #c6e2ff;
$toolbar-primary-light-8: #d9ecff;
$toolbar-primary-light-9: #ecf5ff;
$toolbar-primary-dark-2: #337ecc;

.filter-container {
  flex-shrink: 0;
  margin-bottom: 16px;
  padding: 16px 20px 6px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  --el-color-primary: #{$toolbar-primary};
  --el-color-primary-light-3: #{$toolbar-primary-light-3};
  --el-color-primary-light-5: #{$toolbar-primary-light-5};
  --el-color-primary-light-7: #{$toolbar-primary-light-7};
  --el-color-primary-light-8: #{$toolbar-primary-light-8};
  --el-color-primary-light-9: #{$toolbar-primary-light-9};
  --el-color-primary-dark-2: #{$toolbar-primary-dark-2};
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: end;
  gap: 12px 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 16px;
  min-width: 0;

  :deep(.el-form-item) {
    margin-bottom: 12px;
    margin-right: 0;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: #606266;
  }

  :deep(.filter-input) {
    width: 160px;
  }

  :deep(.filter-input-wide) {
    width: 200px;
  }

  :deep(.filter-select) {
    width: 140px;
  }
}

.filter-toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.filter-toolbar-extra {
  display: flex;
  flex-shrink: 0;
}
</style>
