import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import { Icon } from '@iconify/vue'

import App from './App.vue'
import router from './router'
import { setupIcons } from './plugins/icons'
import { setupSessionActivityWatch } from './plugins/sessionActivity'
import '@/styles/common.scss'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
setupIcons(app)
app.component('Icon', Icon)
app.use(pinia).use(ElementPlus, { locale: zhCn }).use(router)
setupSessionActivityWatch()
app.mount('#app')
