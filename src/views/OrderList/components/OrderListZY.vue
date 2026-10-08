<script setup>
  import { useMenu } from '@/stores/menuStore'
  import { getOrderListAPI,get_orderFilterAPI } from '@/apis/order'
  import { onMounted, ref, watch, nextTick } from 'vue'
  import { ArrowDown } from '@element-plus/icons-vue'
  import CopyableCell from '@/components/CopyableCell.vue'
  import PaginationBar from '@/components/PaginationBar.vue'
  import OrderActions from '@/components/ListActions.vue'
  
  const menuStore = useMenu()
  const orderList = ref([])
  const tableRef = ref()
  const currentPage = ref(1)
  const pageSize = ref(100)
  const total = ref(0)
  const loading = ref(false)
  const input = ref('')
  const product_filter= ref([])
  // 数据来源（可多选），传递给后端过滤
  const dataSources = ref(['淘宝', '拼多多'])
  // 表格列配置：通过配置数组动态渲染（避免写死多列模板）
  const columns = [
    { prop: 'main_order_id', label: '订单编号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'sub_order_id', label: '订单子编号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'product_title', label: '商品标题', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'product_attributes', label: '商品属性', width: 300, fixed: false, showOverflowTooltip: true },
    { prop: 'purchase_quantity', label: '购买数量', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'buyer_actual_pay', label: '实付金额', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'order_status', label: '订单状态', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'order_pay_time', label: '付款时间', width: 180, fixed: false, showOverflowTooltip: false },
    { prop: 'notes', label: '备注', width: 200, fixed: false, showOverflowTooltip: true }
  ]

  // 格式化时间为 yyyy-MM-dd HH:mm:ss
  const formatDateTime = (dateTime) => {
    if (!dateTime) return dateTime
    try {
      const date = new Date(dateTime)
      if (isNaN(date.getTime())) return dateTime // 如果无法解析，返回原值
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    } catch (error) {
      return dateTime
    }
  }

  // 判断字段是否为时间字段
  const isTimeField = (fieldName) => {
    if (!fieldName || typeof fieldName !== 'string') return false
    const timeKeywords = ['time', 'date', 'Time', 'Date', 'TIME', 'DATE']
    return timeKeywords.some(keyword => fieldName.includes(keyword))
  }

  // 格式化数据中的时间字段
  const formatTimeFields = (data) => {
    if (!Array.isArray(data)) return data
    return data.map(item => {
      const formattedItem = { ...item }
      Object.keys(formattedItem).forEach(key => {
        if (isTimeField(key) && formattedItem[key]) {
          formattedItem[key] = formatDateTime(formattedItem[key])
        }
      })
      return formattedItem
    })
  }

  // 获取订单列表数据
  const fetchOrderList = async (page = 1, size = 100) => {
    if (!menuStore.currentProjectId) {
      return
    }
    loading.value = true
    try {
      const res = await getOrderListAPI(
        menuStore.currentProjectId,
        0,
        page,
        size,
        dataSources.value
      )
      const rawData = res.data || []
      // 格式化所有时间字段
      orderList.value = formatTimeFields(rawData)
      total.value = res.total ?? orderList.value.length
      await nextTick()
      tableRef.value?.setScrollTop?.(0)
    } catch (error) {
      console.error('获取订单列表失败:', error)
      orderList.value = []
    } finally {
      loading.value = false
    }
  }

  //获取产品列表数据
  const fetchOrderFilter = async () => {
    get_orderFilterAPI
  }


  // 删除行
  const deleteRow = (index) => {
    orderList.value.splice(index, 1)
  }

  // 分页大小改变
  const handleSizeChange = (val) => {
    pageSize.value = val
    currentPage.value = 1
    fetchOrderList(1, val)
  }

  // 当前页改变
  const handleCurrentChange = (val) => {
    currentPage.value = val
    fetchOrderList(val, pageSize.value)
  }

  // 监听项目ID变化，重新获取数据
  watch(() => menuStore.currentProjectId, (newId) => {
    if (newId) {
      fetchOrderList(currentPage.value, pageSize.value)
    }
  })

  // 组件挂载时获取数据
  onMounted(() => {
    if (menuStore.currentProjectId) {
      fetchOrderList(currentPage.value, pageSize.value)
    }
  })
</script>


<template>
    <div class="collapse-container">
      <el-collapse  accordion>
        <el-collapse-item title="筛选条件">
          <el-row>
            <el-col :span="4"><div><span>订单编号：<el-input v-model="input" placeholder="多订单，隔开"></el-input></span></div></el-col>
            <el-col :span="4">
              <div>
                <span>
                  产品筛选： 
                  <el-select v-model="value2" multiple collapse-tags placeholder="请选择">
                    <el-option
                      v-for="item in options"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value">
                    </el-option>
                  </el-select>
                </span>
              </div>
            </el-col>
            <el-col :span="4">
              <div>
                <span>
                  订单状态： 
                  <el-select v-model="value" placeholder="请选择">
                    <el-option
                      v-for="item in options"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value">
                    </el-option>
                  </el-select>
                </span>
              </div>
            </el-col>
            <el-col :span="4"><div class="grid-content bg-purple-light"></div></el-col>
            <el-col :span="4"><div class="grid-content bg-purple"></div></el-col>
            <el-col :span="4"><div class="grid-content bg-purple-light"></div></el-col>
          </el-row>
        </el-collapse-item>
      </el-collapse>
    </div>
    <el-table 
      ref="tableRef"
      :data="orderList" 
      style="width: 100%" 
      height="88%"
      v-loading="loading"
      element-loading-text="加载中...">
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
          <CopyableCell :value="scope.row?.[col.prop]" />
        </template>
      </el-table-column>
      <el-table-column
        fixed="right"
        label="操作"
        width="150">
        <template #default="scope">
          <OrderActions
            :row="scope.row"
            :rowIndex="scope.$index"
            :on-delete="deleteRow"
            :edit-enabled="true"
            :delete-enabled="false"
          />
        </template>
      </el-table-column>
    </el-table>
    <PaginationBar
      v-model:currentPage="currentPage"
      v-model:pageSize="pageSize"
      :total="total"
      :page-sizes="[50,100, 200]"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
</template>

<style scoped lang="scss">
.collapse-container {
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: #ffffff;
  padding-left:10px;
  :deep(.el-collapse) {
    position: relative;
  }
  
  // 让所有展开内容都使用绝对定位，避免布局变化导致抖动
  :deep(.el-collapse-item__wrap) {
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 1001;
    background-color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    max-height: 400px;
    overflow-y: auto;
    // 保持 Element Plus 的动画，但使用绝对定位
    transform-origin: top;
  }
  
  :deep(.el-collapse-item__content) {
    background-color: #ffffff;
    padding: 10px;
  }
  
  // 确保 el-row 中的内容在同一行
  :deep(.el-row) {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
  }
  
  // 确保 el-col 中的内容在同一行且合理分配
  :deep(.el-col) {
    display: flex;
    align-items: center;
    min-width: 0; // 允许内容收缩
    padding:0 10px;
    
    > div {
      width: 100%;
      display: flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      gap: 8px; // 添加间距
      
      > span {
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 0;
        gap: 8px;
        
        // 所有 Element Plus 组件自动占据剩余宽度
        .el-input,
        .el-select,
        .el-date-picker,
        .el-cascader,
        .el-autocomplete {
          flex: 1;
          min-width: 0;
          max-width: 100%;
        }
        
        // 处理 el-select 的宽度，确保占据剩余空间
        .el-select {
          width: auto;
          flex: 1;
          margin: 0 !important; // 去除所有 margin
        }
        
        // 确保 el-input 内部的 input 元素也占据全宽
        .el-input .el-input__wrapper {
          width: 100%;
        }
      }
    }
  }
}
</style>
