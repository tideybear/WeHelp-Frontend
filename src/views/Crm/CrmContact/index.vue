<script setup>
import {
  getCrmCustomerContactListAPI,
  deleteCrmCustomerContactAPI,
} from '@/apis/crm'
import { computed, onMounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import { useNamespace } from '@/stores/namespaceStore'
import PaginationBar from '@/components/PaginationBar.vue'
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from './components/shared'
import CrmCreateContactDialog from './components/CrmCreateContactDialog.vue'
import CrmEditContactDialog from './components/CrmEditContactDialog.vue'

defineOptions({ name: 'CrmContactListPage' })

const namespaceStore = useNamespace()
const router = useRouter()

// 客户名称可点击跳转到对应客户详情：与 CrmList 列表的跳转方式保持一致
function goCustomerDetail(row) {
  if (row?.customer_id == null || row.customer_id === '') return
  router.push({
    name: 'customerDetail',
    params: { id: String(row.customer_id) },
    query: namespaceStore.currentNamespaceId
      ? { namespace_id: String(namespaceStore.currentNamespaceId) }
      : {},
  })
}

// 空值判定：el-select 清空时回填的是 undefined（不是 ''），统一按「未筛选」处理
function isBlank(v) {
  return v === '' || v === null || v === undefined
}

function toText(v) {
  return isBlank(v) ? '' : String(v).trim().toLowerCase()
}

// 过滤表单默认值，抽成工厂避免重置时漏字段
const emptyFilters = () => ({
  keyword: '',
  customer_name: '',
  name: '',
  mobile: '',
  email: '',
  language: '',
  is_primary: '',
})

const filters = ref(emptyFilters())

function genderLabel(value) {
  return GENDER_OPTIONS.find((i) => i.value === Number(value))?.label || '未知'
}

function formatDate(dateStr) {
  if (isBlank(dateStr)) return '—'
  if (typeof dateStr === 'string' && dateStr.includes('GMT')) {
    // 后端返回 RFC1123：Thu, 01 Oct 2026 09:15:00 GMT
    return dateStr.split(' ').slice(1, 4).join(' ')
  }
  return String(dateStr).split('T')[0]
}

// ===== 新增/编辑弹窗组件引用 =====
const createDialogRef = ref(null)
const editDialogRef = ref(null)

function openCreateDialog() {
  createDialogRef.value?.open()
}

function openEditDialog(row) {
  editDialogRef.value?.open(row)
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除联系人「${row.name}」吗？`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    const res = await deleteCrmCustomerContactAPI(Number(row.id))
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '删除失败')
      return
    }
    ElMessage.success('删除成功')
    fetchDataList()
  } catch (e) {
    console.error('删除联系人失败:', e)
    ElMessage.error('删除失败')
  }
}

// 列配置：slot 决定单元格渲染方式，tooltip 决定是否单行省略 + 悬停显示全量
const columns = [
  { prop: 'name', label: '姓名', width: 110, fixed: 'left', slot: 'name' },
  { prop: 'customer_name', label: '客户名称', minWidth: 200, slot: 'customer', tooltip: true },
  { prop: 'title', label: '职位', width: 110 },
  { prop: 'department', label: '部门', width: 110 },
  { prop: 'gender', label: '性别', width: 70, align: 'center', slot: 'gender' },
  { prop: 'phone', label: '联系电话', width: 160 },
  { prop: 'mobile', label: '手机', width: 160, slot: 'mobile' },
  { prop: 'email', label: '邮箱', minWidth: 190, slot: 'email'},
  { prop: 'wechat', label: '微信', width: 120 },
  { prop: 'whatsapp', label: 'WhatsApp', width: 140 },
  { prop: 'linkedin', label: 'LinkedIn', minWidth: 190, tooltip: true },
  { prop: 'language', label: '沟通语言', width: 110, align: 'center' },
  { prop: 'is_primary', label: '主联系人', width: 90, align: 'center', slot: 'isPrimary' },
  { prop: 'birthday', label: '生日', width: 110, align: 'center', slot: 'date' },
  { prop: 'notes', label: '备注', minWidth: 180, tooltip: true },
  { prop: 'created_at', label: '创建时间', width: 160, align: 'center', slot: 'date' },
]

// 关键词命中的字段（与过滤逻辑保持一致）
const KEYWORD_FIELDS = [
  'name',
  'customer_name',
  'title',
  'department',
  'mobile',
  'phone',
  'email',
  'wechat',
  'notes',
]

const dataList = ref([])
const tableRef = ref()
const currentPage = ref(1)
const pageSize = ref(100)
const loading = ref(false)
const LOADING_DELAY = 150
let loadingTimer = null

// 前端过滤 + 分页：后端一次返回当前空间下全部联系人
const filteredList = computed(() => {
  const f = filters.value
  const kw = toText(f.keyword)
  const name = toText(f.name)
  const mobile = toText(f.mobile)
  const email = toText(f.email)
  const customer = toText(f.customer_name)
  const language = isBlank(f.language) ? '' : f.language
  const isPrimary = isBlank(f.is_primary) ? '' : Number(f.is_primary)

  return dataList.value.filter((row) => {
    if (customer && !toText(row.customer_name).includes(customer)) return false
    if (name && !toText(row.name).includes(name)) return false
    if (mobile && !toText(row.mobile).includes(mobile)) return false
    if (email && !toText(row.email).includes(email)) return false
    if (language && String(row.language ?? '') !== language) return false
    if (isPrimary !== '' && Number(row.is_primary) !== isPrimary) return false
    if (kw) {
      const haystack = KEYWORD_FIELDS.map((key) => toText(row[key])).join(' ')
      if (!haystack.includes(kw)) return false
    }
    return true
  })
})

const total = computed(() => filteredList.value.length)

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
    const res = await getCrmCustomerContactListAPI({ namespace_id: Number(ns) })
    const result = res?.result ?? res
    dataList.value = result?.list ?? result?.data ?? (Array.isArray(result) ? result : [])
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
  } catch (e) {
    console.error('获取客户联系人列表失败:', e)
    dataList.value = []
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
})

watch(
  () => namespaceStore.currentNamespaceId,
  () => {
    currentPage.value = 1
    fetchDataList()
  },
)
</script>

<template>
  <div class="crm-contact-list-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form class="filter-form" label-position="top" @submit.prevent>
            <el-form-item label="关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="姓名/客户/职位/手机/邮箱"
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
            <el-form-item label="姓名">
              <el-input
                v-model="filters.name"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="手机">
              <el-input
                v-model="filters.mobile"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input
                v-model="filters.email"
                placeholder="模糊搜索"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="沟通语言">
              <el-select
                v-model="filters.language"
                placeholder="全部"
                clearable
                filterable
                @change="handleSearch"
              >
                <el-option v-for="item in LANGUAGE_OPTIONS" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <!-- <el-form-item label="主联系人">
              <el-select
                v-model="filters.is_primary"
                placeholder="全部"
                clearable
                @change="handleSearch"
              >
                <el-option label="是" :value="1" />
                <el-option label="否" :value="0" />
              </el-select>
            </el-form-item> -->
          </el-form>
        </div>
        <div class="filter-actions">
          <div class="filter-toolbar">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleResetFilters">重置</el-button>
          </div>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增联系人</el-button>
        </div>
      </div>

      <div class="table-container">
        <el-table
          ref="tableRef"
          class="contact-table"
          :data="displayList"
          style="width: 100%"
          height="100%"
          v-loading="loading"
          element-loading-text="加载中…"
          empty-text="暂无联系人"
        >
          <el-table-column label="序号" width="10" align="center" fixed>
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
            :show-overflow-tooltip="col.tooltip"
          >
            <!-- 姓名：加粗g-->
            <template v-if="col.slot === 'name'" #default="scope">
              <div class="cell-name">
                <span>{{ scope.row.name }}</span>
              </div>
            </template>

            <!-- 所属客户：可能为空（未关联客户的联系人）；有 customer_id 时可跳转详情 -->
            <template v-else-if="col.slot === 'customer'" #default="scope">
              <span
                v-if="scope.row.customer_name && scope.row.customer_id != null && scope.row.customer_id !== ''"
                class="customer-link"
                @click="goCustomerDetail(scope.row)"
              >
                {{ scope.row.customer_name }}
              </span>
              <span v-else :class="{ 'text-muted': isBlank(scope.row.customer_name) }">
                {{ scope.row.customer_name ?? '未关联客户' }}
              </span>
            </template>

            <template v-else-if="col.slot === 'gender'" #default="scope">
              {{ genderLabel(scope.row.gender) }}
            </template>

            <template v-else-if="col.slot === 'contact'" #default="scope">
              <span v-if="scope.row[col.prop]" class="text-link">{{ scope.row[col.prop] }}</span>
              <span v-else class="text-muted">—</span>
            </template>

            <template v-else-if="col.slot === 'isPrimary'" #default="scope">
              <el-tag :type="Number(scope.row.is_primary) === 1 ? 'warning' : 'info'" size="small">
                {{ Number(scope.row.is_primary) === 1 ? '是' : '否' }}
              </el-tag>
            </template>

            <template v-else-if="col.slot === 'date'" #default="scope">
              {{ formatDate(scope.row?.[col.prop]) }}
            </template>

            <template v-else #default="scope">
              {{ scope.row?.[col.prop] ?? '—' }}
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="140">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="openEditDialog(scope.row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
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

    <!-- 新增/编辑联系人弹窗 -->
    <CrmCreateContactDialog ref="createDialogRef" @success="fetchDataList" />
    <CrmEditContactDialog ref="editDialogRef" @success="fetchDataList" />
  </div>
</template>

<style scoped lang="scss">
.crm-contact-list-page {
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

  :deep(.contact-table) {
    width: 100% !important;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
    --el-table-header-bg-color: #fafafa;
    --el-table-header-text-color: #606266;
    --el-table-row-hover-bg-color: #f5f7fa;
  }

  :deep(.contact-table .el-table__inner-wrapper) {
    width: 100%;
  }

  :deep(.contact-table .el-table__header-wrapper th) {
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.contact-table .el-table__body-wrapper) {
    font-size: 13px;
  }

  :deep(.contact-table .el-table__header-wrapper table),
  :deep(.contact-table .el-table__body-wrapper table) {
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

.cell-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

// 空值弱化，避免和真实内容抢注意力
.text-muted {
  color: var(--el-text-color-placeholder);
}

// 手机/邮箱：悬停可快速复制
.text-link {
  color: var(--el-color-primary);
  cursor: text;

  &:hover {
    text-decoration: underline;
  }
}

// 客户名称：可点击跳转客户详情
.customer-link {
  color: var(--el-color-primary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>