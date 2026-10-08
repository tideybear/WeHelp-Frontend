<script setup>
import {
  createFinanceReceivableAPI,
  deleteFinanceReceivableAPI,
  getFinanceReceivablesListAPI,
} from '@/apis/financeReceivables'
import { getProjectListAPI } from '@/apis/project'
import { getCustomersListAPI } from '@/apis/sales'
import { computed, onBeforeUnmount, onMounted, reactive, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import CopyableCell from '@/components/CopyableCell.vue'
import FinanceListExpandTrigger from '@/components/FinanceListExpandTrigger.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ListActions from '@/components/ListActions.vue'
import FinanceProductItemsEditor from '@/components/FinanceProductItemsEditor.vue'
import FinancePaymentRecordsEditor from '@/components/FinancePaymentRecordsEditor.vue'
import { formatDateOnly } from '@/utils/formatDate'
import { validateItemsForSubmit } from '@/utils/financeProductItems'
import { validatePaymentRecordsForSubmit } from '@/utils/financePaymentRecords'
import { formatCreatePaymentMoney } from '@/utils/financeCreatePaymentStatus'
import { useFinanceCreatePaymentSync } from '@/composables/useFinanceCreatePaymentSync'
import { useFinanceListExpand } from '@/composables/useFinanceListExpand'
import { useFinanceListSummary } from '@/composables/useFinanceListSummary'
import {
  financeListRowClassName,
  financeListRowHasDetails,
  financeListSpanMethod,
  formatFinanceListMoney,
  formatFinanceListQuantity,
  isFinanceListMainRow,
  resolveFinanceListRecord,
  shouldShowFinanceListCell,
} from '@/utils/financeListDisplay'

defineOptions({ name: 'FinanceReceivablesListDefault' })

const props = defineProps({
  namespaceId: {
    type: [Number, String],
    default: undefined,
  },
  /** 由 FinanceReceivables/index 传入的固定列表筛选 */
  listFilter: {
    type: Object,
    default: () => ({}),
  },
})

const router = useRouter()
const userStore = useUserStore()

const RECEIPT_STATUS_OPTIONS = [
  { label: '待收款', value: '待收款' },
  { label: '部分收款', value: '部分收款' },
  { label: '已收清', value: '已收清' },
  { label: '逾期', value: '逾期' },
]

/** 与业务台账表头一致，以上字段必须展示 */
const columns = [
  { prop: 'customer_name', label: '客户', minWidth: 120, showOverflowTooltip: true },
  { prop: 'contract_no', label: '合同编号', minWidth: 120, showOverflowTooltip: true },
  { prop: 'contract_account', label: '合同金额', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'discount_amount', label: '优惠金额', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'product_name', label: '货款名称', minWidth: 140, showOverflowTooltip: true },
  { prop: 'specification', label: '规格', minWidth: 100, showOverflowTooltip: true },
  { prop: 'unit', label: '单位', minWidth: 64, showOverflowTooltip: false },
  { prop: 'quantity', label: '数量', minWidth: 88, align: 'right', showOverflowTooltip: false },
  { prop: 'unit_price', label: '单价', minWidth: 100, align: 'right', showOverflowTooltip: false },
  { prop: 'amount', label: '金额', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'receipt_date', label: '收款日期', minWidth: 110, showOverflowTooltip: false },
  { prop: 'received_amount', label: '实收', minWidth: 110, align: 'right', showOverflowTooltip: false },
  { prop: 'invoice_status', label: '发票情况', minWidth: 96, showOverflowTooltip: false },
]

const listDisplayOptions = {
  paymentDateProp: 'receipt_date',
  paidAmountProp: 'received_amount',
  financeType: 'receivable',
  deriveReceivableInvoiceStatus: true,
}

const MONEY_COLUMN_PROPS = new Set([
  'unit_price',
  'amount',
  'contract_account',
  'discount_amount',
  'received_amount',
])
const DATE_COLUMN_PROPS = new Set(['receipt_date'])

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
  customer_name: '',
  contract_no: '',
  status: '',
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
  const extra = props.listFilter
  if (extra && typeof extra === 'object') {
    for (const [key, val] of Object.entries(extra)) {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        out[key] = val
      } else if (val === 0) {
        out[key] = val
      }
    }
  }
  return out
}

function receiptStatusTagType(val) {
  const s = String(val ?? '').trim()
  if (s === '已收清') return 'success'
  if (s === '部分收款') return 'info'
  if (s === '逾期') return 'danger'
  if (s === '待收款') return 'warning'
  return 'info'
}

function invoiceStatusTagType(val) {
  const s = String(val ?? '').trim()
  if (s === '已开票') return 'success'
  if (s === '部分开票') return 'warning'
  if (s === '已作废') return 'danger'
  return 'info'
}

const { displayList, toggleExpand, isExpanded } = useFinanceListExpand(dataList, listDisplayOptions)
const { summaryMethod } = useFinanceListSummary(dataList, listDisplayOptions)

function onTableRowClick(row, column, event) {
  if (column?.label === '操作') return
  if (event?.target?.closest?.('.order-actions')) return
  if (!isFinanceListMainRow(row) || !financeListRowHasDetails(row)) return
  toggleExpand(row._recordId)
}

async function fetchDataList(page = 1, size = 100) {
  loadingTimer = setTimeout(() => {
    loading.value = true
  }, LOADING_DELAY)
  try {
    const res = await getFinanceReceivablesListAPI(page, size, buildFilterParams())
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '获取应收账款列表失败')
      dataList.value = []
      total.value = 0
      return
    }
    dataList.value = Array.isArray(res.data) ? res.data : []
    total.value = Number(res.total) >= 0 ? Number(res.total) : dataList.value.length
    await nextTick()
    tableRef.value?.setScrollTop?.(0)
    tableRef.value?.doLayout?.()
  } catch (e) {
    console.error('获取应收账款列表失败:', e)
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
    customer_name: '',
    contract_no: '',
    status: '',
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

function viewRow(payload) {
  const row = resolveFinanceListRecord(
    typeof payload === 'object' ? payload : displayList.value[payload],
    dataList.value,
  )
  if (!row?.id) return
  router.push({
    name: 'FinanceReceivableDetail',
    params: { id: String(row.id) },
    query: {
      rowData: encodeURIComponent(JSON.stringify(row)),
      ...(props.namespaceId != null && props.namespaceId !== ''
        ? { namespace_id: String(props.namespaceId) }
        : {}),
    },
  })
}

function editRow(payload) {
  viewRow(payload)
}

async function deleteRow(payload) {
  const currentRow = resolveFinanceListRecord(
    typeof payload === 'object' ? payload : displayList.value[payload],
    dataList.value,
  )
  if (!currentRow) return

  try {
    await ElMessageBox.confirm('确认删除该应收账款？删除后不可恢复。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    ElMessage.info('已取消删除')
    return
  }
  const recordId = currentRow?.id
  if (recordId == null || recordId === '') {
    ElMessage.error('缺少记录 id，无法删除')
    return
  }

  const ns = props.namespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }

  try {
    const res = await deleteFinanceReceivableAPI({
      id: Number(recordId),
      namespace_id: Number(ns),
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '删除失败')
      return
    }
    ElMessage.success(res?.msg || '删除成功')
    const idx = dataList.value.findIndex((r) => Number(r?.id) === Number(recordId))
    if (idx !== -1) {
      dataList.value.splice(idx, 1)
    }
    total.value = Math.max(0, total.value - 1)
    if (dataList.value.length === 0 && total.value > 0) {
      await fetchDataList(currentPage.value, pageSize.value)
    } else if (dataList.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1
      await fetchDataList(currentPage.value, pageSize.value)
    }
  } catch (e) {
    console.error('删除应收账款失败:', e)
    const body = e?.response?.data
    const msg =
      (body && typeof body === 'object' && body.msg) ||
      (typeof body === 'string' ? body : '') ||
      e?.message ||
      '删除失败'
    if (e?.response?.status === 404 && !body?.msg) {
      ElMessage.error('删除接口不存在，请重启后端服务后再试')
      return
    }
    ElMessage.error(msg)
  }
}

const createVisible = ref(false)
const createFormRef = ref()
const createSubmitting = ref(false)
const projectOptions = ref([])
/** v_customers_info，当前空间下客户，供新建时选择客户 */
const customerOptions = ref([])

const productItems = ref([])
const itemsTotalAmount = ref(0)
const paymentRecords = ref([])
const paymentRecordsTotal = ref(0)

const createForm = reactive({
  project_id: undefined,
  customer_name: '',
  contract_no: '',
  contract_account: undefined,
  discount_amount: 0,
  invoice_date: '',
  invoice_no: '',
  invoice_amount: undefined,
  received_amount: 0,
  status: '待收款',
  remark: '',
})

const {
  paymentRecordsAddEnabled,
  paymentRecordsAddHint,
  initPaymentFieldsOnReset,
  applyPaymentSync,
} = useFinanceCreatePaymentSync({
  createForm,
  financeType: 'receivable',
  paymentRecords,
  paymentRecordsTotal,
})

const createRules = {
  customer_name: [
    { required: true, message: '请选择客户', trigger: 'change' },
  ],
}

const createInvoiceFieldsEnabled = computed(
  () => String(createForm.invoice_date ?? '').trim() !== '',
)

function syncCreateInvoiceFields() {
  if (createInvoiceFieldsEnabled.value) return
  createForm.invoice_no = ''
  createForm.invoice_amount = undefined
}

watch(() => createForm.invoice_date, syncCreateInvoiceFields)

async function loadCustomerOptions() {
  const ns = props.namespaceId
  if (ns == null || ns === '') {
    customerOptions.value = []
    return
  }
  try {
    const res = await getCustomersListAPI(1, 500, { namespace_id: Number(ns) })
    if (res?.code !== 200) {
      customerOptions.value = []
      return
    }
    const list = Array.isArray(res.data) ? res.data : []
    customerOptions.value = list
      .map((s) => {
        const name = String(s.customer_name ?? '').trim()
        if (!name) return null
        return {
          id: s.id,
          label: name,
          value: name,
          bank_name: s.bank_name,
          bank_account: s.bank_account,
        }
      })
      .filter(Boolean)
  } catch (e) {
    console.error('加载客户（客户）列表失败:', e)
    customerOptions.value = []
  }
}

function onCustomerSelectChange(customerName) {
  const name = String(customerName ?? '').trim()
  if (!name) return
  const row = customerOptions.value.find((o) => o.value === name)
  if (!row) return
  const first = paymentRecords.value[0]
  if (!first) return
  if (row.bank_name) {
    first.payment_bank = String(row.bank_name).trim()
  }
  if (row.bank_account) {
    first.payment_account = String(row.bank_account).trim()
  }
}

async function loadProjectOptions() {
  const ns = props.namespaceId
  const uid = userStore.userInfo?.id
  if (ns == null || ns === '' || uid == null || uid === '') {
    projectOptions.value = []
    return
  }
  try {
    const res = await getProjectListAPI({ namespace_id: Number(ns), user_id: Number(uid) })
    const list = Array.isArray(res?.data) ? res.data : []
    projectOptions.value = list
      .filter((p) => p?.id != null)
      .map((p) => ({
        label: String(p.project_name ?? p.name ?? p.id).trim() || String(p.id),
        value: Number(p.id),
      }))
    if (projectOptions.value.length === 1) {
      createForm.project_id = projectOptions.value[0].value
    }
  } catch (e) {
    console.error('加载项目列表失败:', e)
    projectOptions.value = []
  }
}

function resetCreateForm() {
  createForm.project_id = projectOptions.value.length === 1 ? projectOptions.value[0].value : undefined
  createForm.customer_name = ''
  createForm.contract_no = ''
  createForm.contract_account = undefined
  createForm.discount_amount = 0
  productItems.value = []
  itemsTotalAmount.value = 0
  paymentRecords.value = []
  paymentRecordsTotal.value = 0
  createForm.invoice_date = ''
  createForm.invoice_no = ''
  createForm.invoice_amount = undefined
  initPaymentFieldsOnReset()
  createForm.remark = ''
  applyPaymentSync()
  createFormRef.value?.resetFields?.()
}

async function openCreateReceivable() {
  const ns = props.namespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }
  await Promise.all([loadProjectOptions(), loadCustomerOptions()])
  resetCreateForm()
  createVisible.value = true
}

async function submitCreateReceivable() {
  await createFormRef.value?.validate?.().catch(() => Promise.reject())

  const ns = props.namespaceId
  if (ns == null || ns === '') {
    ElMessage.warning('请先选择空间')
    return
  }
  const itemCheck = validateItemsForSubmit(productItems.value)
  if (!itemCheck.ok) {
    ElMessage.warning(itemCheck.message)
    return
  }
  const paymentCheck = validatePaymentRecordsForSubmit(paymentRecords.value)
  if (!paymentCheck.ok) {
    ElMessage.warning(paymentCheck.message)
    return
  }

  createSubmitting.value = true
  try {
    const payload = {
      namespace_id: Number(ns),
      customer_name: createForm.customer_name.trim(),
      contract_no: createForm.contract_no.trim() || undefined,
      amount: itemCheck.amount,
      ...(itemCheck.items.length ? { items: itemCheck.items } : {}),
      ...(paymentCheck.payment_records.length
        ? { payment_records: paymentCheck.payment_records }
        : {}),
      ...(createForm.contract_account != null && createForm.contract_account !== ''
        ? { contract_account: createForm.contract_account }
        : {}),
      discount_amount: createForm.discount_amount ?? 0,
      status: createForm.status,
      received_amount: createForm.received_amount ?? 0,
      remark: createForm.remark.trim() || undefined,
    }
    if (createForm.project_id != null && createForm.project_id !== '') {
      payload.project_id = Number(createForm.project_id)
    }
    if (createInvoiceFieldsEnabled.value) {
      payload.invoice_date = createForm.invoice_date
      payload.invoice_no = createForm.invoice_no.trim() || undefined
      if (createForm.invoice_amount != null && createForm.invoice_amount !== '') {
        payload.invoice_amount = createForm.invoice_amount
      }
    }
    const res = await createFinanceReceivableAPI(payload)
    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '新增失败')
      return
    }
    ElMessage.success('新增成功')
    createVisible.value = false
    currentPage.value = 1
    await fetchDataList(1, pageSize.value)
  } catch (e) {
    console.error('新增应收账款失败:', e)
  } finally {
    createSubmitting.value = false
  }
}

function layoutTable() {
  nextTick(() => {
    tableRef.value?.doLayout?.()
  })
}

onMounted(() => {
  fetchDataList(currentPage.value, pageSize.value)
  layoutTable()
  window.addEventListener('resize', layoutTable)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', layoutTable)
})

watch(displayList, () => layoutTable())

watch(
  () => props.namespaceId,
  () => {
    currentPage.value = 1
    fetchDataList(1, pageSize.value)
  },
)
</script>

<template>
  <div class="receivables-list-page">
    <div class="list-container">
      <div class="filter-container">
        <div class="filter-row">
          <el-form
            class="filter-form"
            :inline="true"
            label-width="76px"
            @submit.prevent="handleSearch"
          >
            <el-form-item label="关键词" class="filter-item-keyword">
              <el-input
                v-model="filters.keyword"
                placeholder="客户 / 合同 / 货款名称"
                clearable
                class="filter-control filter-keyword"
                :prefix-icon="Search"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="客户">
              <el-input
                v-model="filters.customer_name"
                placeholder="模糊搜索"
                clearable
                class="filter-control filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="合同编号">
              <el-input
                v-model="filters.contract_no"
                placeholder="模糊搜索"
                clearable
                class="filter-control filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="收款状态">
              <el-select
                v-model="filters.status"
                placeholder="全部"
                clearable
                class="filter-control filter-select"
              >
                <el-option
                  v-for="opt in RECEIPT_STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item class="filter-form-actions" label-width="0">
              <el-button type="primary" native-type="submit">查询</el-button>
              <el-button @click="handleResetFilters">重置</el-button>
            </el-form-item>
          </el-form>
          <div class="filter-toolbar-extra">
            <el-tooltip content="新增应收账款" placement="top">
              <el-button
                type="primary"
                :icon="Plus"
                circle
                aria-label="新增应收账款"
                @click="openCreateReceivable"
              />
            </el-tooltip>
          </div>
        </div>
      </div>

      <div class="table-container">
        <el-table
          ref="tableRef"
          class="receivables-table"
          :data="displayList"
          :row-class-name="financeListRowClassName"
          :span-method="financeListSpanMethod"
          show-summary
          :summary-method="summaryMethod"
          style="width: 100%"
          height="100%"
          table-layout="fixed"
          border
          v-loading="loading"
          element-loading-text="加载中…"
          @row-click="onTableRowClick"
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
              <template v-if="!shouldShowFinanceListCell(scope.row, col.prop, listDisplayOptions)">
                <span
                  v-if="col.prop === 'customer_name' && scope.row._rowKind === 'item'"
                  class="item-row-label"
                >{{ scope.row._itemIndex }}</span>
                <span
                  v-else-if="col.prop === 'customer_name' && scope.row._rowKind === 'payment'"
                  class="item-row-label"
                >{{ scope.row._paymentIndex }}</span>
              </template>
              <template v-else-if="col.prop === 'customer_name'">
                <FinanceListExpandTrigger
                  :row="scope.row"
                  :expanded="isExpanded(scope.row._recordId)"
                  @toggle="toggleExpand(scope.row._recordId)"
                />
                <CopyableCell
                  :value="scope.row?.customer_name != null && scope.row?.customer_name !== '' ? scope.row.customer_name : ''"
                />
              </template>
              <template v-else-if="col.prop === 'status'">
                <el-tag
                  v-if="scope.row?.status"
                  size="small"
                  :type="receiptStatusTagType(scope.row?.status)"
                  effect="plain"
                >
                  {{ scope.row.status }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'invoice_status'">
                <el-tag
                  v-if="scope.row?.invoice_status"
                  size="small"
                  :type="invoiceStatusTagType(scope.row?.invoice_status)"
                  effect="plain"
                >
                  {{ scope.row.invoice_status }}
                </el-tag>
              </template>
              <template v-else-if="col.prop === 'unit_price'">
                <CopyableCell :value="formatFinanceListQuantity(scope.row?.unit_price)" />
              </template>
              <template v-else-if="MONEY_COLUMN_PROPS.has(col.prop)">
                <CopyableCell :value="formatFinanceListMoney(scope.row?.[col.prop])" />
              </template>
              <template v-else-if="col.prop === 'quantity'">
                <CopyableCell :value="formatFinanceListQuantity(scope.row?.quantity)" />
              </template>
              <template v-else-if="DATE_COLUMN_PROPS.has(col.prop)">
                <CopyableCell :value="formatDateOnly(scope.row?.[col.prop]) || ''" />
              </template>
              <CopyableCell
                v-else
                :value="scope.row?.[col.prop] != null && scope.row?.[col.prop] !== '' ? scope.row[col.prop] : ''"
              />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="120">
            <template #default="scope">
              <ListActions
                v-if="isFinanceListMainRow(scope.row)"
                :row="scope.row"
                :row-index="scope.$index"
                @view="() => viewRow(scope.row)"
                @edit="() => editRow(scope.row)"
                @delete="() => deleteRow(scope.row)"
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
      class="receivables-create-dialog"
      title="新增应收账款"
      width="920px"
      destroy-on-close
      append-to-body
      @closed="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="96px"
        class="receivables-create-form"
        @submit.prevent
      >
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="所属项目">
              <el-select
                v-model="createForm.project_id"
                placeholder="选填"
                filterable
                clearable
                class="form-field-full"
              >
                <el-option
                  v-for="opt in projectOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customer_name">
              <el-select
                v-model="createForm.customer_name"
                filterable
                clearable
                placeholder="请选择客户"
                no-data-text="当前空间暂无客户"
                class="form-field-full"
                @change="onCustomerSelectChange"
              >
                <el-option
                  v-for="opt in customerOptions"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同编号">
              <el-input v-model="createForm.contract_no" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同金额">
              <el-input-number
                v-model="createForm.contract_account"
                :min="0"
                :precision="2"
                :controls="true"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优惠金额">
              <el-input-number
                v-model="createForm.discount_amount"
                :min="0"
                :precision="2"
                :controls="true"
                placeholder="选填，默认 0"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <FinanceProductItemsEditor
          v-model="productItems"
          v-model:total-amount="itemsTotalAmount"
          amount-label="应收金额合计"
          allow-merge
        />

        <div class="form-section-title">开票信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开票日期">
              <el-date-picker
                v-model="createForm.invoice_date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择开票日期"
                clearable
                class="form-field-full"
                @change="syncCreateInvoiceFields"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发票号码">
              <el-input
                v-model="createForm.invoice_no"
                clearable
                :disabled="!createInvoiceFieldsEnabled"
                :placeholder="createInvoiceFieldsEnabled ? '选填' : '请先填写「开票日期」'"
                maxlength="100"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开票金额">
              <el-input-number
                v-model="createForm.invoice_amount"
                :min="0"
                :precision="2"
                :controls="true"
                :disabled="!createInvoiceFieldsEnabled"
                :placeholder="createInvoiceFieldsEnabled ? '选填' : '请先填写「开票日期」'"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">收款信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="收款状态">
              <el-input
                :model-value="createForm.status"
                disabled
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实收金额">
              <el-input
                :model-value="formatCreatePaymentMoney(createForm.received_amount)"
                disabled
                class="form-field-full"
              />
              <span class="create-field-hint">根据收款明细自动合计</span>
            </el-form-item>
          </el-col>
        </el-row>

        <FinancePaymentRecordsEditor
          v-model="paymentRecords"
          v-model:total-amount="paymentRecordsTotal"
          section-title="收款明细"
          amount-label="收款明细合计"
          date-label="收款日期"
          bank-label="收款银行"
          account-label="收款账号/流水"
          :add-disabled="!paymentRecordsAddEnabled"
          :add-disabled-hint="paymentRecordsAddHint"
        />

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
        <el-button type="primary" :loading="createSubmitting" @click="submitCreateReceivable">确定</el-button>
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
/* 与 Layout 一致：顶栏 60px + el-main 上下 padding 各 20px */
$layout-main-padding: 20px;
$layout-viewport-offset: 100px;

.receivables-list-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: calc(100% + #{$layout-main-padding * 2});
  max-width: calc(100% + #{$layout-main-padding * 2});
  margin-left: -$layout-main-padding;
  margin-right: -$layout-main-padding;
  height: calc(100vh - #{$layout-viewport-offset});
  max-height: calc(100vh - #{$layout-viewport-offset});
  min-height: 0;
  overflow: hidden;
  padding: 12px $layout-main-padding 16px;
  background-color: #ffffff;
}

.list-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filter-container {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  margin-bottom: 12px;
  padding: 14px 18px 6px;
  background: linear-gradient(180deg, var(--el-fill-color-blank) 0%, #f8fafc 100%);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
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
  gap: 8px 12px;
}

.filter-form {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 12px;

  :deep(.el-form-item) {
    margin-bottom: 12px;
    margin-right: 0;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    padding-right: 6px;
    line-height: 32px;
  }

  :deep(.filter-control .el-input__wrapper),
  :deep(.filter-control .el-select__wrapper) {
    border-radius: 6px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
    background-color: #fff;
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  :deep(.filter-control .el-input__wrapper:hover),
  :deep(.filter-control .el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px var(--el-border-color-darker) inset;
  }

  :deep(.filter-control .el-input.is-focus .el-input__wrapper),
  :deep(.filter-control .el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  :deep(.filter-keyword .el-input__prefix) {
    color: var(--el-text-color-placeholder);
  }
}

.filter-form-actions {
  :deep(.el-form-item__content) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
  }
}

.filter-toolbar-extra {
  flex-shrink: 0;
  margin-left: auto;
  margin-bottom: 12px;
  padding-left: 4px;
}

.filter-item-keyword {
  flex: 1 1 220px;
  min-width: 200px;
  max-width: 320px;
}

.filter-keyword {
  width: 100%;
}

.filter-input {
  width: 152px;
}

.filter-select {
  width: 132px;
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.receivables-table) {
    width: 100% !important;
    max-width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
  }

  :deep(.receivables-table .el-table__inner-wrapper) {
    width: 100% !important;
    height: 100%;
  }

  :deep(.receivables-table .el-table__header-wrapper),
  :deep(.receivables-table .el-table__body-wrapper) {
    width: 100% !important;
  }

  :deep(.receivables-table .el-table__header-wrapper table),
  :deep(.receivables-table .el-table__body-wrapper table) {
    width: 100% !important;
    table-layout: fixed;
  }

  :deep(.receivables-table .finance-list-row--expandable) {
    cursor: pointer;
  }

  :deep(.receivables-table .finance-list-row--item),
  :deep(.receivables-table .finance-list-row--payment) {
    background-color: var(--el-fill-color-lighter);
  }

  :deep(.receivables-table .finance-list-row--merged td) {
    vertical-align: middle;
  }

  :deep(.receivables-table .finance-list-row--item .el-table__cell:first-child .cell),
  :deep(.receivables-table .finance-list-row--payment .el-table__cell:first-child .cell) {
    padding-left: 20px;
  }

  .item-row-label {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  :deep(.receivables-table .el-table__cell) {
    padding: 8px 0;
  }

  :deep(.receivables-table .el-table__footer-wrapper td) {
    font-weight: 600;
    background-color: var(--el-fill-color-light);
  }

  :deep(.receivables-table .el-table__footer-wrapper .cell) {
    white-space: nowrap;
    font-size: 12px;
  }

  :deep(.receivables-table .cell) {
    padding-left: 8px;
    padding-right: 8px;
    line-height: 1.4;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }
}

.pagination-container {
  flex-shrink: 0;
  width: 100%;
  padding-top: 10px;
  box-sizing: border-box;
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

.create-field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.receivables-create-form {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
}
</style>

<style lang="scss">
.receivables-create-dialog.el-dialog {
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #79bbff;
  --el-color-primary-light-5: #a0cfff;
  --el-color-primary-light-7: #c6e2ff;
  --el-color-primary-light-8: #d9ecff;
  --el-color-primary-light-9: #ecf5ff;
  --el-color-primary-dark-2: #337ecc;
}
</style>
