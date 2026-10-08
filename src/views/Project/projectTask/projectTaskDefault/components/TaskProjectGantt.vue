<script setup>
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CustomChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([CanvasRenderer, CustomChart, GridComponent, TooltipComponent, DataZoomComponent])

defineOptions({ name: 'TaskProjectGantt' })

const props = defineProps({
  /** 当前选中项目 id；演示数据用其做轻微偏移，便于切换项目时刷新观感 */
  projectId: {
    type: [String, Number],
    default: null,
  },
})

const DAY_MS = 86400000

/** 固定阶段名（演示用，后续可接真实任务时间轴） */
const DEMO_PHASES = ['需求分析', '方案设计', '开发实现', '联调测试', '上线交付']

function demoSeriesData(projectId) {
  const seed = Number(projectId)
  const offsetDays = Number.isFinite(seed) ? Math.abs(seed % 7) : 0
  const t0 = Date.now() - offsetDays * DAY_MS - 3 * DAY_MS
  return DEMO_PHASES.map((name, i) => {
    const start = t0 + i * DAY_MS * 2
    const span = DAY_MS * (3 + (i % 3))
    return {
      name,
      value: [i, start, start + span],
    }
  })
}

function buildOption(projectId) {
  const categories = DEMO_PHASES
  const seriesData = demoSeriesData(projectId)
  return {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter(p) {
        const v = p?.data?.value
        if (!Array.isArray(v) || v.length < 3) return ''
        const fmt = (ts) => {
          const d = new Date(ts)
          return `${d.getMonth() + 1}/${d.getDate()}`
        }
        return `${p.name}<br/>${fmt(v[1])} — ${fmt(v[2])}`
      },
    },
    grid: { left: 12, right: 24, top: 28, bottom: 36, containLabel: true },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' },
      { type: 'slider', xAxisIndex: 0, height: 18, bottom: 8, filterMode: 'weakFilter' },
    ],
    xAxis: {
      type: 'time',
      scale: true,
      boundaryGap: false,
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { type: 'dashed', opacity: 0.35 } },
    },
    series: [
      {
        type: 'custom',
        name: '计划',
        renderItem(params, api) {
          const yIndex = api.value(0)
          const start = api.coord([api.value(1), yIndex])
          const end = api.coord([api.value(2), yIndex])
          const height = api.size([0, 1])[1] * 0.55
          const rectShape = {
            x: start[0],
            y: start[1] - height / 2,
            width: Math.max(end[0] - start[0], 2),
            height,
          }
          return {
            type: 'rect',
            transition: ['shape'],
            shape: rectShape,
            style: {
              fill: api.visual('color'),
              opacity: 0.88,
              borderRadius: 4,
            },
          }
        },
        encode: { x: [1, 2], y: 0 },
        dimensions: ['y', 'start', 'end'],
        data: seriesData,
        itemStyle: {
          color(params) {
            const palette = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']
            return palette[params.dataIndex % palette.length]
          },
        },
      },
    ],
  }
}

const option = computed(() => buildOption(props.projectId))
</script>

<template>
  <div class="project-task-gantt">
    <div class="project-task-gantt__title">项目进度（演示）</div>
    <v-chart class="project-task-gantt__chart" autoresize :option="option" />
  </div>
</template>

<style scoped lang="scss">
.project-task-gantt {
  flex: 0 0 38%;
  min-height: 200px;
  max-height: 42%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.project-task-gantt__title {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.project-task-gantt__chart {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}
</style>
