<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCrmCustomerDetailAPI, updateCrmCustomerAPI } from '@/apis/crm'

defineOptions({ name: 'CrmCustomerDetailDefault' })

const route = useRoute()
const router = useRouter()

const detailLoading = ref(false)
const saving = ref(false)
const detail = ref(null)
const editing = ref(null)
const editBuffer = ref('')

const READONLY_FIELDS = ['id', 'created_at', 'updated_at']

const recordId = computed(() => {
  const p = route.params.id
  return p != null && p !== '' ? String(p) : ''
})

async function loadDetail() {
  if (!recordId.value) return
  detailLoading.value = true
  try {
    const res = await getCrmCustomerDetailAPI(recordId.value)
    if (!res || !res.result) {
      ElMessage.error(res?.message || res?.msg || '加载详情失败')
      return
    }
    detail.value = res.result
  } catch (e) {
    console.error(e)
    ElMessage.error('加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

function goBack() {
  router.push({ name: 'customerList' })
}

function isReadonly(field) {
  return READONLY_FIELDS.includes(field)
}

function startEdit(field, value) {
  if (isReadonly(field)) return
  editing.value = field
  editBuffer.value = value ?? ''
}

function cancelEdit() {
  editing.value = null
  editBuffer.value = ''
}

function isEditing(field) {
  return editing.value === field
}

async function saveField(field) {
  if (!recordId.value || !detail.value?.id) return
  saving.value = true
  try {
    const res = await updateCrmCustomerAPI({
      id: Number(detail.value.id),
      [field]: editBuffer.value,
    })
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || '保存失败')
      return
    }
    ElMessage.success('保存成功')
    detail.value[field] = editBuffer.value
    editing.value = null
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadDetail()
})

watch(() => route.params.id, () => {
  loadDetail()
})
</script>

<template>
  <div class="detail-page" v-loading="detailLoading">
    <div class="detail-header">
      <el-button type="primary" plain size="small" @click="goBack">返回列表</el-button>
      <span class="detail-title">{{ detail?.company_name || detail?.customer_name || '客户详情' }}</span>
    </div>

    <div class="detail-content" v-if="detail">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="客户编号">{{ detail.customer_no || '—' }}</el-descriptions-item>
        <el-descriptions-item label="公司名称">
          <template v-if="isEditing('company_name')">
            <el-input v-model="editBuffer" size="small" @keyup.enter="saveField('company_name')" @blur="cancelEdit" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('company_name', detail.company_name)">{{ detail.company_name || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="简称">
          <template v-if="isEditing('short_name')">
            <el-input v-model="editBuffer" size="small" @keyup.enter="saveField('short_name')" @blur="cancelEdit" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('short_name', detail.short_name)">{{ detail.short_name || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="客户状态">
          <el-tag size="small">{{ detail.status_name || '—' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源">{{ detail.source_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="区域">{{ detail.region_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="国家">{{ detail.country_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="客户性质">{{ detail.customer_type_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="行业">{{ detail.industry_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="公司规模">
          {{ detail.company_size_min && detail.company_size_max ? `${detail.company_size_min}-${detail.company_size_max}` : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="销售额">{{ detail.company_revenue || '—' }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ detail.owner_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="首次合作">{{ detail.first_cooperation_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="首次跟进">{{ detail.first_follow_up_date || '—' }}</el-descriptions-item>
        <el-descriptions-item label="下次跟进">{{ detail.next_follow_up_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="跟进状态">{{ detail.follow_up_status_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="首年潜力">{{ detail.first_year_sales_potential || '—' }}</el-descriptions-item>
        <el-descriptions-item label="三年潜力">{{ detail.third_year_sales_potential || '—' }}</el-descriptions-item>
        <el-descriptions-item label="网址">
          <template v-if="isEditing('website')">
            <el-input v-model="editBuffer" size="small" @keyup.enter="saveField('website')" @blur="cancelEdit" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('website', detail.website)">{{ detail.website || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="是否跟进">{{ detail.is_followed_up_label || '—' }}</el-descriptions-item>
        <el-descriptions-item label="是否来访">{{ detail.has_visited_label || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.created_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updated_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="基本信息" :span="2">
          <template v-if="isEditing('customer_basic_info')">
            <el-input v-model="editBuffer" type="textarea" :rows="3" @blur="saveField('customer_basic_info')" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('customer_basic_info', detail.customer_basic_info)">{{ detail.customer_basic_info || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="客户需求" :span="2">
          <template v-if="isEditing('customer_needs')">
            <el-input v-model="editBuffer" type="textarea" :rows="3" @blur="saveField('customer_needs')" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('customer_needs', detail.customer_needs)">{{ detail.customer_needs || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="跟进策略" :span="2">
          <template v-if="isEditing('follow_up_strategy')">
            <el-input v-model="editBuffer" type="textarea" :rows="3" @blur="saveField('follow_up_strategy')" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('follow_up_strategy', detail.follow_up_strategy)">{{ detail.follow_up_strategy || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          <template v-if="isEditing('remark')">
            <el-input v-model="editBuffer" type="textarea" :rows="3" @blur="saveField('remark')" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('remark', detail.remark)">{{ detail.remark || '—' }}</span>
          </template>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div v-else-if="!detailLoading" class="empty-state">暂无数据</div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  height: 100%;
  min-height: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  flex-shrink: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.editable {
  cursor: text;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
  display: block;
  min-height: 22px;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.editable-multiline {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
