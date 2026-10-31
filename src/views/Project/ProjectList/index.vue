<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Picture, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createProjectAPI, getProjectListAPI } from '@/apis/project'
import { useNamespace } from '@/stores/namespaceStore'
import { useUserStore } from '@/stores/userStore'
import PaginationBar from '@/components/PaginationBar.vue'

defineOptions({ name: 'ProjectListPage' })

const namespaceStore = useNamespace()
const userStore = useUserStore()

/** 过滤表单数据 */
const filters = reactive({
  keyword: '',
  status: '',
  priority: '',
  project_manager: '',
})

const STATUS_OPTIONS = [
  { label: '未开始', value: '未开始' },
  { label: '进行中', value: '进行中' },
  { label: '已结束', value: '已结束' },
]

const PRIORITY_OPTIONS = [
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' },
]

/** 项目类型名兼容视图里的多种列名 */
function resolveCategoryName(row) {
  return row?.category_name ?? row?.categoryname ?? row?.categoryName ?? '—'
}

/** 项目封面图兼容视图里的多种字段名 */
function resolveCoverUrl(row) {
  return row?.cover_image ?? row?.cover_url ?? row?.cover ?? row?.image_url ?? row?.image ?? row?.project_image ?? ''
}

const dataList = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const loading = ref(false)

/** 新增项目弹窗 */
const createVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref()
const createForm = reactive({ project_name: '' })
const createRules = {
  project_name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
}

const displayList = computed(() =>
  dataList.value.map((row, index) => ({
    ...row,
    index: index + 1,
  })),
)

/**
 * 构建后端 `/project/list` 查询参数
 */
function buildQueryParams(page = 1, size = 50) {
  const ns = namespaceStore.currentNamespaceId
  const uid = userStore.userInfo?.id

  const params = {
    page,
    pageSize: size,
  }
  if (ns != null && ns !== '') params.namespace_id = Number(ns)
  if (uid != null && uid !== '') params.user_id = Number(uid)

  for (const [key, val] of Object.entries(filters)) {
    const s = val === undefined || val === null ? '' : String(val).trim()
    if (s !== '') params[key] = s
  }
  return params
}

async function fetchDataList(page = 1, size = 50) {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    dataList.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const res = await getProjectListAPI(buildQueryParams(page, size))
    const result = res?.result ?? res ?? {}
    const rows = result?.list ?? result?.data ?? []
    dataList.value = Array.isArray(rows) ? rows : []
    total.value = result?.total ?? dataList.value.length
  } catch (e) {
    console.error('获取项目列表失败:', e)
    dataList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/** 查询 */
function handleSearch() {
  currentPage.value = 1
  fetchDataList(1, pageSize.value)
}

/** 重置 */
function handleReset() {
  filters.keyword = ''
  filters.status = ''
  filters.priority = ''
  filters.project_manager = ''
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

function getStatusTagType(status) {
  switch (status) {
    case '进行中': return 'success'
    case '未开始': return 'warning'
    case '已结束': return 'info'
    default: return 'info'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (typeof dateStr === 'string' && dateStr.includes('GMT')) {
    return dateStr.split(' ').slice(1, 4).join(' ')
  }
  return String(dateStr).split('T')[0]
}

/** 打开新增弹窗 */
function openCreateDialog() {
  createForm.project_name = ''
  createVisible.value = true
}

/** 提交新增 */
async function handleCreateSubmit() {
  try {
    await createFormRef.value?.validate?.()
  } catch {
    return
  }

  const uid = userStore.userInfo?.id
  if (uid == null || uid === '') {
    ElMessage.warning('请先登录')
    return
  }

  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }

  createSubmitting.value = true
  try {
    const res = await createProjectAPI({
      user_id: Number(uid),
      namespace_id: Number(ns),
      project_name: createForm.project_name.trim(),
    })

    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '新增失败')
      return
    }

    ElMessage.success('新增成功')
    createVisible.value = false
    fetchDataList(currentPage.value, pageSize.value)
  } catch (e) {
    console.error('新增项目失败:', e)
    ElMessage.error('新增失败')
  } finally {
    createSubmitting.value = false
  }
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
  <div class="project-list-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form class="filter-form" :inline="true" label-width="88px">
            <el-form-item label="关键词">
              <el-input
                v-model="filters.keyword"
                placeholder="名称/编号/负责人"
                clearable
                class="filter-input-wide"
                :prefix-icon="Search"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="项目状态">
              <el-select
                v-model="filters.status"
                placeholder="全部状态"
                clearable
                class="filter-select"
              >
                <el-option
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select
                v-model="filters.priority"
                placeholder="全部优先级"
                clearable
                class="filter-select"
              >
                <el-option
                  v-for="opt in PRIORITY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-input
                v-model="filters.project_manager"
                placeholder="模糊搜索"
                clearable
                class="filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-form>
          <div class="filter-toolbar">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
            <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增</el-button>
          </div>
        </div>
      </div>

      <div class="table-container" v-loading="loading" element-loading-text="加载中…">
        <el-row class="project-grid">
          <el-col
            v-for="row in displayList"
            :key="row.id ?? row.project_code ?? row.index"
            class="project-col"
          >
            <el-card class="project-card" shadow="hover" :body-style="{ padding: '0px' }">
              <el-image
                class="project-card__cover"
                :src="resolveCoverUrl(row)"
                fit="cover"
                lazy
              >
                <template #error>
                  <div class="project-card__placeholder">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div class="project-card__body">
                <el-text class="project-card__title" truncated :title="row.project_name || ''">
                  {{ row.project_name || '—' }}
                </el-text>
                <el-space :size="6" wrap class="project-card__sub">
                  <el-tag v-if="row.priority" type="warning" size="small" effect="plain">
                    {{ row.priority }}
                  </el-tag>
                  <el-tag :type="getStatusTagType(row.status)" size="small" effect="light">
                    {{ row.status || '—' }}
                  </el-tag>
                  <el-tag size="small" type="info" effect="plain">
                    {{ resolveCategoryName(row) }}
                  </el-tag>
                </el-space>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty v-if="!loading && !displayList.length" description="暂无项目" />
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

    <!-- 新增项目弹窗 -->
    <el-dialog
      v-model="createVisible"
      title="新增项目"
      width="480px"
      destroy-on-close
      append-to-body
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="88px"
        @submit.prevent
      >
        <el-form-item label="项目名称" prop="project_name">
          <el-input
            v-model="createForm.project_name"
            clearable
            placeholder="请输入项目名称"
            maxlength="100"
            show-word-limit
            @keyup.enter="handleCreateSubmit"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleCreateSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.project-list-page {
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
  padding: 16px 20px 6px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  padding: 12px 12px 8px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.project-col {
  min-width: 0;
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 !important;
}

.project-card {
  overflow: hidden;
  border-radius: 8px;
}

.project-card__cover {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: block;
  background-color: #f5f7fa;

  :deep(.el-image__inner) {
    width: 100%;
    height: 100%;
  }
}

.project-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: #c0c4cc;
}

.project-card__body {
  padding: 10px 12px 12px;
  font-size: 13px;
  color: #606266;
}

.project-card__title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.project-card__sub {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-container {
  flex-shrink: 0;
  padding-top: 12px;
}
</style>
