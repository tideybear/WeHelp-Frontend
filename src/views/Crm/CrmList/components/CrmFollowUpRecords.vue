<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getCrmCustomerFollowUpRecordAPI } from '@/apis/crm'

defineOptions({ name: 'CrmFollowUpRecords' })

const props = defineProps({
  /** 客户 ID（crm_follow_up_records.customer_id） */
  customerId: {
    type: [String, Number],
    default: '',
  },
})

// 首屏完整展示的记录条数，其余在容器内向下滚动查看
const VISIBLE_COUNT = 3
const PAGE_SIZE = 20
// 距离底部多少像素时触发加载下一页
const SCROLL_THRESHOLD = 40

const loading = ref(false)
const recordList = ref([])
const total = ref(0)
const page = ref(1)
const listRef = ref(null)
// 由实际内容高度计算，使前 VISIBLE_COUNT 条完整可见
const maxHeight = ref('')

const hasMore = computed(() => recordList.value.length < total.value)

function cellText(row, prop) {
  const v = row[prop]
  if (v == null || v === '') return '—'
  return v
}

// direction 为这些值时 contact_name 在前、owner_name 在后；其余情况相反
const CONTACT_FIRST_DIRECTIONS = [1, 3]

async function loadRecords(append = false) {
  const cid = props.customerId
  if (cid == null || cid === '') {
    recordList.value = []
    total.value = 0
    return
  }
  if (loading.value) return

  loading.value = true
  try {
    const res = await getCrmCustomerFollowUpRecordAPI({
      customer_id: Number(cid),
      page: append ? page.value + 1 : 1,
      pageSize: PAGE_SIZE,
    })
    const result = res?.result ?? {}
    const list = result.list ?? []
    if (append) {
      // 追加时按 id 去重，避免后端返回重复数据导致 key 冲突
      const exists = new Set(recordList.value.map((i) => i.id))
      recordList.value = recordList.value.concat(list.filter((i) => !exists.has(i.id)))
      page.value += 1
    } else {
      recordList.value = list
      page.value = 1
    }
    total.value = Number(result.total ?? 0)
    console.log(recordList.value)
  } catch (e) {
    console.error('获取跟进记录失败:', e)
    if (!append) {
      recordList.value = []
      total.value = 0
      ElMessage.error('获取跟进记录失败')
    }
  } finally {
    loading.value = false
    await nextTick()
    updateMaxHeight()
  }
}

// 按第 VISIBLE_COUNT 条记录的实际高度设置容器高度，保证首屏恰好展示最新 3 条
function updateMaxHeight() {
  const el = listRef.value
  if (!el) {
    maxHeight.value = ''
    return
  }
  const items = el.querySelectorAll('.el-timeline-item')
  if (items.length <= VISIBLE_COUNT) {
    maxHeight.value = ''
    return
  }
  const target = items[VISIBLE_COUNT - 1]
  const height = target.getBoundingClientRect().bottom - el.getBoundingClientRect().top
  maxHeight.value = `${Math.ceil(height)}px`
}

function handleScroll() {
  const el = listRef.value
  if (!el || !hasMore.value || loading.value) return
  const { scrollTop, clientHeight, scrollHeight } = el
  if (scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD) {
    loadRecords(true)
  }
}

function refresh() {
  loadRecords(false)
}

function handleResize() {
  updateMaxHeight()
}

onMounted(() => {
  loadRecords()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

watch(
  () => props.customerId,
  () => {
    recordList.value = []
    total.value = 0
    maxHeight.value = ''
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

    <div
      ref="listRef"
      class="followup-scroll"
      :style="maxHeight ? { maxHeight } : null"
      @scroll.passive="handleScroll"
    >
      <el-timeline v-loading="loading && recordList.length === 0" class="followup-timeline">
        <el-timeline-item
          v-for="row in recordList"
          :key="row.id"
          :timestamp="cellText(row, 'follow_up_at')"
          placement="top"
          type="primary"
        >
          <div class="record-card">
            <div class="record-head">
              <!-- direction 为 1 或 3 时联系人在前，否则负责人在前 -->
              <template v-if="CONTACT_FIRST_DIRECTIONS.includes(Number(row.direction))">
                <el-tag v-if="row.contact_name" size="small" type="info">
                  {{ row.contact_name }}
                </el-tag>
                <el-tag v-if="row.follow_up_type_name" size="small">
                  {{ row.follow_up_type_name }}
                </el-tag>
                <span v-if="row.owner_name" class="record-owner">{{ row.owner_name }}</span>
              </template>
              <template v-else>
                <span v-if="row.owner_name" class="record-owner">{{ row.owner_name }}</span>
                <el-tag v-if="row.follow_up_type_name" size="small">
                  {{ row.follow_up_type_name }}
                </el-tag>
                <el-tag v-if="row.contact_name" size="small" type="info">
                  {{ row.contact_name }}
                </el-tag>
              </template>
            </div>
            <div v-if="row.content" class="record-content">
              {{ row.content }}
            </div>
            <div v-if="row.next_follow_up_at" class="record-next">
              下次跟进：{{ row.next_follow_up_at }}
            </div>
          </div>
        </el-timeline-item>

        <el-empty
          v-if="!loading && recordList.length === 0"
          description="暂无跟进记录"
          :image-size="60"
        />
      </el-timeline>

      <div v-if="hasMore" class="record-more">
        <el-icon class="is-loading" v-if="loading"><Loading /></el-icon>
        <span v-else>向下滚动查看更多</span>
      </div>
      <div v-else-if="recordList.length > VISIBLE_COUNT" class="record-end">没有更多了</div>
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

.followup-scroll {
  overflow-y: auto;
  // 无 maxHeight 时不限制高度，全部展示
  scrollbar-width: thin;
  transition: max-height 0.2s ease;
}

.followup-timeline {
  padding-left: 4px;
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

.record-more,
.record-end {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>