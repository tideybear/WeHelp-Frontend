<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { getFinFilterAPI } from '@/apis/fin'
import { useMenu } from '@/stores/menuStore'
import Countup from '@/components/countup.vue'
import { use, graphic } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const menuStore = useMenu()
const timelineItems = ref([])

const INITIAL_VISIBLE_COUNT = 6
const LOAD_BATCH_SIZE = 3
const visibleCount = ref(INITIAL_VISIBLE_COUNT)
const leftTimelineItems = computed(() => timelineItems.value)
const visibleTimelineItems = computed(() => leftTimelineItems.value.slice(0, visibleCount.value))
const noMore = computed(() => visibleCount.value >= leftTimelineItems.value.length)

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 余额：transaction_time 最大的一条的 balance；收入：direction 为「贷」的 amount 之和；支出：direction 为「借」的 amount 之和 */
const timelineSummary = computed(() => {
  const items = timelineItems.value
  if (!items.length) {
    return { balance: 0, incomeTotal: 0, expenseTotal: 0 }
  }

  let latest = items[0]
  let maxTime = parseDateTime(latest.transaction_time).getTime()
  for (let i = 1; i < items.length; i++) {
    const it = items[i]
    const t = parseDateTime(it.transaction_time).getTime()
    if (t >= maxTime) {
      maxTime = t
      latest = it
    }
  }

  let incomeTotal = 0
  let expenseTotal = 0
  for (const it of items) {
    const raw = it.directionRaw == null ? "" : String(it.directionRaw).trim()
    if (raw === "贷") incomeTotal += toNumber(it.amount)
    else if (raw === "借") expenseTotal += toNumber(it.amount)
  }

  return {
    balance: toNumber(latest.balance),
    incomeTotal,
    expenseTotal,
  }
})

const formatDateTime = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
const subtractMonths = (date, months) => {
  const d = new Date(date)
  const originalDay = d.getDate()
  d.setMonth(d.getMonth() - months)
  // 处理月末溢出（比如 3/31 - 1个月 -> 3/03），回退到该月最后一天
  if (d.getDate() !== originalDay) {
    d.setDate(0)
  }
  return d
}

const now = new Date()
const filter_transaction_time_end = ref(formatDateTime(now))
const filter_transaction_time_start = ref(formatDateTime(subtractMonths(now, 12)))

// el-date-picker 绑定值（字符串区间）
const rang_time = ref([filter_transaction_time_start.value, filter_transaction_time_end.value])

const parseDateTime = (s) => {
  if (!s) return new Date()
  // 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DDTHH:mm:ss' (更稳的 Date 解析)
  const isoLike = String(s).trim().replace(' ', 'T')
  const d = new Date(isoLike)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const pickerDefaultValue = computed(() => {
  const [start, end] = rang_time.value || []
  return [parseDateTime(start), parseDateTime(end)]
})

/** 图表横轴粒度：年 / 月 / 日 */
const chartGranularity = ref('day')

const pad2 = (n) => String(n).padStart(2, '0')

const bucketKeyForDate = (d, grain) => {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (grain === 'year') return String(y)
  if (grain === 'month') return `${y}-${pad2(m)}`
  return `${y}-${pad2(m)}-${pad2(day)}`
}

/** 生成筛选区间内、按粒度排列的横轴类目（含无交易为 0 的桶） */
const enumerateBucketKeys = (start, end, grain) => {
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  let a = start.getTime() <= end.getTime() ? start : end
  let b = start.getTime() <= end.getTime() ? end : start
  if (grain === 'year') {
    const keys = []
    for (let y = a.getFullYear(); y <= b.getFullYear(); y++) keys.push(String(y))
    return keys
  }
  if (grain === 'month') {
    const keys = []
    const cur = new Date(a.getFullYear(), a.getMonth(), 1)
    const last = new Date(b.getFullYear(), b.getMonth(), 1)
    while (cur.getTime() <= last.getTime()) {
      keys.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`)
      cur.setMonth(cur.getMonth() + 1)
    }
    return keys
  }
  const keys = []
  const cur = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const last = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  while (cur.getTime() <= last.getTime()) {
    keys.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`)
    cur.setDate(cur.getDate() + 1)
  }
  return keys
}

const timelineChartOption = computed(() => {
  const rt = rang_time.value
  const grain = chartGranularity.value
  if (!Array.isArray(rt) || rt.length !== 2) {
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, left: 'center', data: ['收入', '支出'] },
      grid: { top: '12%', left: '2%', right: '3%', bottom: '12%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: [] },
      yAxis: { type: 'value' },
      color: ['#64d572', '#f25e43'],
      series: [
        { name: '收入', type: 'line', smooth: true, data: [] },
        { name: '支出', type: 'line', smooth: true, data: [] },
      ],
    }
  }
  const [rs, re] = rt
  const rangeStart = parseDateTime(rs)
  const rangeEnd = parseDateTime(re)
  const categories = enumerateBucketKeys(rangeStart, rangeEnd, grain)

  const incomeMap = Object.create(null)
  const expenseMap = Object.create(null)
  for (const it of timelineItems.value) {
    const t = parseDateTime(it.transaction_time)
    if (Number.isNaN(t.getTime())) continue
    const key = bucketKeyForDate(t, grain)
    const raw = it.directionRaw == null ? '' : String(it.directionRaw).trim()
    if (raw === '贷') {
      incomeMap[key] = (incomeMap[key] || 0) + toNumber(it.amount)
    } else if (raw === '借') {
      expenseMap[key] = (expenseMap[key] || 0) + toNumber(it.amount)
    }
  }

  const incomeData = categories.map((k) => incomeMap[k] || 0)
  const expenseData = categories.map((k) => expenseMap[k] || 0)

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, left: 'center', data: ['收入', '支出'] },
    grid: { top: '12%', left: '2%', right: '3%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: categories,
      axisLabel: { rotate: categories.length > 14 ? 28 : 0 },
    },
    yAxis: { type: 'value' },
    color: ['#64d572', '#f25e43'],
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: incomeData,
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(100, 213, 114, 0.45)' },
            { offset: 1, color: 'rgba(100, 213, 114, 0.06)' },
          ]),
        },
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: expenseData,
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(242, 94, 67, 0.45)' },
            { offset: 1, color: 'rgba(242, 94, 67, 0.06)' },
          ]),
        },
      },
    ],
  }
})

const resetTimeRange = () => {
  const end = new Date()
  const start = subtractMonths(end, 3)
  const startStr = formatDateTime(start)
  const endStr = formatDateTime(end)

  filter_transaction_time_start.value = startStr
  filter_transaction_time_end.value = endStr
  rang_time.value = [startStr, endStr]
}

watch(rang_time, (val) => {
  if (Array.isArray(val) && val.length === 2) {
    const [start, end] = val
    if (start) filter_transaction_time_start.value = start
    if (end) filter_transaction_time_end.value = end
  }
})

// 时间范围变化时自动重新取数（防抖，避免选择过程中频繁请求）
let rangeFetchTimer = null
watch(
  rang_time,
  (val) => {
    if (!Array.isArray(val) || val.length !== 2) return
    const [start, end] = val
    if (!start || !end) return

    if (rangeFetchTimer) clearTimeout(rangeFetchTimer)
    rangeFetchTimer = setTimeout(() => {
      fetchTimelineList()
    }, 300)
  },
  { deep: true }
)


const loadMore = () => {
  if (noMore.value) return
  visibleCount.value = Math.min(
    visibleCount.value + LOAD_BATCH_SIZE,
    leftTimelineItems.value.length
  )
}

const fetchTimelineList = async () => {
  if (!menuStore.currentNamespaceId) return
  const transaction_time = filter_transaction_time_start.value + "," + filter_transaction_time_end.value
  try {
    const res = await getFinFilterAPI(menuStore.currentNamespaceId, { transaction_time })
    // 由于 http.js 的响应拦截器会直接 return res.data，
    // 所以这里的 res 结构形如: { code, msg, data: [...] }
    const rows = Array.isArray(res?.data) ? res.data : []

    timelineItems.value = rows.map((row, idx) => {
      const transaction_time_value = row?.transaction_time ?? row?.created_at ?? row?.updated_at
      const rawDirection = row?.direction
      const d = rawDirection == null ? "" : String(rawDirection).trim()
      const mappedDirection = d === "借" ? "转出" : d === "贷" ? "转入" : rawDirection
      const amount =
        d === "借"
          ? (row?.debit_amount ?? 0)
          : (row?.credit_amount ?? 0)
      return {
        id: row?.id ?? idx + 1,
        timestamp: transaction_time_value,
        transaction_time: transaction_time_value,
        abstract_text: row?.abstract_text,
        counterparty_name: row?.counterparty_name,
        directionRaw: d,
        direction: mappedDirection,
        balance: row?.balance,
        amount,
        title: row?.abstract_text || row?.counterparty_name || "交易",
      }
    })

    visibleCount.value = INITIAL_VISIBLE_COUNT
  } catch (e) {
    console.error("fetchTimelineList failed:", e)
    timelineItems.value = []
  }
}

// currentNamespaceId 可能在 onMounted 后异步赋值：watch 保证一旦可用就拉取
watch(
  () => menuStore.currentNamespaceId,
  (pid) => {
    if (pid) fetchTimelineList()
  },
  { immediate: true }
)

onMounted(() => {
  // 兜底：如果 watch 已经 immediate 触发则不会重复执行（fetch 内做了 pid 判空）
  fetchTimelineList()
})
</script>


<template>
  <div class="water-fall">
    <el-row class="water-fall-row">
      <el-col :span="12" class="water-fall-col">
        <span class="label">交易时间线</span>
        <div
          class="timeline-scroll"
          v-infinite-scroll="loadMore"
          :infinite-scroll-disabled="noMore"
          :infinite-scroll-immediate="false"
          :infinite-scroll-distance="12"
        >
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in visibleTimelineItems"
              :key="`${item.id}-${index}`"
              :timestamp="item.transaction_time || item.timestamp"
              placement="top"
            >
              <el-card>
                <el-row align="middle">
                  <el-col :span="18">
                    <h4 class="timeline-title">{{ item.abstract_text || item.title }}</h4>
                    <p class="timeline-content">对方单位名称: {{ item.counterparty_name || "" }}</p>
                    <p class="timeline-content">方向: {{ item.direction || "" }}</p>
                    <p class="timeline-content">金额: {{ item.amount }}</p>
                  </el-col>
                  <el-col :span="6">
                    <p class="timeline-content">余额: {{ item.balance }}</p>
                  </el-col>
                </el-row>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </el-col>
      <el-col :span="12" class="water-fall-col" style="padding-top:1%">
        <el-row>
          <el-col :span="12">
            时间筛选:
            <el-date-picker
              class="timeline-date-picker"
              v-model="rang_time"
              type="datetimerange"
              value-format="YYYY-MM-DD HH:mm:ss"
              :default-value="pickerDefaultValue"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期">
            </el-date-picker>
          </el-col>
          <el-col :span="12">
            <el-button @click="resetTimeRange">重置</el-button>
          </el-col>
        </el-row>
        <el-row :gutter="20" class="mgb20" style="padding-top:2%">
          <el-col :span="8">
            <el-card shadow="hover" body-class="card-body">
              <div class="card-icon bg1" aria-hidden="true">
                <Icon icon="material-symbols:currency-yen" />
              </div>
              <div class="card-content">
                <countup class="card-num color1" :end="timelineSummary.balance" />
                <div class="card-label">余额</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" body-class="card-body">
              <div class="card-icon bg2" aria-hidden="true">
                <Icon icon="material-symbols:currency-yen" />
              </div>
              <div class="card-content">
                <countup class="card-num color2" :end="timelineSummary.incomeTotal" />
                <div class="card-label">收入</div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" body-class="card-body">
              <div class="card-icon bg3" aria-hidden="true">
                <Icon icon="material-symbols:currency-yen" />
              </div>
              <div class="card-content">
                <countup class="card-num color3" :end="timelineSummary.expenseTotal" />
                <div class="card-label">支出</div>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-row style="padding-top: 15%;padding-bottom: 5%;" align="middle">
          周期筛选：
          <el-select v-model="chartGranularity" placeholder="日" style="width:15%">
            <el-option label="年" value="year" />
            <el-option label="月" value="month" />
            <el-option label="日" value="day" />
          </el-select>
        </el-row>
        <el-row>
          <VChart class="chart" :option="timelineChartOption" autoresize />
        </el-row>
      </el-col>
    </el-row>
  </div>
</template>


<style scoped lang="scss">
.water-fall{
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

.water-fall-row {
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 1%;
}

.water-fall-col {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding-right: 1%;
  display: flex;
  flex-direction: column;
}

.timeline-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-top: 8px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.timeline-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.timeline-date-picker {
  width: 80%;
}

/* Element Plus 组件内部实际宽度在 .el-date-editor 上，scoped 下用 deep */
:deep(.timeline-date-picker.el-date-editor) {
  width: 80%;
}

.timeline-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
}

.timeline-content {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 20px;
}

.label {
  color: #909399;
}

:deep(.card-body) {
  display: flex;
  align-items: stretch;
  min-height: 100px;
  padding: 0;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 100px;
  min-height: 100px;
  color: #fff;
}

.card-icon :deep(svg) {
  width: 44px;
  height: 44px;
}

.bg1 {
  background: #2d8cf0;
}

.bg2 {
  background: #64d572;
}

.bg3 {
  background: #f25e43;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 12px 16px;
  text-align: center;
}

.card-num {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}

.card-label {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #909399;
  letter-spacing: 0.02em;
}

.color1 {
  color: #2d8cf0;
}

.color2 {
  color: #64d572;
}

.color3 {
  color: #f25e43;
}

.mgb20 {
  margin-bottom: 20px;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>