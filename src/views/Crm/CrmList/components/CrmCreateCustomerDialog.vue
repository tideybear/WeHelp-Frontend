<script setup>
import { reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createCrmCustomerAPI } from '@/apis/crm'
import { useNamespace } from '@/stores/namespaceStore'
import { useUserStore } from '@/stores/userStore'

defineOptions({ name: 'CrmCreateCustomerDialog' })

const emit = defineEmits(['success'])

// 获取必要的 store 数据
const namespaceStore = useNamespace()
const userStore = useUserStore()

// 弹窗状态
const dialogVisible = ref(false)
const formRef = ref()
const submitting = ref(false)

// 表单数据
const form = reactive({
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

// 表单验证规则
const rules = {
  customer_name: [
    { required: true, message: '请输入客户名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1～100 个字符', trigger: 'blur' },
  ],
}

// 常量选项
const STATUS_OPTIONS = [
  { label: '潜在', value: 1 },
  { label: '跟进中', value: 2 },
  { label: '已合作', value: 3 },
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
  // 重置非表单项
  Object.assign(form, {
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
}

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
      user_id: Number(uid),
      namespace_id: Number(ns),
      customer_name: form.customer_name.trim(),
      short_name: form.short_name.trim(),
      contact_person: form.contact_person.trim(),
      phone: form.phone.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      address: form.address.trim(),
      status: form.status,
      customer_level: form.customer_level,
      source: form.source,
      sales_person: form.sales_person.trim(),
      remark: form.remark.trim(),
    }

    const res = await createCrmCustomerAPI(payload)

    if (res?.code !== 200) {
      ElMessage.warning(res?.msg || '新增失败')
      return
    }

    const code = res?.data?.customer_code
    ElMessage.success(code ? `新增成功，客户编码：${code}` : '新增成功')
    dialogVisible.value = false
    resetForm()
    emit('success')
  } catch (e) {
    console.error('新增客户失败:', e)
    ElMessage.error('新增失败')
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
      width="720px"
      destroy-on-close
      append-to-body
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="96px"
        class="customer-create-form"
        @submit.prevent
      >
        <div class="form-section-title">基本信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customer_name">
              <el-input
                v-model="form.customer_name"
                clearable
                placeholder="请输入客户名称"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="简称">
              <el-input v-model="form.short_name" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" placeholder="请选择状态" class="form-field-full">
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
              <el-select v-model="form.customer_level" placeholder="请选择等级" class="form-field-full">
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
              <el-select v-model="form.source" placeholder="请选择来源" class="form-field-full">
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
              <el-input v-model="form.sales_person" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">联系信息</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contact_person" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.phone" clearable placeholder="选填" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机">
              <el-input v-model="form.mobile" clearable placeholder="选填" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.email" clearable placeholder="选填" maxlength="100" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="form-section-title">地址信息</div>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="省">
              <el-input v-model="form.province" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="市">
              <el-input v-model="form.city" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="区">
              <el-input v-model="form.district" clearable placeholder="选填" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="详细地址">
              <el-input v-model="form.address" clearable placeholder="选填" maxlength="255" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="选填"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
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
