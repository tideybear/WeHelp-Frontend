<script setup>
  import { useMenu } from '@/stores/menuStore'
  import { getOrderListAPI } from '@/apis/order'
  import { onMounted, ref, watch, nextTick } from 'vue'
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
  // 数据来源（可多选），传递给后端过滤
  const dataSources = ref(['淘宝', '拼多多'])
  // 表格列配置：通过配置数组动态渲染（避免写死多列模板）
  const columns = [
    { prop: 'project_id', label: '项目ID', width: 150, fixed: true, showOverflowTooltip: false },
    { prop: 'order_id', label: '订单编号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'sub_order_id', label: '订单子编号', width: 150, fixed: false, showOverflowTooltip: true },
    { prop: 'product_id', label: '商品ID', width: 120, fixed: false, showOverflowTooltip: true },
    { prop: 'product_title', label: '商品标题', width: 200, fixed: false, showOverflowTooltip: true },
    { prop: 'product_attributes', label: '商品属性', width: 300, fixed: false, showOverflowTooltip: true },
    { prop: 'purchase_quantity', label: '购买数量', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'buyer_payable', label: '应付金额', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'order_status', label: '订单状态', width: 120, fixed: false, showOverflowTooltip: false },
    { prop: 'order_pay_time', label: '付款时间', width: 180, fixed: false, showOverflowTooltip: false },
    { prop: 'notes', label: '备注', width: 200, fixed: false, showOverflowTooltip: true }
  ]

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
      orderList.value = res.data || []
      total.value = res.total ?? orderList.value.length
      await nextTick()
      tableRef.value?.setScrollTop?.(0)
      //console.log('订单列表数据:', orderList.value)
    } catch (error) {
      console.error('获取订单列表失败:', error)
      orderList.value = []
    } finally {
      loading.value = false
    }
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
    <div class="filter-container"  >
      筛选
    </div>
    <el-table 
      ref="tableRef"
      :data="orderList" 
      style="width: 100%" 
      height="90%"
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
          <ListActions
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

.filter-container {
  height: 5%;
  background-color: #ffffff;
}
</style>
