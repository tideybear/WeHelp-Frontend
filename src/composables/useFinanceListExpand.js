import { ref, computed, watch, unref } from 'vue'
import {
  buildFinanceListDisplayRows,
  filterFinanceListDisplayRows,
} from '@/utils/financeListDisplay'

/** 财务/项目台账列表：明细子行默认收起，点击主行或展开图标后展开 */
export function useFinanceListExpand(dataList, listDisplayOptions) {
  const expandedIds = ref(new Set())

  function toggleExpand(recordId) {
    if (recordId == null) return
    const next = new Set(expandedIds.value)
    if (next.has(recordId)) {
      next.delete(recordId)
    } else {
      next.add(recordId)
    }
    expandedIds.value = next
  }

  function isExpanded(recordId) {
    return recordId != null && expandedIds.value.has(recordId)
  }

  function resetExpand() {
    expandedIds.value = new Set()
  }

  const displayList = computed(() => {
    const opts = unref(listDisplayOptions)
    const all = buildFinanceListDisplayRows(unref(dataList), opts)
    return filterFinanceListDisplayRows(all, expandedIds.value, opts)
  })

  watch(
    () => unref(dataList),
    () => resetExpand(),
  )

  return {
    displayList,
    toggleExpand,
    isExpanded,
    resetExpand,
  }
}
