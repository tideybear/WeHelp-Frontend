<script setup>
import { createCrmCustomerAPI, deleteCrmCustomerAPI, getCrmCustomerListAPI } from '@/apis/crm'
import { computed, onMounted, reactive, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import CopyableCell from '@/components/CopyableCell.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ListActions from '@/components/ListActions.vue'
import { formatDateTime } from '@/utils/formatDate'
import { useUserStore } from '@/stores/userStore'

defineOptions({ name: 'CrmCustomerListDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
})

const router = useRouter()
const userStore = useUserStore()

const STATUS_OPTIONS = [
  { label: '启用', value: 1 },
  { label: '禁用', value: 0 },
]

const LEVEL_OPTIONS = [
  { label: '普通', value: 1 },
  { label: '重要', value: 2 },
  { label: 'VIP', value: 3 },
]

const SOURCE_OPTIONS = [
  { label: '线上', value: 1 },
  { label: '线下', value: 2 },
  { label: '转介绍', value: 3 },
  { label: '其他', value: 4 },
]

const columns = [
  { prop: 'customer_code', label: '客户编码', minWidth: 120, showOverflowTooltip: true },
  { prop: 'customer_name', label: '客户名称', minWidth: 160, showOverflowTooltip: true },
  { prop: 'short_name', label: '简称', minWidth: 100, showOverflowTooltip: true },
  { prop: 'contact_person', label: '联系人', minWidth: 96, showOverflowTooltip: true },
  { prop: 'phone', label: '联系电话', minWidth: 120, showOverflowTooltip: true },
  { prop: 'mobile', label: '手机', minWidth: 120, showOverflowTooltip: true },
  { prop: 'status', label: '状态', minWidth: 88, showOverflowTooltip: false },
  { prop: 'customer_level', label: '等级', minWidth: 96, showOverflowTooltip: false },
  { prop: 'source', label: '来源', minWidth: 100, showOverflowTooltip: false },
  { prop: 'region', label: '地区', minWidth: 140, showOverflowTooltip: true },
  { prop: 'sales_person', label: '负责销售', minWidth: 100, showOverflowTooltip: true },
  { prop: 'updated_at', label: '更新时间', minWidth: 168, showOverflowTooltip: false },
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
  const ns = props.namespaceId
  if (ns != null && ns !== '') {
    out.namespace_id = Number(ns)
  }
  return out
}

function statusLabel(val) {
  const n = Number(val)
  const hit = STATUS_OPTIONS.find((o) => o.value === n)
  return hit?.label ?? '—'
}

function statusTagType(val) {
  const n = Number(val)
  if (n === 1) return 'success'
  return 'info'
}

function levelLabel(val) {
  const n = Number(val)
  const hit = LEVEL_OPTIONS.find((o) => o.value === n)
  return hit?.label ?? '—'
}

function levelTagType(val) {
  const n = Number(val)
  if (n === 3) return 'warning'
  if (n === 2) return 'success'
  return 'info'
}

function sourceLabel(val) {
  const n = Number(val)
  const hit = SOURCE_OPTIONS.find((o) => o.value === n)
  return hit?.label ?? '—'
}

function sourceTagType(val) {
  const n = Number(val)
  if (n === 1) return ''
  if (n === 2) return 'info'
  if (n === 3) return 'success'
  return 'warning'
}

function formatRegion(row) {
  const parts = [row?.province, row?.city, row?.district].map((x) => String(x ?? '').trim()).filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

const displayList = computed(() =>
  dataList.value.map((row) => ({
    ...row,
    region: formatRegion(row),
  })),
)

async function fetchDataList(page = 1, size = 100) {
  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)
  try {
    const res = await getCrmCustomerListAPI(page, size, buildFilterParams())
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取客户列表失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
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
      ...(props.namespaceId != null && props.namespaceId !== ''
        ? { namespace_id: String(props.namespaceId) }
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

  const ns = props.namespaceId
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

const createVisible = ref(false)
const createFormRef = ref()
const createSubmitting = ref(false)
const createForm = reactive({
  customer_name: '',
  short_name: '',
  contact_person: '',
  phone: '',
  mobile: '',
  email: '',
  province: '',
  city: '',
  district: '',
  address: '',
  status: 1,
  customer_level: 1,
  source: 1,
  sales_person: '',
  remark: '',
})

const createRules = {
  customer_name: [
    { required: true, message: '请输入客户名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1～100 个字符', trigger: 'blur' },
  ],
}

function resetCreateForm() {
  createForm.customer_name = ''
  createForm.short_name = ''
  createForm.contact_person = ''
  createForm.phone = ''
  createForm.mobile = ''
  createForm.email = ''
  createForm.province = ''
  createForm.city = ''
  createForm.district = ''
  createForm.address = ''
  createForm.status = 1
  createForm.customer_level = 1
  createForm.source = 1
  createForm.sales_person = ''
  createForm.remark = ''
  createFormRef.value?.resetFields?.()
}

function openCreateCustomer() {
  resetCreateForm()
  createVisible.value = true
}

async function submitCreateCustomer() {
  await createFormRef.value?.validate?.().catch(() => Promise.reject())
  const uid = userStore.userInfo?.id
  if (uid == null || uid === '') {
    ElMessage.warning('请先登录')
    return
  }
  const ns = props.namespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择项目空间')
    return
  }
  createSubmitting.value = true
  try {
    const payload = {
      user_id: Number(uid),
      namespace_id: Number(ns),
      customer_name: createForm.customer_name.trim(),
      short_name: createForm.short_name.trim(),
      contact_person: createForm.contact_person.trim(),
      phone: createForm.phone.trim(),
      mobile: createForm.mobile.trim(),
      email: createForm.email.trim(),
      province: createForm.province.trim(),
      city: createForm.city.trim(),
      district: createForm.district.trim(),
      address: createForm.address.trim(),
      status: createForm.status,
      customer_level: createForm.customer_level,
      source: createForm.source,
      sales_person: createForm.sales_person.trim(),
      remark: createForm.remark.trim(),
    }
    const res = await createCrmCustomerAPI(payload)
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '新增失败')
      return
    }
    const code = res?.data?.customer_code
    ElMessage.success(code ? `新增成功，客户编码：${code}` : '新增成功')
    createVisible.value = false
    currentPage.value = 1
    await fetchDataList(1, pageSize.value)
  } catch (e) {
    console.error('新增客户失败:', e)
  } finally {
    createSubmitting.value = false
  }
}

onMounted(() => {
  fetchDataList(currentPage.value, pageSize.value)
})

watch(
  () => props.namespaceId,
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
            <el-tooltip content="新增客户" placement="top">
              <el-button
                type="primary"
                :icon="Plus"
                circle
                aria-label="新增客户"
                @click="openCreateCustomer"
              />
            </el-tooltip>
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
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="scope">
              <template v-if="col.prop === 'status'">
                <el-tag size="small" :type="statusTagType(scope.row?.status)" effect="plain">
                  {{ statusLabel(scope.row?.status) }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'customer_level'">
                <el-tag size="small" :type="levelTagType(scope.row?.customer_level)" effect="plain">
                  {{ levelLabel(scope.row?.customer_level) }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'source'">
                <el-tag size="small" :type="sourceTagType(scope.row?.source)" effect="plain">
                  {{ sourceLabel(scope.row?.source) }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'updated_at'">
                <CopyableCell :value="formatDateTime(scope.row?.updated_at) || '—'" />
              </template>
              <CopyableCell v-else :value="scope.row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="scope">
              <ListActions
                :row="scope.row"
                :row-index="scope.$index"
                @view="viewRow"
                @edit="editRow"
                @delete="deleteRow"
                :edit-enabled="true"
                :delete-enabled="true"
              />
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

    <el-dialog
      v-model="createVisible"
      class="customer-create-dialog"
      title="新增客户"
      width="720px"
      destroy-on-close
      append-to-body
      @closed="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="96px"
        class="customer-create-form"
        @submit.prevent
      >
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customer_name">
              <el-input
                v-model="createForm.customer_name"
                clearable
                placeholder="请输入客户名称"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="简称">
              <el-input v-model="createForm.short_name" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="createForm.status" placeholder="请选择状态" class="form-field-full">
                <el-option
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="等级">
              <el-select v-model="createForm.customer_level" placeholder="请选择等级" class="form-field-full">
                <el-option
                  v-for="opt in LEVEL_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户来源">
              <el-select v-model="createForm.source" placeholder="请选择来源" class="form-field-full">
                <el-option
                  v-for="opt in SOURCE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责销售">
              <el-input v-model="createForm.sales_person" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">联系信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="createForm.contact_person" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="createForm.phone" clearable placeholder="选填" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机">
              <el-input v-model="createForm.mobile" clearable placeholder="选填" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="createForm.email" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">地址信息</div>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="省">
              <el-input v-model="createForm.province" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="市">
              <el-input v-model="createForm.city" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区">
              <el-input v-model="createForm.district" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="详细地址">
              <el-input v-model="createForm.address" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="createForm.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="submitCreateCustomer">确定</el-button>
      </template>
    </el-dialog>
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
  }

  :deep(.customer-table .el-table__inner-wrapper) {
    width: 100%;
  }

  :deep(.customer-table .el-table__header-wrapper table),
  :deep(.customer-table .el-table__body-wrapper table) {
    width: 100% !important;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }
}

.pagination-container {
  flex-shrink: 0;
  padding-top: 12px;
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
