<script setup>
  import { useMenu } from '@/stores/menuStore'
  import { getBankStatementsListAPI, uploadBankStatementAPI } from '@/apis/fin'
  import { onMounted, ref, watch, nextTick } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Download, Search, UploadFilled } from '@element-plus/icons-vue'
  import CopyableCell from '@/components/CopyableCell.vue'
  import PaginationBar from '@/components/PaginationBar.vue'
  import ListActions from '@/components/ListActions.vue'
  import { formatDateTime } from '@/utils/formatDate'
  import { buildCsvContent, downloadCsvFile } from '@/utils/exportTableCsv'

  
  const menuStore = useMenu()
  const router = useRouter()
  const dataList = ref([])
  const tableRef = ref()
  const currentPage = ref(1)
  const pageSize = ref(100)
  const total = ref(0)
  const loading = ref(false)
  const LOADING_DELAY = 150
  let loadingTimer = null
  const dialogVisible = ref(false)
  const uploadFileList = ref([])
  const uploadBankType = ref('auto')
  const downloading = ref(false)

  const UPLOAD_BANK_TYPE_OPTIONS = [
    { label: '自动识别', value: 'auto' },
    { label: '工商银行', value: 'icbc' },
    { label: '温州银行', value: 'wzbank' },
  ]

  const DATE_EXPORT_PROPS = new Set(['transaction_time', 'created_at', 'updated_at'])
  const EXPORT_PAGE_SIZE = 500

  const DIRECTION_OPTIONS = ['借', '贷']
  const TRANSACTION_TIME_SORT_OPTIONS = [
    { label: '降序', value: 'transaction_time_desc' },
    { label: '升序', value: 'transaction_time_asc' },
  ]

  const filters = ref({
    keyword: '',
    voucher_no: '',
    counterparty_name: '',
    our_account_no: '',
    direction: '',
    transaction_time_range: null,
    sort: 'transaction_time_desc',
  })

  function buildFilterParams() {
    const out = {}
    const f = filters.value
    const keyword = String(f.keyword ?? '').trim()
    if (keyword) out.keyword = keyword
    const voucherNo = String(f.voucher_no ?? '').trim()
    if (voucherNo) out.voucher_no = voucherNo
    const cpName = String(f.counterparty_name ?? '').trim()
    if (cpName) out.counterparty_name = cpName
    const ourAcc = String(f.our_account_no ?? '').trim()
    if (ourAcc) out.our_account_no = ourAcc
    const dir = String(f.direction ?? '').trim()
    if (dir) out.direction = dir

    const sortKey = f.sort || 'transaction_time_desc'
    out.sort_by = 'transaction_time'
    out.sort_order = sortKey === 'transaction_time_asc' ? 'asc' : 'desc'

    const range = f.transaction_time_range
    if (Array.isArray(range) && range.length === 2) {
      const [from, to] = range
      if (from) out.transaction_time_from = from
      if (to) out.transaction_time_to = to
    }
    return out
  }

  function handleSearch() {
    currentPage.value = 1
    fetchdataList(1, pageSize.value)
  }

  function handleResetFilters() {
    filters.value = {
      keyword: '',
      voucher_no: '',
      counterparty_name: '',
      our_account_no: '',
      direction: '',
      transaction_time_range: null,
      sort: 'transaction_time_desc',
    }
    handleSearch()
  }

  const closeUploadDialog = () => {
    dialogVisible.value = false
    uploadFileList.value = []
    uploadBankType.value = 'auto'
  }

  const handleClose = (done) => {
    ElMessageBox.confirm('确认关闭上传窗口吗？', '提示', {
      cancelButtonText: '取消',
      confirmButtonText: '确定',
      type: 'warning'
    }).then(() => {
      closeUploadDialog()
      done()
    }).catch(() => {})
  }

  const handleUploadConfirm = async () => {
    const fileItem = uploadFileList.value[0]
    const rawFile = fileItem?.raw

    if (!menuStore.currentNamespaceId) {
      ElMessage.warning('请先选择项目')
      return
    }
    if (!rawFile) {
      ElMessage.warning('请先选择上传文件')
      return
    }

    const formData = new FormData()
    formData.append('namespace_id', String(menuStore.currentNamespaceId))
    formData.append('bank_type', uploadBankType.value)
    formData.append('file', rawFile)

    try {
      const res = await uploadBankStatementAPI(formData)
      if (res?.code !== 200) {
        const hint = res?.data?.hint
        const reasons = res?.data?.invalid_reasons
        let msg = res?.msg || '上传失败'
        if (hint) msg = `${msg}：${hint}`
        else if (Array.isArray(reasons) && reasons.length) msg = `${msg}：${reasons[0]}`
        ElMessage.error(msg)
        return
      }
      ElMessage.success('上传成功')
      closeUploadDialog()
      fetchdataList(currentPage.value, pageSize.value)
    } catch (error) {
      console.error('上传银行流水失败:', error)
      const data = error?.response?.data
      const hint = data?.data?.hint
      const reasons = data?.data?.invalid_reasons
      let errorMsg = data?.msg || '上传失败，请稍后重试'
      if (hint) errorMsg = `${errorMsg}：${hint}`
      else if (Array.isArray(reasons) && reasons.length) errorMsg = `${errorMsg}：${reasons[0]}`
      ElMessage.error(errorMsg)
    }
  }

  
  const columns = [
    { prop: 'bank_name', label: '银行', width: 100, fixed: false, showOverflowTooltip: true },
    { prop: 'voucher_no', label: '凭证号', width: 150, fixed: false, showOverflowTooltip: false },
    { prop: 'voucher_type', label: '凭证种类', width: 100, fixed: false, showOverflowTooltip: true },
    { prop: 'our_account_no', label: '本方账号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'counterparty_account_no', label: '对方账号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'counterparty_bank_no', label: '对方行号', width: 120, fixed: false, showOverflowTooltip: true },
    { prop: 'counterparty_bank_name', label: '对方行名', width: 140, fixed: false, showOverflowTooltip: true },
    { prop: 'counterparty_name', label: '对方单位名称', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'group_sub_account', label: '集团子账户', width: 120, fixed: false, showOverflowTooltip: true },
    { prop: 'transaction_time', label: '交易时间', width: 300, fixed: false, showOverflowTooltip: true },
    { prop: 'direction', label: '借/贷方向', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'debit_amount', label: '借方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'credit_amount', label: '贷方发生额(元)', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'balance', label: '余额(元)', width: 180, fixed: false, showOverflowTooltip: false },
    { prop: 'abstract_text', label: '摘要', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'purpose', label: '用途', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'personalized_info', label: '个性化信息', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'created_at', label: '记录创建时间', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'updated_at', label: '记录更新时间', width: 200, fixed: false, showOverflowTooltip: true }
  ]

  // 获取银行流水列表数据
  const fetchdataList = async (page = 1, size = 100) => {
    if (!menuStore.currentNamespaceId) {
      return
    }
    loadingTimer = setTimeout(() => {
      loading.value = true
    }, LOADING_DELAY)
    try {
      const res = await getBankStatementsListAPI(
        menuStore.currentNamespaceId,
        page,
        size,
        buildFilterParams(),
      )
      if (res?.code !== 200) {
        ElMessage.error(res?.msg || '加载失败')
        dataList.value = []
        total.value = 0
        return
      }
      dataList.value = Array.isArray(res.data) ? res.data : []
      total.value = Number(res.total) || 0
      currentPage.value = Number(res.page) || page
      pageSize.value = Number(res.page_size) || size
      await nextTick()
      tableRef.value?.setScrollTop?.(0)
    } catch (error) {
      console.error('获取银行对账单列表失败:', error)
      dataList.value = []
    } finally {
      if (loadingTimer) {
        clearTimeout(loadingTimer)
        loadingTimer = null
      }
      loading.value = false
    }
  }

  function formatExportCell(row, col) {
    const prop = col.prop
    if (DATE_EXPORT_PROPS.has(prop)) {
      return formatDateTime(row?.[prop]) || ''
    }
    const v = row?.[prop]
    if (v == null || v === '') return ''
    return String(v)
  }

  async function fetchAllForExport() {
    const ns = menuStore.currentNamespaceId
    if (!ns) return []

    const filters = buildFilterParams()
    let page = 1
    let all = []
    let totalCount = 0

    while (true) {
      const res = await getBankStatementsListAPI(ns, page, EXPORT_PAGE_SIZE, filters)
      if (res?.code !== 200) {
        throw new Error(res?.msg || '加载数据失败')
      }
      const chunk = Array.isArray(res.data) ? res.data : []
      totalCount = Number(res.total) || 0
      all = all.concat(chunk)
      if (chunk.length < EXPORT_PAGE_SIZE || all.length >= totalCount) {
        break
      }
      page += 1
      if (page > 500) {
        break
      }
    }
    return all
  }

  async function handleDownload() {
    if (!menuStore.currentNamespaceId) {
      ElMessage.warning('请先选择空间')
      return
    }
    downloading.value = true
    try {
      const rows = await fetchAllForExport()
      if (!rows.length) {
        ElMessage.warning('当前筛选条件下无数据可下载')
        return
      }
      const headerLabels = columns.map((c) => c.label)
      const dataRows = rows.map((row) => columns.map((col) => formatExportCell(row, col)))
      const csv = buildCsvContent(headerLabels, dataRows)
      const dateStr = new Date().toISOString().slice(0, 10)
      downloadCsvFile(`银行流水_${dateStr}.csv`, csv)
      ElMessage.success(`已下载 ${rows.length} 条记录`)
    } catch (error) {
      console.error('下载银行流水失败:', error)
      ElMessage.error(error?.message || '下载失败')
    } finally {
      downloading.value = false
    }
  }

  // 查看详情
  const viewRow = (index) => {
    const rowIndex = Number(index)
    if (Number.isNaN(rowIndex) || rowIndex < 0 || rowIndex >= dataList.value.length) return

    const rowData = dataList.value[rowIndex]
    const rowId = rowData?.id ?? ''

    router.push({
      path: `/finance/bank/statements/detail/${encodeURIComponent(String(rowId))}`,
      query: {
        id: String(rowId),
        rowData: encodeURIComponent(JSON.stringify(rowData || {})),
        columns: encodeURIComponent(JSON.stringify(columns))
      }
    })
  }

  // 分页大小改变
  const handleSizeChange = (val) => {
    pageSize.value = val
    currentPage.value = 1
    fetchdataList(1, val)
  }

  // 当前页改变
  const handleCurrentChange = (val) => {
    currentPage.value = val
    fetchdataList(val, pageSize.value)
  }

  // 监听项目ID变化，重新获取数据
  watch(() => menuStore.currentNamespaceId, (newId) => {
    if (newId) {
      currentPage.value = 1
      fetchdataList(1, pageSize.value)
    } else {
      dataList.value = []
      total.value = 0
    }
  })

  // 组件挂载时获取数据
  onMounted(() => {
    if (menuStore.currentNamespaceId) {
      fetchdataList(currentPage.value, pageSize.value)
    }
  })
</script>


<template>
  <div class="bank-statements-page">
    <div class="list-container">
      <div class="filter-container">
        <el-form
          class="filter-form"
          :inline="true"
          label-width="72px"
          @submit.prevent="handleSearch"
        >
          <div class="filter-form__row filter-form__row--primary">
            <el-form-item label="关键词" class="filter-item filter-item--keyword">
              <el-input
                v-model="filters.keyword"
                placeholder="摘要 / 用途 / 账号等"
                clearable
                class="filter-control filter-keyword"
                :prefix-icon="Search"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="交易时间" class="filter-item filter-item--date">
              <el-date-picker
                v-model="filters.transaction_time_range"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                clearable
                class="filter-date-range"
              />
            </el-form-item>
            <el-form-item label="排序" class="filter-item filter-item--sort">
              <el-select
                v-model="filters.sort"
                class="filter-control filter-select"
                @change="handleSearch"
              >
                <el-option
                  v-for="opt in TRANSACTION_TIME_SORT_OPTIONS"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="借/贷" class="filter-item filter-item--direction">
              <el-select
                v-model="filters.direction"
                placeholder="全部"
                clearable
                class="filter-control filter-select"
              >
                <el-option
                  v-for="opt in DIRECTION_OPTIONS"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
          </div>
          <div class="filter-form__row filter-form__row--secondary">
            <el-form-item label="凭证号" class="filter-item filter-item--voucher">
              <el-input
                v-model="filters.voucher_no"
                placeholder="模糊搜索"
                clearable
                class="filter-control filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="对方单位" class="filter-item filter-item--counterparty">
              <el-input
                v-model="filters.counterparty_name"
                placeholder="模糊搜索"
                clearable
                class="filter-control filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="本方账号" class="filter-item filter-item--account">
              <el-input
                v-model="filters.our_account_no"
                placeholder="模糊搜索"
                clearable
                class="filter-control filter-input"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item class="filter-form-actions" label-width="0">
              <el-button type="primary" native-type="submit">查询</el-button>
              <el-button @click="handleResetFilters">重置</el-button>
            </el-form-item>
            <div class="filter-toolbar-extra">
              <el-button :icon="Download" :loading="downloading" @click="handleDownload">
                下载
              </el-button>
              <el-button type="primary" plain @click="dialogVisible = true">上传</el-button>
            </div>
          </div>
        </el-form>
      </div>
      <div class="table-container">
        <el-table
          ref="tableRef"
          class="bank-statements-table"
          :data="dataList"
          style="width: 100%"
          height="100%"
          table-layout="fixed"
          border
          v-loading="loading"
          element-loading-text="加载中…"
        >
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :fixed="col.fixed || false"
            :show-overflow-tooltip="col.showOverflowTooltip || false"
          >
            <template #default="scope">
              <CopyableCell
                v-if="col.prop === 'transaction_time' || col.prop === 'created_at' || col.prop === 'updated_at'"
                :value="formatDateTime(scope.row?.[col.prop]) || '—'"
              />
              <CopyableCell v-else :value="scope.row?.[col.prop]" />
            </template>
          </el-table-column>
          <el-table-column fixed="right" label="操作" width="80">
            <template #default="scope">
              <ListActions
                :row="scope.row"
                :row-index="scope.$index"
                view-only
                @view="viewRow"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pagination-container">
        <PaginationBar
          v-model:currentPage="currentPage"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[50,100, 200]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
    <el-dialog
      v-model="dialogVisible"
      title="上传银行流水"
      width="420px"
      destroy-on-close
      :before-close="handleClose"
    >
      <div class="upload-dialog-content">
        <p class="upload-tip">请选择银行类型并上传流水文件（支持 Excel/CSV）。</p>
        <div class="upload-bank-type">
          <span class="upload-bank-type__label">银行类型</span>
          <el-radio-group v-model="uploadBankType">
            <el-radio
              v-for="opt in UPLOAD_BANK_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.value"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </div>
        <p class="upload-tip upload-tip--hint">
          温州银行表头需含：本方账号、交易日期、对方账号、对方户名、借/贷方发生额、余额、凭证号码等。
        </p>
        <el-upload
          v-model:file-list="uploadFileList"
          :auto-upload="false"
          :limit="1"
          drag
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">将文件拖拽到此处，或 <em>点击上传</em></div>
        </el-upload>
      </div>
      <template #footer>
        <el-button @click="closeUploadDialog">取消</el-button>
        <el-button type="primary" @click="handleUploadConfirm">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<style scoped lang="scss">
$toolbar-primary: #409eff;
$toolbar-primary-light-3: #79bbff;
$toolbar-primary-light-5: #a0cfff;
$toolbar-primary-light-7: #c6e2ff;
$toolbar-primary-light-8: #d9ecff;
$toolbar-primary-light-9: #ecf5ff;
$toolbar-primary-dark-2: #337ecc;
$layout-main-padding: 20px;
$layout-viewport-offset: 100px;

.bank-statements-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: calc(100% + #{$layout-main-padding * 2});
  max-width: calc(100% + #{$layout-main-padding * 2});
  margin-left: -$layout-main-padding;
  margin-right: -$layout-main-padding;
  height: calc(100vh - #{$layout-viewport-offset});
  max-height: calc(100vh - #{$layout-viewport-offset});
  min-height: 0;
  overflow: hidden;
  padding: 12px $layout-main-padding 16px;
  background-color: #ffffff;
}

.list-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filter-container {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  margin-bottom: 12px;
  padding: 16px 20px 4px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  --el-color-primary: #{$toolbar-primary};
  --el-color-primary-light-3: #{$toolbar-primary-light-3};
  --el-color-primary-light-5: #{$toolbar-primary-light-5};
  --el-color-primary-light-7: #{$toolbar-primary-light-7};
  --el-color-primary-light-8: #{$toolbar-primary-light-8};
  --el-color-primary-light-9: #{$toolbar-primary-light-9};
  --el-color-primary-dark-2: #{$toolbar-primary-dark-2};
  --filter-control-height: 34px;
}

.filter-form {
  width: 100%;

  :deep(.el-form-item) {
    margin-bottom: 12px;
    margin-right: 0;
    vertical-align: bottom;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    padding-right: 8px;
    height: var(--filter-control-height);
    line-height: var(--filter-control-height);
  }

  :deep(.el-form-item__content) {
    min-height: var(--filter-control-height);
    line-height: var(--filter-control-height);
  }

  /* 输入框 / 下拉 */
  :deep(.filter-control) {
    width: 100%;
  }

  :deep(.filter-control .el-input__wrapper),
  :deep(.filter-control .el-select__wrapper) {
    min-height: var(--filter-control-height);
    padding: 0 12px;
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
    background-color: #fff;
    transition:
      box-shadow 0.2s ease,
      background-color 0.2s ease;
  }

  :deep(.filter-control .el-input__inner),
  :deep(.filter-control .el-select__placeholder),
  :deep(.filter-control .el-select__selected-item) {
    font-size: 13px;
  }

  :deep(.filter-control .el-input__wrapper:hover),
  :deep(.filter-control .el-select__wrapper:hover) {
    box-shadow: 0 0 0 1px #c0c4cc inset;
    background-color: #fff;
  }

  :deep(.filter-control .el-input.is-focus .el-input__wrapper),
  :deep(.filter-control .el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
    background-color: #fff;
  }

  :deep(.filter-keyword .el-input__prefix) {
    color: var(--el-text-color-placeholder);
  }

  /* 日期范围 */
  :deep(.filter-date-range.el-date-editor--daterange) {
    width: 100% !important;
    height: var(--filter-control-height);
    padding: 0 10px;
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--el-border-color) inset;
    background-color: #fff;
    box-sizing: border-box;
    transition: box-shadow 0.2s ease;
  }

  :deep(.filter-date-range.el-date-editor--daterange:hover) {
    box-shadow: 0 0 0 1px #c0c4cc inset;
  }

  :deep(.filter-date-range.el-date-editor--daterange.is-active) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  :deep(.filter-date-range .el-range-input) {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  :deep(.filter-date-range .el-range-separator) {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: var(--filter-control-height);
  }

  :deep(.filter-date-range .el-range__icon) {
    font-size: 14px;
    color: var(--el-text-color-placeholder);
  }
}

.filter-form__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0 4px;
  width: 100%;
}

.filter-form__row--secondary {
  padding-top: 4px;
  margin-top: 2px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.filter-item--keyword {
  flex: 1 1 240px;
  min-width: 220px;
  max-width: 360px;
}

.filter-item--date {
  flex: 0 0 272px;
  min-width: 240px;
}

.filter-item--sort {
  flex: 0 0 148px;
}

.filter-item--direction {
  flex: 0 0 120px;
}

.filter-item--voucher,
.filter-item--counterparty {
  flex: 0 0 200px;
}

.filter-item--account {
  flex: 0 0 200px;
}

.filter-keyword,
.filter-input,
.filter-select {
  width: 100%;
}

.filter-form-actions {
  flex: 0 0 auto;
  margin-left: 4px;

  :deep(.el-form-item__content) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
  }

  :deep(.el-button) {
    height: var(--filter-control-height);
    padding: 0 16px;
    border-radius: 8px;
    font-size: 13px;
  }
}

.filter-toolbar-extra {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  margin-bottom: 12px;
  padding-left: 12px;

  :deep(.el-button) {
    height: var(--filter-control-height);
    padding: 0 14px;
    border-radius: 8px;
    font-size: 13px;
  }
}

.table-container {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.bank-statements-table) {
    width: 100% !important;
    max-width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    --el-table-border-color: var(--el-border-color-lighter);
    background-color: transparent;
  }

  :deep(.bank-statements-table .el-table__inner-wrapper) {
    width: 100% !important;
    height: 100%;
  }

  :deep(.bank-statements-table .el-table__header-wrapper),
  :deep(.bank-statements-table .el-table__body-wrapper) {
    width: 100% !important;
  }

  :deep(.bank-statements-table .el-table__header-wrapper table),
  :deep(.bank-statements-table .el-table__body-wrapper table) {
    width: 100% !important;
    table-layout: fixed;
  }

  :deep(.bank-statements-table .el-table__cell) {
    padding: 8px 0;
  }

  :deep(.bank-statements-table .cell) {
    padding-left: 8px;
    padding-right: 8px;
    line-height: 1.4;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }
}

.pagination-container {
  flex-shrink: 0;
  width: 100%;
  padding-top: 10px;
  box-sizing: border-box;
}

.upload-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-tip {
  margin: 0;
  color: #606266;
}

.upload-tip--hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.upload-bank-type {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.upload-bank-type__label {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 32px;
}

.upload-bank-type :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

</style>
