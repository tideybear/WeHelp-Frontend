<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCrmCustomerProductsAPI,
  createCrmCustomerProductsAPI,
  updateCrmCustomerProductsAPI,
  deleteCrmCustomerProductsAPI,
} from '@/apis/crm'

defineOptions({ name: 'CrmCustomerProducts' })

const props = defineProps({
  /** 客户 ID（crm_customer_products.customer_id） */
  customerId: {
    type: [String, Number],
    default: '',
  },
})

const emit = defineEmits(['refresh'])

const loading = ref(false)
const submitting = ref(false)
const productList = ref([])
const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)

// 需求阶段
const STAGE_OPTIONS = ['询价', '报价', '打样', '下单']
// 币种
const CURRENCY_OPTIONS = [
  { label: '人民币 CNY', value: 'CNY' },
  { label: '美元 USD', value: 'USD' },
  { label: '欧元 EUR', value: 'EUR' },
  { label: '迪拉姆 AED', value: 'AED' },
]
const UNIT_OPTIONS = ['台', '套', '项', '年']

const emptyForm = () => ({
  product_name: '',
  product_category: '',
  spec: '',
  demand_desc: '',
  quantity: undefined,
  unit: '',
  target_price: undefined,
  currency: 'CNY',
  stage: '',
  remark: '',
})

const form = ref(emptyForm())

const rules = {
  product_name: [{ required: true, message: '产品名称不能为空', trigger: 'blur' }],
}

// 单元格取值：空值统一显示 —
function cellText(row, prop) {
  const v = row[prop]
  if (v == null || v === '') return '—'
  return v
}

// 币种展示为中文名
function currencyLabel(value) {
  if (value == null || value === '') return ''
  return CURRENCY_OPTIONS.find((i) => i.value === value)?.label ?? value
}

// 加载产品/需求列表
async function loadProducts() {
  const cid = props.customerId
  if (cid == null || cid === '') {
    productList.value = []
    return
  }

  loading.value = true
  try {
    const res = await getCrmCustomerProductsAPI({ customer_id: Number(cid) })
    const result = res?.result ?? res
    productList.value = result?.list ?? (Array.isArray(result) ? result : [])
  } catch (e) {
    console.error('获取客户需求列表失败:', e)
    productList.value = []
    ElMessage.error('获取客户需求列表失败')
  } finally {
    loading.value = false
  }
}

// 打开新增弹窗
function openCreateDialog() {
  editingId.value = null
  form.value = emptyForm()
  dialogVisible.value = true
}

// 打开编辑弹窗
function openEditDialog(row) {
  editingId.value = row.id
  form.value = {
    product_name: row.product_name ?? '',
    product_category: row.product_category ?? '',
    spec: row.spec ?? '',
    demand_desc: row.demand_desc ?? '',
    quantity: row.quantity === null || row.quantity === undefined ? undefined : Number(row.quantity),
    unit: row.unit ?? '',
    target_price:
      row.target_price === null || row.target_price === undefined
        ? undefined
        : Number(row.target_price),
    currency: row.currency ?? 'CNY',
    stage: row.stage ?? '',
    remark: row.remark ?? '',
  }
  dialogVisible.value = true
}

// 空字符串转 null，避免写入脏数据
function toPayload() {
  const payload = {}
  Object.entries(form.value).forEach(([key, value]) => {
    payload[key] = value === '' ? null : value
  })
  return {
    customer_id: Number(props.customerId),
    ...payload,
  }
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = toPayload()
    const res = editingId.value
      ? await updateCrmCustomerProductsAPI(Number(editingId.value), payload)
      : await createCrmCustomerProductsAPI(payload)

    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '保存失败')
      return
    }

    ElMessage.success(editingId.value ? '更新成功' : '新增成功')
    dialogVisible.value = false
    loadProducts()
    emit('refresh')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    submitting.value = false
  }
}

// 删除产品需求
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.product_name}」吗？`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    const res = await deleteCrmCustomerProductsAPI(Number(row.id))
    if (res && res.success === false) {
      ElMessage.error(res.message || res.msg || '删除失败')
      return
    }
    ElMessage.success('删除成功')
    loadProducts()
    emit('refresh')
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
  }
}

onMounted(loadProducts)

watch(
  () => props.customerId,
  () => loadProducts(),
)
</script>

<template>
  <div class="products-panel">
    <div class="products-header">
      <span class="products-title">客户需求产品明细</span>
      <el-tooltip content="新增产品需求" placement="top">
        <el-button
          type="primary"
          :icon="Plus"
          circle
          aria-label="新增产品需求"
          @click="openCreateDialog"
        />
      </el-tooltip>
    </div>

    <el-table
      v-loading="loading"
      :data="productList"
      border
      stripe
      size="small"
      empty-text="暂无产品需求"
      max-height="360"
    >
      <el-table-column label="产品名称" min-width="180" fixed="left" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="cell-name">{{ row.product_name }}</span>
        </template>
      </el-table-column>

      <el-table-column label="品类" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'product_category') }}</template>
      </el-table-column>

      <el-table-column label="规格" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'spec') }}</template>
      </el-table-column>

      <el-table-column label="数量" min-width="90" align="right">
        <template #default="{ row }">
          <span v-if="cellText(row, 'quantity') !== '—'">
            {{ row.quantity }} {{ row.unit || '' }}
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>

      <el-table-column label="目标价" min-width="130" align="right">
        <template #default="{ row }">
          <span v-if="cellText(row, 'target_price') !== '—'">
            {{ currencyLabel(row.currency) }} {{ row.target_price }}
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>

      <el-table-column label="阶段" min-width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.stage" size="small">{{ row.stage }}</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>

      <el-table-column label="需求描述" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'demand_desc') }}</template>
      </el-table-column>

      <el-table-column label="备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ cellText(row, 'remark') }}</template>
      </el-table-column>

      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑产品需求' : '新增产品需求'"
      width="760px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产品名称" prop="product_name">
              <el-input v-model="form.product_name" clearable placeholder="请输入产品名称" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品品类">
              <el-input v-model="form.product_category" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规格">
              <el-input v-model="form.spec" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="数量">
              <el-input-number v-model="form.quantity" :min="0" :precision="2" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="单位">
              <el-select v-model="form.unit" clearable placeholder="选填" style="width: 100%">
                <el-option v-for="item in UNIT_OPTIONS" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目标价">
              <el-input-number
                v-model="form.target_price"
                :min="0"
                :precision="2"
                :step="1000"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="币种">
              <el-select v-model="form.currency" placeholder="请选择" style="width: 100%">
                <el-option
                  v-for="opt in CURRENCY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="阶段">
              <el-select v-model="form.stage" clearable placeholder="选填" style="width: 100%">
                <el-option v-for="item in STAGE_OPTIONS" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="需求描述">
              <el-input
                v-model="form.demand_desc"
                type="textarea"
                :rows="3"
                placeholder="选填"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="2"
                placeholder="选填"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.products-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.products-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.products-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cell-name {
  font-weight: 500;
}

.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
</style>