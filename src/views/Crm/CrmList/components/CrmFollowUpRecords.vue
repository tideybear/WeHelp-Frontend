<script setup>
import { onMounted, ref, watch } from 'vue'
import { getCrmCustomerFollowUpRecordAPI } from '@/apis/crm'

defineOptions({ name: 'CrmFollowUpRecords' })

const props = defineProps({
  /** 客户 ID（crm_follow_up_records.customer_id） */
  customerId: {
    type: [String, Number],
    default: '',
  },
})

const loading = ref(false)
const recordList = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

async function loadRecords() {
  const cid = props.customerId
  if (cid == null || cid === '') {
    recordList.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const res = await getCrmCustomerFollowUpRecordAPI({
      customer_id: Number(cid),
      page: page.value,
      pageSize: pageSize.value,
    })
    const result = res?.result ?? {}
    recordList.value = result.list ?? []
    total.value = Number(result.total ?? 0)
  } catch (e) {
    console.error('获取跟进记录失败:', e)
    recordList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handlePageChange(val) {
  page.value = val
  loadRecords()
}

function handleSizeChange(val) {
  pageSize.value = val
  page.value = 1
  loadRecords()
}

function refresh() {
  page.value = 1
  loadRecords()
}

function cellText(row, prop) {
  const v = row[prop]
  if (v == null || v === '') return '—'
  return v
}

onMounted(loadRecords)

watch(
  () => props.customerId,
  () => {
    page.value = 1
    loadRecords()
  },
)

defineExpose({ refresh })
</script>

<template>
  <div class="followup-panel">
    <div class="followup-header">
      <span class="followup-title">跟进记录</span>
      <span v-if="total > 0" class="followup-count">共 {{ total }} 条</span>
    </div>

    <el-timeline v-loading="loading" class="followup-timeline">
      <el-timeline-item
        v-for="row in recordList"
        :key="row.id"
        :timestamp="cellText(row, 'follow_up_at')"
        placement="top"
        type="primary"
      >
        <div class="record-card">
          <div class="record-head">
            <el-tag v-if="row.contact_name" size="small" type="info">
              {{ row.contact_name }}
            </el-tag>
            <el-tag v-if="row.follow_up_type_name" size="small">
              {{ row.follow_up_type_name }}
            </el-tag>
            <span v-if="row.owner_name" class="record-owner">{{ row.owner_name }}</span>
          </div>
          <div v-if="row.content" class="record-content">
            {{ row.content }}
          </div>
          <div v-if="row.next_follow_up_at" class="record-next">
            下次跟进：{{ row.next_follow_up_at }}
          </div>
        </div>
      </el-timeline-item>

      <el-empty v-if="!loading && recordList.length === 0" description="暂无跟进记录" :image-size="60" />
    </el-timeline>

    <div v-if="total > pageSize" class="followup-pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="prev, pager, next"
        small
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.followup-panel {
  padding: 16px;
}

.followup-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.followup-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.followup-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.followup-timeline {
  padding-left: 4px;
  max-height: 420px;
  overflow-y: auto;
}

.record-card {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 10px 12px;
}

.record-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.record-owner {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.record-content {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.record-next {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.followup-pagination {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}
</style>