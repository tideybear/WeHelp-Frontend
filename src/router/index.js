import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { logoutDueToInactivity } from '@/utils/sessionInactivity'
import { touchLastActivity } from '@/utils/sessionActivity'
import Layout from '@/views/Layout/index.vue'
import Home from '@/views/Home/index.vue'
import Login from '@/views/Login/index.vue'
import CrmList from '@/views/Crm/CrmList/index.vue'
import CrmDetail from '@/views/Crm/CrmList/components/CrmListDetail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'layout',
      component: Layout,
      children: [
        { path: '/', name: 'home', component: Home },
        { path: '/crm', name: 'crm', component: Home },
        { path: '/crm/list', name: 'customerList', component: CrmList },
        { path: '/crm/list/detail/:id', name: 'customerDetail', component: CrmDetail },
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
