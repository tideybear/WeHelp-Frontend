<script setup>
import { GENDER_OPTIONS, LANGUAGE_OPTIONS } from './shared'

defineOptions({ name: 'CrmContactFormFields' })

// 直接操作传入的 form 对象（父组件持有），避免 v-model 双向绑定的额外样板
const props = defineProps({
  /** 表单数据对象 */
  form: {
    type: Object,
    required: true,
  },
  /** 所属客户下拉选项 */
  customerOptions: {
    type: Array,
    default: () => [],
  },
  /** 客户下拉加载状态 */
  customerOptionsLoading: {
    type: Boolean,
    default: false,
  },
  /** 是否隐藏「所属客户」选择器（客户由外部固定传入时使用） */
  hideCustomer: {
    type: Boolean,
    default: false,
  },
  /** 所属客户是否固定（固定时只读展示名称，不提供切换） */
  customerFixed: {
    type: Boolean,
    default: false,
  },
  /** 固定客户时展示的名称（只读展示，不提供切换） */
  fixedCustomerName: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="form-section-title">基本信息</div>
  <el-row :gutter="16">
    <el-col v-if="!props.hideCustomer" :span="12">
      <el-form-item label="所属客户">
        <!-- 固定客户：只读展示，不允许在弹窗内切换 -->
        <el-input
          v-if="props.customerFixed"
          :model-value="props.fixedCustomerName || '—'"
          disabled
        />
        <el-select
          v-else
          v-model="props.form.customer_id"
          placeholder="选填"
          clearable
          filterable
          :loading="props.customerOptionsLoading"
          style="width: 100%"
        >
          <el-option
            v-for="opt in props.customerOptions"
            :key="opt.id"
            :label="opt.name"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="props.form.name" clearable placeholder="请输入姓名" maxlength="100" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="职位">
        <el-input v-model="props.form.title" clearable placeholder="选填" maxlength="100" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="部门">
        <el-input v-model="props.form.department" clearable placeholder="选填" maxlength="100" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="性别">
        <el-select v-model="props.form.gender" clearable placeholder="请选择" style="width: 100%">
          <el-option
            v-for="opt in GENDER_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="生日">
        <el-date-picker
          v-model="props.form.birthday"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选填"
          style="width: 100%"
        />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="沟通语言">
        <el-select
          v-model="props.form.language"
          clearable
          filterable
          placeholder="选填"
          style="width: 100%"
        >
          <el-option v-for="item in LANGUAGE_OPTIONS" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">联系方式</div>
  <el-row :gutter="16">
    <el-col :span="12">
      <el-form-item label="联系电话">
        <el-input v-model="props.form.phone" clearable placeholder="选填" maxlength="50" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="手机">
        <el-input v-model="props.form.mobile" clearable placeholder="选填" maxlength="50" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="邮箱">
        <el-input v-model="props.form.email" clearable placeholder="选填" maxlength="255" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="微信">
        <el-input v-model="props.form.wechat" clearable placeholder="选填" maxlength="100" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="WhatsApp">
        <el-input v-model="props.form.whatsapp" clearable placeholder="选填" maxlength="50" />
      </el-form-item>
    </el-col>
    <el-col :span="12">
      <el-form-item label="LinkedIn">
        <el-input v-model="props.form.linkedin" clearable placeholder="选填" maxlength="255" />
      </el-form-item>
    </el-col>
  </el-row>

  <div class="form-section-title">其他</div>
  <el-form-item label="主联系人">
    <el-switch v-model="props.form.is_primary" :active-value="1" :inactive-value="0" />
  </el-form-item>
  <el-form-item label="备注">
    <el-input
      v-model="props.form.notes"
      type="textarea"
      :rows="3"
      placeholder="选填"
      show-word-limit
    />
  </el-form-item>
</template>

<style scoped lang="scss">
.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
</style>
