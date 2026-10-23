<script setup>
import {
  deleteCrmFollowUpRecordAPI,
  getCrmCustomerFollowUpRecordAPI,
} from '@/apis/crm'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { useNamespace } from '@/stores/namespaceStore'
import PaginationBar from '@/components/PaginationBar.vue'
import {
  isBlank,
  toText,
  optionLabel,
  formatDateTime,
  loadCustomerOptions,
  loadOwnerOptions,
  FOLLOW_UP_TYPE_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  DIRECTION_OPTIONS,
  CHANNEL_OPTIONS,
  PRIORITY_OPTIONS,
} from './components/shared'
import CrmFollowUpRecordDialog from './components/CrmFollowUpRecordDialog.vue'

defineOptions({ name: 'CrmFollowUpRecordListPage' })

const namespaceStore = useNamespace()

// 空值判定：el-select 清空时回填的是 undefined（不是 ''），统一按「未筛选」处理
// 过滤表单默认值，抽成工厂避免重置时漏字段
const emptyFilters = () => ({
  keyword: '',
  customer_name: '',
  contact_name: '',
  follow_up_type_id: '',
  follow_up_status_id: '',
  owner_id: '',
  direction: '',
  channel: '',
})

const filters = ref(emptyFilters())

// 下拉选项（客户 / 跟进人）
const customerOptions = ref([])
const ownerOptions = ref([])

function formatDate(dateStr) {
  return formatDateTime(dateStr)
}

// ===== 新增/编辑弹窗组件引用 =====
const createDialogRef = ref(null)

function openCreateDialog() {
  createDialogRef.value?.open()
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除跟进记录「${row.id}」吗？`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    const res = await deleteCrmFollowUpRecordAPI(Number(row.id))
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '删除失败')
      return
    }
    ElMessage.success('删除成功')
    fetchDataList()
  } catch (e) {
    console.error('删除跟进记录失败:', e)
    ElMessage.error('删除失败')
  }
}

// 列配置：slot 决定单元格渲染方式，tooltip 决定是否单行省略 + 悬停显示全量
const columns = [
  { prop: 'follow_up_at', label: '跟进时间', width: 150, slot: 'date' },
  { prop: 'customer_id', label: '所属客户', minWidth: 180, slot: 'customer' },
  { prop: 'contact_name', label: '对接人', width: 110, slot: 'contact' },
  { prop: 'follow_up_type_name', label: '跟进方式', width: 90, align: 'center', slot: 'type' },
  { prop: 'follow_up_status_id', label: '跟进后状态', width: 100, align: 'center', slot: 'status' },
  { prop: 'owner_name', label: '跟进人', width: 120, slot: 'contact' },
  { prop: 'direction', label: '方向', width: 90, align: 'center', slot: 'direction' },
  { prop: 'channel', label: '渠道', width: 90, align: 'center', slot: 'channel' },
  { prop: 'priority', label: '优先级', width: 80, align: 'center', slot: 'priority' },
  { prop: 'subject', label: '主题', minWidth: 160, tooltip: true },
  { prop: 'content', label: '跟进内容', minWidth: 240, tooltip: true },
  { prop: 'result', label: '跟进结果', minWidth: 200, tooltip: true },
  { prop: 'next_follow_up_at', label: '下次跟进', width: 150, align: 'center', slot: 'date' },
  { prop: 'next_action', label: '下一步动作', minWidth: 160, tooltip: true },
]

// 关键词命中的字段（与过滤逻辑保持一致）
const KEYWORD_FIELDS = ['content', 'result', 'subject', 'next_action', 'contact_name', 'owner_name']

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(50)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

// 前端过滤 + 分页：后端一次返回当前空间下全部跟进记录
const filteredList = computed(() => {
  const f = filters.value
  const kw = toText(f.keyword)
  const customerName = toText(f.customer_name)
  const contactName = toText(f.contact_name)
  const typeId = isBlank(f.follow_up_type_id) ? '' : Number(f.follow_up_type_id)
  const statusId = isBlank(f.follow_up_status_id) ? '' : Number(f.follow_up_status_id)
  const ownerId = isBlank(f.owner_id) ? '' : Number(f.owner_id)
  const direction = isBlank(f.direction) ? '' : Number(f.direction)
  const channel = isBlank(f.channel) ? '' : f.channel

  return dataList.value.filter((row) => {
    if (customerName && !toText(customerNameOf(row)).includes(customerName)) return false
    if (contactName && !toText(row.contact_name).includes(contactName)) return false
    if (typeId !== '' && Number(row.follow_up_type_id) !== typeId) return false
    if (statusId !== '' && Number(row.follow_up_status_id) !== statusId) return false
    if (ownerId !== '' && Number(row.owner_id) !== ownerId) return false
    if (direction !== '' && Number(row.direction) !== direction) return false
    if (channel && toText(row.channel) !== toText(channel)) return false
    if (kw) {
      const haystack = KEYWORD_FIELDS.map((key) => toText(row[key])).join(' ')
      if (!haystack.includes(kw)) return false
    }
    return true
  })
})

const totalFiltered = computed(() => filteredList.value.length)

// 视图 v_crm_follow_up_records 只 join 出 contact_name / follow_up_type_name / owner_name，
// 没有客户名，这里用已加载的客户列表做 id -> 名称 的映射
const customerNameMap = computed(() => {
  const map = new Map()
  customerOptions.value.forEach((item) => map.set(item.id, item.name))
  return map
})

function customerNameOf(row) {
  const cid = row?.customer_id
  if (cid == null || cid === '') return ''
  return customerNameMap.value.get(Number(cid)) || `客户 ${cid}`
}

const displayList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value).map((row, index) => ({
    ...row,
    index: start + index + 1,
  }))
})

async function fetchDataList() {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    return
  }

  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)

  try {
    const res = await getCrmCustomerFollowUpRecordAPI({
      namespace_id: Number(ns),
      page: 1,
      pageSize: 500,
    })
    const result = res?.result ?? res
    dataList.value = result?.list ?? result?.data ?? (Array.isArray(result) ? result : [])
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (e) {
    console.error('获取跟进记录列表失败:', e)
    dataList.value = []
  } finally {
    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    loading.value = false
  }
}

// 加载筛选用的下拉选项
async function loadOptions() {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    customerOptions.value = []
    ownerOptions.value = []
    return
  }
  try {
    customerOptions.value = await loadCustomerOptions(ns)
    ownerOptions.value = await loadOwnerOptions(ns)
  } catch (e) {
    console.error('获取下拉选项失败:', e)
    customerOptions.value = []
    ownerOptions.value = []
  }
}

function handleSearch() {
  currentPage.value = 1
  tableRef.value?.setScrollTop?.(0)
}

function handleResetFilters() {
  filters.value = emptyFilters()
  handleSearch()
}

function handleSizeChange(val) {
  pageSize.value = val
  currentPage.value = 1
}

function handleCurrentChange(val) {
  currentPage.value = val
}

onMounted(() => {
  fetchDataList()
  loadOptions()
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    currentPage.value = 1
    fetchDataList()
    loadOptions()
  },
)
</script>

<template>
  <div class="crm-followup-list-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form class="filter-form" label-position="top" @submit.prevent>
            <el-form-item label="关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="内容/结果/主题/下一步"
                clearable
                :prefix-icon="Search"
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="所属客户">
              <el-input
                v-model="filters.customer_name"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="对接人">
              <el-input
                v-model="filters.contact_name"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="跟进方式">
              <el-select
                v-model="filters.follow_up_type_id"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in FOLLOW_UP_TYPE_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="跟进后状态">
              <el-select
                v-model="filters.follow_up_status_id"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in FOLLOW_UP_STATUS_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="跟进人">
              <el-select
                v-model="filters.owner_id"
                placeholder="全部"
                clearable
                filterable
                @change="handleSearch"
              >
                <el-option
                  v-for="item in ownerOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            
          </el-form>
        </div>
        <div class="filter-actions">
          <div class="filter-toolbar">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </div>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增跟进记录</el-button>
        </div>
      </div>

      <div class="table-container">
        <el-table
          ref="tableRef"
          class="followup-table"
          :data="displayList"
          style="width: 100%"
          height="100%"
          v-loading="loading"
          element-loading-text="加载中…"
          empty-text="暂无跟进记录"
        >
          <el-table-column label="序号" width="60" align="center" fixed>
            <template #default="scope">{{ scope.row.index }}</template>
          </el-table-column>
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            :fixed="col.fixed"
            :align="col.align || 'left'"
            :show-oververflow-tooltip="col.tooltip"
          >
            <!-- 跟进时间 / 下次跟进 -->
            <template v-if="col.slot === 'date'" #default="scope">
              {{ formatDate(scope.row?.[col.prop]) }}
            </template>

            <!-- 所属客户 -->
            <template v-else-if="col.slot === 'customer'" #default="scope">
              {{ customerNameOf(scope.row) || '—' }}
            </template>

            <!-- 对接人 / 跟进人 -->
            <template v-else-if="col.slot === 'contact'" #default="scope">
                {{ scope.row[col.prop] }}
            </template>

            <!-- 跟进方式：优先用后端 join 出的名称，字典里没有时兜底展示原值 -->
            <template v-else-if="col.slot === 'type'" #default="scope">
              <el-tag size="small">
                {{ scope.row?.follow_up_type_name || optionLabel(FOLLOW_UP_TYPE_OPTIONS, scope.row?.follow_up_type_id) || '—' }}
              </el-tag>
            </template>

            <!-- 跟进后状态 -->
            <template v-else-if="col.slot === 'status'" #default="scope">
              {{ optionLabel(FOLLOW_UP_STATUS_OPTIONS, scope.row?.follow_up_status_id) || '—' }}
            </template>

            <!-- 方向 -->
            <template v-else-if="col.slot === 'direction'" #default="scope">
              {{ optionLabel(DIRECTION_OPTIONS, scope.row?.direction) || '—' }}
            </template>

            <!-- 渠道 -->
            <template v-else-if="col.slot === 'channel'" #default="scope">
              {{ optionLabel(CHANNEL_OPTIONS, scope.row?.channel) || '—' }}
            </template>

            <!-- 优先级 -->
            <template v-else-if="col.slot === 'priority'" #default="scope">
              {{ optionLabel(PRIORITY_OPTIONS, scope.row?.priority) }}
            </template>

            <template v-else #default="scope">
              {{ scope.row?.[col.prop] ?? '—' }}
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="140">
            <template #default="scope">
              <el-button link type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <PaginationBar
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalFiltered"
          :page-sizes="[50, 100, 200]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 新增跟进记录弹窗 -->
    <CrmFollowUpRecordDialog ref="createDialogRef" @success="fetchDataList" />
  </div>
</template>

<style scoped lang="scss">
.crm-followup-list-page {
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

.filter-container {
  flex-shrink: 0;
  margin-bottom: 16px;
  padding: 16px 20px 14px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
}

// 筛选表单：自适应网格平铺，标签在上、控件在下
.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px 16px;

  :deep(.el-form-item) {
    margin-bottom: 0;
    min-width: 0;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    font-size: 13px;
    color: #606266;
    padding-bottom: 2px;
    line-height: 20px;
  }

  // 标签在上时 el-form-item 是 block，控件需撑满网格单元
  :deep(.el-form-item__content) {
    display: block;
  }

  :deep(.el-input),
  :deep(.el-select) {
    width: 100%;
  }
}

// 操作区：左侧查询/重置，右侧新增
.filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.filter-toolbar {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
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

  :deep(.followup-table) {
    width: 100% !important;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
    --el-table-header-bg-color: #fafafa;
    --el-table-header-text-color: #606266;
    --el-table-row-hover-bg-color: #f5f7fa;
  }

  :deep(.followup-table .el-table__inner-wrapper) {
    width: 100%;
  }

  :deep(.followup-table .el-table__header-wrapper th) {
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.followup-table .el-table__body-wrapper) {
    font-size: 13px;
  }
}

.text-link {
  color: var(--el-color-primary);
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.pagination-container {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
</style>
