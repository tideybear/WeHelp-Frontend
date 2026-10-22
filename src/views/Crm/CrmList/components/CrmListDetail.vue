<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCrmCustomerDetailAPI, updateCrmCustomerAPI, deleteCrmCustomerAPI } from '@/apis/crm'
import CrmCustomerContacts from './CrmCustomerContacts.vue'
import CrmFollowUpRecords from './CrmFollowUpRecords.vue'

defineOptions({ name: 'CrmCustomerDetailDefault' })

const route = useRoute()
const router = useRouter()

const detailLoading = ref(false)
const saving = ref(false)
const detail = ref(null)
const editBufferMap = ref({}) // 存储所有修改的字段

// 是否有未保存的修改
const hasModified = computed(() => Object.keys(editBufferMap.value).length > 0)

const READONLY_FIELDS = ['id', 'created_at', 'updated_at']

const recordId = computed(() => {
  const p = route.params.id
  return p != null && p !== '' ? String(p) : ''
})

async function loadDetail() {
  if (!recordId.value) return
  // 切换客户时清空编辑缓冲区
  editBufferMap.value = {}
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
  // 如果没有修改过，使用原始值初始化
  if (editBufferMap.value[field] === undefined) {
    editBufferMap.value[field] = value ?? ''
  }
}

function cancelEdit(field) {
  delete editBufferMap.value[field]
}

function isEditing(field) {
  return editBufferMap.value[field] !== undefined
}

function getEditBuffer(field) {
  return editBufferMap.value[field] ?? ''
}

function isFieldModified(field) {
  return editBufferMap.value[field] !== undefined
}

// 获取字段值（优先使用编辑缓冲区的值，否则使用原始值）
function getFieldValue(field) {
  if (editBufferMap.value[field] !== undefined) {
    return editBufferMap.value[field]
  }
  return detail.value?.[field]
}

// 保存所有编辑的字段
async function handleSaveAll() {
  if (!recordId.value || !detail.value?.id) return
  const modifiedFields = Object.keys(editBufferMap.value)
  if (modifiedFields.length === 0) {
    ElMessage.info('没有需要保存的修改')
    return
  }
  saving.value = true
  try {
    // 构建更新数据（不包含 id，id 通过 URL 传递）
    const updateData = {}
    modifiedFields.forEach(field => {
      updateData[field] = editBufferMap.value[field]
    })
    const res = await updateCrmCustomerAPI(Number(detail.value.id), updateData)
    if (!res?.result?.id) {
      ElMessage.error('保存失败')
      return
    }
    ElMessage.success('保存成功')
    // 更新原始数据
    modifiedFields.forEach(field => {
      detail.value[field] = editBufferMap.value[field]
    })
    // 清空编辑缓冲区
    editBufferMap.value = {}
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

// 删除客户
async function handleDelete() {
  if (!recordId.value) return
  try {
    await ElMessageBox.confirm('确定要删除该客户吗？此操作不可恢复。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    const res = await deleteCrmCustomerAPI(Number(recordId.value))
    if (!res?.result?.id) {
      ElMessage.error('删除失败')
      return
    }
    ElMessage.success('删除成功')
    router.push({ name: 'customerList' })
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '删除失败')
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
            <el-input v-model="editBufferMap.company_name" size="small" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('company_name', detail.company_name)">{{ getFieldValue('company_name') || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="简称">
          <template v-if="isEditing('short_name')">
            <el-input v-model="editBufferMap.short_name" size="small" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('short_name', detail.short_name)">{{ getFieldValue('short_name') || '—' }}</span>
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
            <el-input v-model="editBufferMap.website" size="small" />
          </template>
          <template v-else>
            <span class="editable" @dblclick="startEdit('website', detail.website)">{{ getFieldValue('website') || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="是否跟进">{{ detail.is_followed_up_label || '—' }}</el-descriptions-item>
        <el-descriptions-item label="是否来访">{{ detail.has_visited_label || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.created_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updated_at || '—' }}</el-descriptions-item>
        <el-descriptions-item label="基本信息" :span="2">
          <template v-if="isEditing('customer_basic_info')">
            <el-input v-model="editBufferMap.customer_basic_info" type="textarea" :rows="3" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('customer_basic_info', detail.customer_basic_info)">{{ getFieldValue('customer_basic_info') || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="客户需求" :span="2">
          <template v-if="isEditing('customer_needs')">
            <el-input v-model="editBufferMap.customer_needs" type="textarea" :rows="3" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('customer_needs', detail.customer_needs)">{{ getFieldValue('customer_needs') || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="跟进策略" :span="2">
          <template v-if="isEditing('follow_up_strategy')">
            <el-input v-model="editBufferMap.follow_up_strategy" type="textarea" :rows="3" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('follow_up_strategy', detail.follow_up_strategy)">{{ getFieldValue('follow_up_strategy') || '—' }}</span>
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          <template v-if="isEditing('remark')">
            <el-input v-model="editBufferMap.remark" type="textarea" :rows="3" />
          </template>
          <template v-else>
            <span class="editable editable-multiline" @dblclick="startEdit('remark', detail.remark)">{{ getFieldValue('remark') || '—' }}</span>
          </template>
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <el-row :gutter="16" class="detail-modules">
      <el-col :span="12">
        <CrmCustomerContacts
          v-if="detail?.id"
          :customer-id="detail.id"
          :namespace-id="route.query.namespace_id"
        />
        <CrmFollowUpRecords
          v-if="detail?.id"
          :customer-id="detail.id"
          @refresh="loadDetail"
        />
      </el-col>
      <el-col :span="12">
        <div class="module-placeholder">背景调查</div>
      </el-col>
    </el-row>

    <!-- 操作按钮区域 -->
    <div class="detail-actions" v-if="detail">
      <el-button type="primary" :loading="saving" @click="handleSaveAll" :disabled="!hasModified">保存</el-button>
      <el-button type="danger" @click="handleDelete">删除</el-button>
    </div>

    <div v-else-if="!detailLoading" class="empty-state">暂无数据</div>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  background: #fff;
  display: flex;
  flex-direction: column;
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
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.detail-modules {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.module-placeholder {
  padding: 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-actions {
  flex-shrink: 0;
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
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
