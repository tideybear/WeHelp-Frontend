<script setup>
import { reactive, ref, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createCrmCustomerAPI } from '@/apis/crm'
import { getUserListAPI } from '@/apis/user'
import { useNamespace } from '@/stores/namespaceStore'
import { useUserStore } from '@/stores/userStore'
import { COMPANY_SIZE_OPTIONS } from '@/views/Crm/CrmFollowUpRecords/components/shared'
import {
  CUSTOMER_STATUS_OPTIONS,
  SOURCE_OPTIONS,
  REGION_OPTIONS,
  COUNTRY_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  FOLLOW_UP_STATUS_OPTIONS,
  YES_NO_OPTIONS,
  CURRENCY_OPTIONS,
} from './shared'

defineOptions({ name: 'CrmCreateCustomerDialog' })

const emit = defineEmits(['success'])

// 获取必要的 store 数据
const namespaceStore = useNamespace()
const userStore = useUserStore()

// 弹窗状态
const dialogVisible = ref(false)
const formRef = ref()
const submitting = ref(false)

// 负责人（销售）下拉选项
const ownerOptions = ref([])

/**
 * 表单初始值。
 * 字段与客户详情页（CrmListDetail.vue）展示的可编辑字段保持一致，
 * 下拉选项也复用详情页同一份 shared.js，避免两处口径不一致。
 */
function createEmptyForm() {
  return {
    company_name: '',
    company_name_en: '',
    short_name: '',
    status: 1,
    source_id: '',
    region_id: '',
    country_id: '',
    city: '',
    is_important: '',
    customer_type_id: '',
    industry_id: '',
    company_size_id: '',
    company_size_min: null,
    company_size_max: null,
    company_revenue: null,
    revenue_currency: 'USD',
    owner_id: '',
    first_cooperation_at: '',
    follow_up_status_id: '',
    first_year_sales_potential: null,
    third_year_sales_potential: null,
    potential_currency: 'USD',
    is_followed_up: '',
    has_visited: '',
    website: '',
    address: '',
    customer_basic_info: '',
    customer_needs: '',
    follow_up_strategy: '',
    background_check: '',
    remark: '',
  }
}

const form = reactive(createEmptyForm())

// 表单验证规则
const rules = {
  company_name: [
    { required: true, message: '请输入公司名称', trigger: 'blur' },
    { min: 1, max: 255, message: '长度在 1～255 个字符', trigger: 'blur' },
  ],
}

// 数值型字段：提交时转成数字，空值转 null
const NUMBER_FIELDS = [
  'status',
  'source_id',
  'region_id',
  'country_id',
  'customer_type_id',
  'industry_id',
  'company_size_id',
  'company_size_min',
  'company_size_max',
  'company_revenue',
  'owner_id',
  'follow_up_status_id',
  'first_year_sales_potential',
  'third_year_sales_potential',
  'is_followed_up',
  'has_visited',
  'is_important',
]

// 日期型字段：提交时只保留 'YYYY-MM-DD'
const DATE_FIELDS = ['first_cooperation_at']

/**
 * 打开新增弹窗
 */
function open() {
  dialogVisible.value = true
}

/**
 * 重置表单
 */
function resetForm() {
  formRef.value?.resetFields?.()
  Object.assign(form, createEmptyForm())
}

// 拉取负责人（销售）下拉选项
async function loadOwnerOptions() {
  const ns = namespaceStore.currentNamespaceId
  if (ns == null || ns === '') {
    ownerOptions.value = []
    return
  }
  try {
    const res = await getUserListAPI({ namespace_id: ns })
    const list = res?.data ?? res?.result?.list ?? []
    ownerOptions.value = (Array.isArray(list) ? list : []).map((item) => ({
      id: Number(item.id),
      name: item.name ?? `用户 ${item.id}`,
    }))
  } catch (e) {
    console.error('获取负责人列表失败:', e)
    ownerOptions.value = []
  }
}

onMounted(() => {
  loadOwnerOptions()
})

/**
 * 提交表单
 */
async function handleSubmit() {
  try {
    await formRef.value?.validate?.()
  } catch {
    return
  }

  // 验证用户和项目空间
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

  submitting.value = true

  try {
    const payload = {
      namespace_id: Number(ns),
    }

    // 文本类字段：空串统一转 null，避免写入空字符串
    const TEXT_FIELDS = [
      'company_name',
      'company_name_en',
      'short_name',
      'city',
      'website',
      'customer_basic_info',
      'customer_needs',
      'follow_up_strategy',
      'remark',
      'address',
      'background_check',
    ]
    TEXT_FIELDS.forEach((field) => {
      const value = form[field]
      payload[field] = value == null ? null : String(value).trim() || null
    })

    // 数值类字段
    NUMBER_FIELDS.forEach((field) => {
      const value = form[field]
      if (value === '' || value == null) {
        payload[field] = null
        return
      }
      const num = Number(value)
      payload[field] = Number.isNaN(num) ? null : num
    })

    // 币种
    payload.revenue_currency = form.revenue_currency || 'USD'
    payload.potential_currency = form.potential_currency || 'USD'

    // 日期类字段
    DATE_FIELDS.forEach((field) => {
      const value = form[field]
      payload[field] = value ? String(value).slice(0, 10) : null
    })

    const res = await createCrmCustomerAPI(payload)

    if (!res?.result?.id) {
      ElMessage.warning(res?.msg || res?.message || '新增失败')
      return
    }

    const customerNo = res?.result?.customer_no
    ElMessage.success(customerNo ? `新增成功，客户编号：${customerNo}` : '新增成功')
    dialogVisible.value = false
    resetForm()
    emit('success')
  } catch (e) {
    console.error('新增客户失败:', e)
    ElMessage.error(e?.response?.data?.message || e?.response?.data?.msg || '新增失败')
  } finally {
    submitting.value = false
  }
}

// 暴露方法给父组件
defineExpose({ open })
</script>

<template>
  <div class="crm-create-customer">
    <!-- 新增按钮 -->
    <el-tooltip content="新增客户" placement="top">
      <el-button
        type="primary"
        :icon="Plus"
        circle
        aria-label="新增客户"
        @click="open"
      />
    </el-tooltip>

    <!-- 新增弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      class="customer-create-dialog"
      title="新增客户"
      width="900px"
      top="6vh"
      destroy-on-close
      append-to-body
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="110px"
        class="customer-create-form"
        @submit.prevent
      >
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="公司名称" prop="company_name">
              <el-input
                v-model="form.company_name"
                clearable
                placeholder="请输入公司名称"
                maxlength="255"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="英文名称">
              <el-input v-model="form.company_name_en" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="简称">
              <el-input v-model="form.short_name" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户状态">
              <el-select v-model="form.status" placeholder="请选择客户状态" class="form-field-full">
                <el-option
                  v-for="opt in CUSTOMER_STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源">
              <el-select v-model="form.source_id" placeholder="请选择来源" clearable class="form-field-full">
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
            <el-form-item label="区域">
              <el-select v-model="form.region_id" placeholder="请选择区域" clearable filterable class="form-field-full">
                <el-option
                  v-for="opt in REGION_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="国家">
              <el-select v-model="form.country_id" placeholder="请选择国家" clearable filterable class="form-field-full">
                <el-option
                  v-for="opt in COUNTRY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市">
              <el-input v-model="form.city" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="重要客户">
              <el-select v-model="form.is_important" placeholder="请选择" clearable class="form-field-full">
                <el-option
                  v-for="opt in YES_NO_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户性质">
              <el-select v-model="form.customer_type_id" placeholder="请选择客户性质" clearable class="form-field-full">
                <el-option
                  v-for="opt in CUSTOMER_TYPE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="行业">
              <el-select v-model="form.industry_id" placeholder="请选择行业" clearable filterable class="form-field-full">
                <el-option
                  v-for="opt in INDUSTRY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="公司规模">
              <el-select v-model="form.company_size_id" placeholder="请选择公司规模" clearable class="form-field-full">
                <el-option
                  v-for="opt in COMPANY_SIZE_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规模下限">
              <el-input-number
                v-model="form.company_size_min"
                :min="0"
                :controls="false"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规模上限">
              <el-input-number
                v-model="form.company_size_max"
                :min="0"
                :controls="false"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">销售与潜力</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="销售额">
              <el-input-number
                v-model="form.company_revenue"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="营收币种">
              <el-select
                v-model="form.revenue_currency"
                placeholder="请选择币种"
                class="form-field-full"
                filterable
                allow-create
                default-first-option
              >
                <el-option
                  v-for="opt in CURRENCY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责人">
              <el-select v-model="form.owner_id" placeholder="请选择负责人" clearable filterable class="form-field-full">
                <el-option
                  v-for="opt in ownerOptions"
                  :key="opt.id"
                  :label="opt.name"
                  :value="opt.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="首次合作">
              <el-date-picker
                v-model="form.first_cooperation_at"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="首年潜力">
              <el-input-number
                v-model="form.first_year_sales_potential"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="三年潜力">
              <el-input-number
                v-model="form.third_year_sales_potential"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="选填"
                class="form-field-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="潜力币种">
              <el-select
                v-model="form.potential_currency"
                placeholder="请选择币种"
                class="form-field-full"
                filterable
                allow-create
                default-first-option
              >
                <el-option
                  v-for="opt in CURRENCY_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="跟进状态">
              <el-select v-model="form.follow_up_status_id" placeholder="请选择跟进状态" clearable class="form-field-full">
                <el-option
                  v-for="opt in FOLLOW_UP_STATUS_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否跟进">
              <el-select v-model="form.is_followed_up" placeholder="请选择" clearable class="form-field-full">
                <el-option
                  v-for="opt in YES_NO_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否来访">
              <el-select v-model="form.has_visited" placeholder="请选择" clearable class="form-field-full">
                <el-option
                  v-for="opt in YES_NO_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">扩展信息</div>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="网址">
              <el-input v-model="form.website" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="地址">
              <el-input v-model="form.address" clearable placeholder="选填" maxlength="500" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="基本信息">
              <el-input
                v-model="form.customer_basic_info"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="选填"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="客户需求">
              <el-input
                v-model="form.customer_needs"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="选填"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="跟进策略">
              <el-input
                v-model="form.follow_up_strategy"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="选填"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="背景调查">
              <el-input
                v-model="form.background_check"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="选填"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="选填"
                maxlength="500"
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
.customer-create-dialog {
  .form-section-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    padding-left: 4px;
    border-left: 3px solid #409eff;
  }

  .form-field-full {
    width: 100%;
  }
}
</style>
