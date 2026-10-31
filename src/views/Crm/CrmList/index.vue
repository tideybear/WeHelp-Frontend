<script setup>
import { getCrmCustomerListAPI } from '@/apis/crm'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNamespace } from '@/stores/namespaceStore'
import PaginationBar from '@/components/PaginationBar.vue'
import CrmFilterBar from './components/CrmFilterBar.vue'

defineOptions({ name: 'CrmCustomerListPage' })

const router = useRouter()
const namespaceStore = useNamespace()
const filterBarRef = ref()

function getStatusTagType(status) {
  switch (status) {
    case 1: return 'info'
    case 2: return 'warning'
    case 3: return 'success'
    case 4: return 'danger'
    case 5: return 'info'
    default: return 'info'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (typeof dateStr === 'string' && dateStr.includes('GMT')) {
    return dateStr.split(' ').slice(1, 4).join(' ')
  }
  return dateStr.split('T')[0]
}

function formatCurrency(val, currency = 'USD') {
  if (!val) return '—'
  const num = Number(val)
  if (isNaN(num)) return '—'
  return `${currency === 'CNY' ? '¥' : '$'}${num.toLocaleString()}`
}

const columns = [
  { prop: 'company_name_en', label: '公司名称（英文）', minWidth: 180 },
  { prop: 'company_name', label: '公司名称', minWidth: 180 },
  { prop: 'short_name', label: '简称', width: 100 },
  { prop: 'status_name', label: '客户状态', width: 90, align: 'center' },
  { prop: 'source_name', label: '来源', width: 80, align: 'center' },
  { prop: 'region_name', label: '区域', width: 80 },
  { prop: 'country_name', label: '国家', width: 80 },
  { prop: 'city', label: '城市', width: 90 },
  { prop: 'is_important', label: '重要客户', width: 90, align: 'center' },
  { prop: 'customer_type_name', label: '客户性质', width: 90 },
  { prop: 'industry_name', label: '行业', width: 100 },
  { prop: 'company_size', label: '公司规模', width: 100, align: 'center' },
  { prop: 'company_revenue', label: '销售额', width: 120, align: 'right' },
  { prop: 'first_cooperation_at', label: '首次合作', width: 110, align: 'center' },
  { prop: 'first_follow_up_date', label: '首次跟进', width: 110, align: 'center' },
  { prop: 'is_followed_up_label', label: '是否跟进', width: 80, align: 'center' },
  { prop: 'next_follow_up_at', label: '下次跟进', width: 130, align: 'center' },
  { prop: 'has_visited_label', label: '是否来访', width: 80, align: 'center' },
  { prop: 'follow_up_status_name', label: '跟进状态', width: 90, align: 'center' },
  { prop: 'first_year_sales_potential', label: '首年潜力', width: 110, align: 'right' },
  { prop: 'third_year_sales_potential', label: '三年潜力', width: 110, align: 'right' },
  { prop: 'customer_basic_info', label: '基本信息', minWidth: 150 },
  { prop: 'customer_needs', label: '客户需求', minWidth: 150 },
  { prop: 'follow_up_strategy', label: '跟进策略', minWidth: 150 },
  { prop: 'owner_name', label: '负责人', width: 90, align: 'center' },
  { prop: 'website', label: '网址', minWidth: 150 },
  { prop: 'remark', label: '备注', minWidth: 120 },
]

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(100)
const total = ref(0)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

const displayList = computed(() =>
  dataList.value.map((row, index) => ({
    ...row,
    index: index + 1,
  })),
)

async function fetchDataList(page = 1, size = 100, filterParams = {}) {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    return
  }

  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)

  try {
    // 构建查询参数
    const params = {
      page,
      page_size: size,
      namespace_id: Number(ns),
      ...filterParams,
    }

    const res = await getCrmCustomerListAPI(params)
    const result = res?.result ?? res
    dataList.value = result?.list ?? result?.data ?? []
    total.value = result?.total ?? result?.count ?? dataList.value.length
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (e) {
    console.error('获取客户列表失败:', e)
    dataList.value = []
    total.value = 0
  } finally {
    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    loading.value = false
  }
}

// 处理搜索
function handleSearch(filterParams) {
  currentPage.value = 1
  fetchDataList(1, pageSize.value, filterParams)
}

// 处理重置
function handleResetFilters() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value, {})
}

function handleSizeChange(val) {
  pageSize.value = val
  currentPage.value = 1
  fetchDataList(1, val)
}

function handleCurrentChange(val) {
  currentPage.value = val
  fetchDataList(val, pageSize.value)
}

function viewRow(index) {
  const row = dataList.value[index]
  if (!row?.id) return
  router.push({
    name: 'customerDetail',
    params: { id: String(row.id) },
    query: namespaceStore.currentNamespaceId
      ? { namespace_id: String(namespaceStore.currentNamespaceId) }
      : {},
  })
}

onMounted(() => {
  fetchDataList(currentPage.value, pageSize.value)
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    currentPage.value = 1
    const filterParams = filterBarRef.value?.buildFilterParams?.() || {}
    fetchDataList(1, pageSize.value, filterParams)
  },
)
</script>

<template>
  <div class="crm-customer-list-page">
    <div class="list-container">
      <CrmFilterBar
        ref="filterBarRef"
        @search="handleSearch"
        @reset="handleResetFilters"
      />

      <div class="table-container">
        <el-table
          ref="tableRef"
          class="customer-table"
          :data="displayList"
          style="width: 100%"
          height="100%"
          table-layout="auto"
          v-loading="loading"
          element-loading-text="加载中…"
        >
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :align="col.align || 'left'"
            :show-overflow-tooltip="true"
          >
            <template v-if="col.prop === 'status_name'" #default="scope">
              <el-tag :type="getStatusTagType(scope.row.status)" size="small">
                {{ scope.row.status_name || '—' }}
              </el-tag>
            </template>
            <template v-else-if="col.prop === 'is_important'" #default="scope">
              <el-tag :type="Number(scope.row?.is_important) === 1 ? 'danger' : 'info'" size="small">
                {{ Number(scope.row?.is_important) === 1 ? '是' : '否' }}
              </el-tag>
            </template>
            <template v-else-if="['is_followed_up_label', 'has_visited_label'].includes(col.prop)" #default="scope">
              <el-tag :type="scope.row?.[col.prop] === '是' ? 'success' : 'info'" size="small">
                {{ scope.row?.[col.prop] || '—' }}
              </el-tag>
            </template>
            <template v-else-if="col.prop === 'company_size'" #default="scope">
              {{ scope.row.company_size_min && scope.row.company_size_max
                ? `${scope.row.company_size_min}-${scope.row.company_size_max}` : '—' }}
            </template>
            <template v-else-if="['company_revenue', 'first_year_sales_potential', 'third_year_sales_potential'].includes(col.prop)" #default="scope">
              {{ formatCurrency(scope.row?.[col.prop], scope.row.revenue_currency || scope.row.potential_currency) }}
            </template>
            <template v-else-if="['first_cooperation_at', 'first_follow_up_date', 'next_follow_up_at'].includes(col.prop)" #default="scope">
              {{ formatDate(scope.row?.[col.prop]) }}
            </template>
            <template v-else #default="scope">
              {{ scope.row?.[col.prop] ?? '—' }}
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="80">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="viewRow(scope.$index)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <PaginationBar
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[50, 100, 200]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.crm-customer-list-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px 20px 20px;
  background-color: #ffffff;
}

.list-container {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  padding: 4px 4px 8px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.customer-table) {
    width: 100% !important;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
    --el-table-header-bg-color: #fafafa;
    --el-table-header-text-color: #606266;
    --el-table-row-hover-bg-color: #f5f7fa;
  }

  :deep(.customer-table .el-table__inner-wrapper) {
    width: 100%;
  }

  :deep(.customer-table .el-table__header-wrapper th) {
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.customer-table .el-table__body-wrapper) {
    font-size: 13px;
  }

  :deep(.customer-table .el-table__header-wrapper table),
  :deep(.customer-table .el-table__body-wrapper table) {
    width: 100% !important;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.el-table__row) {
    transition: background-color 0.2s;
  }

  :deep(.el-button.is-link) {
    font-size: 13px;
    padding: 0 4px;
  }
}

.pagination-container {
  flex-shrink: 0;
  padding-top: 12px;
}
</style>
