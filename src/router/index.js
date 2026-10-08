import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import Layout from '@/views/Layout/index.vue'
import Home from '@/views/Home/index.vue'
import OrderList from '@/views/OrderList/index.vue'
import Finance from '@/views/Finance/index.vue'
import BankStatements from '@/views/Finance/BankStatements/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 bankStatements* 整包内切换 */
const BankStatementsDetailRoute = { name: 'BankStatementsDetailRoute', render: () => null }
import StreamingTimeline from '@/views/Finance/StreamingTimeline/index.vue'
import PrivateAccountTransactions from '@/views/Finance/PrivateAccountTransactions/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 privateAccountTransactions* 整包内切换 */
const PrivateAccountTransactionsDetailRoute = {
  name: 'PrivateAccountTransactionsDetailRoute',
  render: () => null,
}
import ReimbursementDetails from '@/views/Finance/ReimbursementDetails/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 reimbursementDetails* 整包内切换 */
const ReimbursementDetailsDetailRoute = { name: 'ReimbursementDetailsDetailRoute', render: () => null }
import FinancialApproval from '@/views/Finance/FinancialApproval/index.vue'
import FinancePayables from '@/views/Finance/FinancePayables/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 financePayables* 整包内切换 */
const FinancePayableDetailRoute = { name: 'FinancePayableDetailRoute', render: () => null }
import FinancePayablesAccounting from '@/views/Finance/FinancePayablesAccounting/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 financePayablesAccounting* 整包内切换 */
const FinancePayableAccountingDetailRoute = {
  name: 'FinancePayableAccountingDetailRoute',
  render: () => null,
}
import FinanceReceivables from '@/views/Finance/FinanceReceivables/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 financeReceivables* 整包内切换 */
const FinanceReceivableDetailRoute = { name: 'FinanceReceivableDetailRoute', render: () => null }
import FinanceReceivablesAccounting from '@/views/Finance/FinanceReceivablesAccounting/index.vue'
/** 仅占位以注册 detail 路由名；列表/详情由 financeReceivablesAccounting* 整包内切换 */
const FinanceReceivableAccountingDetailRoute = {
  name: 'FinanceReceivableAccountingDetailRoute',
  render: () => null,
}
import Login from '@/views/Login/index.vue'
import { touchLastActivity } from '@/utils/sessionActivity'
import { logoutDueToInactivity } from '@/utils/sessionInactivity'
import Project from '@/views/Project/index.vue'
import ProjectManager from '@/views/Project/projectManager/index.vue'
import ProjectTask from '@/views/Project/projectTask/index.vue'
import Purchase from '@/views/Purchase/index.vue'
import PurchaseSuppliers from '@/views/Purchase/Suppliers/index.vue'
import SupplierDetailDefault from '@/views/Purchase/Suppliers/Detail/supplierDetailDefault/index.vue'
import Sales from '@/views/Sales/index.vue'
import SalesCustomers from '@/views/Sales/Customers/index.vue'
import CustomerDetailDefault from '@/views/Sales/Customers/Detail/customerDetailDefault/index.vue'




const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: Layout,
      children: [
        { path: '/', name: 'home', component: Home },
        { path: '/order/list', name: 'orderlist', component: OrderList },
        {
          path: '/finance',
          name: 'Finance',
          component: Finance,
          redirect: { name: 'BankStatements' },
          children: [
            {
              path: 'bank/statements',
              name: 'BankStatements',
              component: BankStatements,
              children: [
                { path: 'detail/:id', name: 'BankStatementsDetail', component: BankStatementsDetailRoute },
              ],
            },
            { path: 'streamingtimeline', name: 'StreamingTimeline', component: StreamingTimeline },
            {
              path: 'private/account/transactions',
              name: 'PrivateAccountTransactions',
              component: PrivateAccountTransactions,
              children: [
                {
                  path: 'detail/:id',
                  name: 'PrivateAccountTransactionsDetail',
                  component: PrivateAccountTransactionsDetailRoute,
                },
              ],
            },
            {
              path: 'reimbursement/details',
              name: 'ReimbursementDetails',
              component: ReimbursementDetails,
              children: [
                /** 兼容旧菜单 path：/finance/reimbursement/details/list */
                {
                  path: 'list',
                  name: 'ReimbursementDetailsList',
                  redirect: { name: 'ReimbursementDetails' },
                },
                {
                  path: 'detail/:id',
                  name: 'ReimbursementDetailsDetail',
                  component: ReimbursementDetailsDetailRoute,
                },
              ],
            },
            { path: 'approval', name: 'FinancialApproval', component: FinancialApproval },
            {
              path: 'payables',
              name: 'FinancePayables',
              component: FinancePayables,
              children: [
                {
                  path: 'detail/:id',
                  name: 'FinancePayableDetail',
                  component: FinancePayableDetailRoute,
                },
              ],
            },
            {
              path: 'payables/accounting',
              name: 'FinancePayablesAccounting',
              component: FinancePayablesAccounting,
              children: [
                {
                  path: 'detail/:id',
                  name: 'FinancePayableAccountingDetail',
                  component: FinancePayableAccountingDetailRoute,
                },
              ],
            },
            {
              path: 'receivables',
              name: 'FinanceReceivables',
              component: FinanceReceivables,
              children: [
                {
                  path: 'detail/:id',
                  name: 'FinanceReceivableDetail',
                  component: FinanceReceivableDetailRoute,
                },
              ],
            },
            {
              path: 'receivables/accounting',
              name: 'FinanceReceivablesAccounting',
              component: FinanceReceivablesAccounting,
              children: [
                {
                  path: 'detail/:id',
                  name: 'FinanceReceivableAccountingDetail',
                  component: FinanceReceivableAccountingDetailRoute,
                },
              ],
            },
          ],
        },
        {
          path: '/project',
          name: 'Project',
          component: Project,
          redirect: { name: 'ProjectList' },
          children: [
            { path: 'list', name: 'ProjectList', component: ProjectManager },
            { path: 'detail/:id', name: 'ProjectDetail', component: ProjectManager },
            { path: 'task', name: 'ProjectTask', component: ProjectTask },
          ],
        },
        {
          path: '/purchase',
          name: 'Purchase',
          component: Purchase,
          redirect: { name: 'PurchaseSuppliers' },
          children: [
            {
              path: 'suppliers',
              name: 'PurchaseSuppliers',
              component: PurchaseSuppliers,
              children: [
                {
                  path: 'detail/:id',
                  name: 'PurchaseSupplierDetail',
                  component: SupplierDetailDefault,
                },
              ],
            },
          ],
        },
        {
          path: '/sales',
          name: 'Sales',
          component: Sales,
          redirect: { name: 'SalesCustomers' },
          children: [
            {
              path: 'customers',
              name: 'SalesCustomers',
              component: SalesCustomers,
              children: [
                {
                  path: 'detail/:id',
                  name: 'SalesCustomerDetail',
                  component: CustomerDetailDefault,
                },
              ],
            },
          ],
        },
      ],
    },
    { path: '/login', name: 'login', component: Login },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

const ROUTE_WHITE_LIST = ['/login']

router.beforeEach((to) => {
  const userStore = useUserStore()
  const token = userStore.userInfo?.token

  const inactivityRedirect = logoutDueToInactivity(true, to.path !== '/login' ? to.fullPath : undefined)
  if (inactivityRedirect) {
    return inactivityRedirect
  }

  if (ROUTE_WHITE_LIST.includes(to.path)) {
    if (token && to.path === '/login') {
      return { path: '/' }
    }
    return true
  }

  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  touchLastActivity()
  return true
})

export default router
