import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { logoutDueToInactivity } from '@/utils/sessionInactivity'
import { touchLastActivity } from '@/utils/sessionActivity'
import Layout from '@/views/Layout/index.vue'
import Home from '@/views/Home/index.vue'
import Login from '@/views/Login/index.vue'
import CrmList from '@/views/Crm/CrmList/index.vue'
import CrmContact from '@/views/Crm/CrmContact/index.vue'
import CrmFollowUpRecords from '@/views/Crm/CrmFollowUpRecords/index.vue'
import CrmDetail from '@/views/Crm/CrmList/components/CrmListDetail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: Layout,
      children: [
        { path: '/', name: 'home', component: Home, meta: { title: '首页' } },
        { path: '/crm', name: 'crm', component: Home, meta: { title: '客户管理' } },
        { path: '/crm/list', name: 'customerList', component: CrmList, meta: { title: '客户列表' } },
        { path: '/crm/contact/list', name: 'customerContactList', component: CrmContact, meta: { title: '联系人表' } },
        { path: '/crm/follow/record', name: 'customerFollowUpRecord', component: CrmFollowUpRecords, meta: { title: '跟进记录' } },
        { path: '/crm/list/detail/:id', name: 'customerDetail', component: CrmDetail, meta: { title: '详情' } },
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
