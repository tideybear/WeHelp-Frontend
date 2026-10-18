<script setup>
import { deleteCrmCustomerAPI, getCrmCustomerListAPI } from '@/apis/crm'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useNamespace } from '@/stores/namespaceStore'
import { useMenu } from '@/stores/menuStore'
import PaginationBar from '@/components/PaginationBar.vue'
import CrmCreateCustomerDialog from './components/CrmCreateCustomerDialog.vue'

defineOptions({ name: 'CrmCustomerListPage' })

const router = useRouter()
const namespaceStore = useNamespace()
const menuStore = useMenu()
const createDialogRef = ref()

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
  { prop: 'customer_no', label: '序号', width: 120, align: 'center' },
  { prop: 'company_name', label: '公司名称', minWidth: 180 },
  { prop: 'short_name', label: '简称', width: 100 },
  { prop: 'status_name', label: '客户状态', width: 90, align: 'center' },
  { prop: 'source_name', label: '来源', width: 80, align: 'center' },
  { prop: 'region_name', label: '区域', width: 80 },
  { prop: 'country_name', label: '国家', width: 80 },
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

const filters = ref({
  keyword: '',
  customer_code: '',
  customer_name: '',
  contact_person: '',
})

function buildFilterParams() {
  const out = {}
  for (const [key, val] of Object.entries(filters.value)) {
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s !== '') out[key] = s
  }
  return out
}

const displayList = computed(() =>
  dataList.value.map((row, index) => ({
    ...row,
    index: index + 1,
  })),
)

async function fetchDataList(page = 1, size = 100) {
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
      ...buildFilterParams(),
    }
    console.log('查询参数:', params)
    
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

function handleSearch() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

function handleResetFilters() {
  filters.value = {
    keyword: '',
    customer_code: '',
    customer_name: '',
    contact_person: '',
  }
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
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
    name: 'CrmCustomerDetail',
    params: { id: String(row.id) },
    query: {
      rowData: encodeURIComponent(JSON.stringify(row)),
      ...(namespaceStore.currentNamespaceId != null && namespaceStore.currentNamespaceId !== ''
        ? { namespace_id: String(namespaceStore.currentNamespaceId) }
        : {}),
    },
  })
}

function editRow(index) {
  viewRow(index)
}

async function deleteRow(index) {
  const rowIndex = Number(index)
  if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

  try {
    await ElMessageBox.confirm('确认删除该客户？删除后不可恢复。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    ElMessage.info('已取消删除')
    return
  }

  const currentRow = dataList.value[rowIndex]
  const recordId = currentRow?.id
  if (recordId == null || recordId === '') {
    ElMessage.error('缺少记录 id，无法删除')
    return
  }

  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }

  try {
    const res = await deleteCrmCustomerAPI({
      id: recordId,
      namespace_id: Number(ns),
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除失败')
      return
    }
    ElMessage.success(res?.msg || '删除成功')
    dataList.value.splice(rowIndex, 1)
    total.value = Math.max(0, total.value - 1)
    if (dataList.value.length === 0 && total.value > 0) {
      await fetchDataList(currentPage.value, pageSize.value)
    } else if (dataList.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1
      await fetchDataList(currentPage.value, pageSize.value)
    }
  } catch (e) {
    console.error('删除客户失败:', e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
}

// 新增客户成功后的回调
function handleCreateSuccess() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

onMounted(() => {
  fetchDataList(currentPage.value, pageSize.value)
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    currentPage.value = 1
    fetchDataList(1, pageSize.value)
  },
)
</script>

<template>
  <div class="crm-customer-list-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form class="filter-form" :inline="true" label-width="88px" @submit.prevent="handleSearch">
            <el-form-item label="关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="编码/名称/简称"
                clearable
                class="filter-input-wide"
                :prefix-icon="Search"
              />
            </el-form-item>
            <el-form-item label="客户编码">
              <el-input v-model="filters.customer_code" placeholder="模糊搜索" clearable class="filter-input" />
            </el-form-item>
            <el-form-item label="客户名称">
              <el-input v-model="filters.customer_name" placeholder="模糊搜索" clearable class="filter-input" />
            </el-form-item>
            <el-form-item label="联系人">
              <el-input v-model="filters.contact_person" placeholder="模糊搜索" clearable class="filter-input" />
            </el-form-item>
          </el-form>
          <div class="filter-toolbar">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </div>
          <div class="filter-toolbar-extra">
            <CrmCreateCustomerDialog ref="createDialogRef" @success="handleCreateSuccess" />
          </div>
        </div>
      </div>

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
$toolbar-primary: #409eff;
$toolbar-primary-light-3: #79bbff;
$toolbar-primary-light-5: #a0cfff;
$toolbar-primary-light-7: #c6e2ff;
$toolbar-primary-light-8: #d9ecff;
$toolbar-primary-light-9: #ecf5ff;
$toolbar-primary-dark-2: #337ecc;

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

.page-header {
  margin-bottom: 16px;
}

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
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
}

.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 8px;

  :deep(.el-form-item) {
    margin-bottom: 18px;
    margin-right: 0;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    color: var(--el-text-color-regular);
    padding-right: 8px;
  }
}

.filter-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}

.filter-toolbar-extra {
  flex-shrink: 0;
  margin-left: auto;
  margin-bottom: 18px;
}

.filter-input {
  width: 148px;
}

.filter-input-wide {
  width: 240px;
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

.index-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.form-section-title {
  margin: 4px 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;

  &:not(:first-child) {
    margin-top: 16px;
  }
}

.form-field-full {
  width: 100%;
}

.customer-create-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}
</style>

<style lang="scss">
.customer-create-dialog.el-dialog {
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #79bbff;
  --el-color-primary-light-5: #a0cfff;
  --el-color-primary-light-7: #c6e2ff;
  --el-color-primary-light-8: #d9ecff;
  --el-color-primary-light-9: #ecf5ff;
  --el-color-primary-dark-2: #337ecc;
}
</style>
