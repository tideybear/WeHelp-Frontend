import { unref } from 'vue'
import { createFinanceListSummaryMethod } from '@/utils/financeListDisplay'

/** 财务列表 el-table 底部合计行 */
export function useFinanceListSummary(dataList, listDisplayOptions) {
  function summaryMethod(param) {
    const opts = unref(listDisplayOptions)
    return createFinanceListSummaryMethod(() => unref(dataList), opts)(param)
  }

  return { summaryMethod }
}
