import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Autoimport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  // 站点前缀：部署在 http://<域名>/wehelp/ 下时，静态资源引用带上 /wehelp/ 前缀。
  // router 的 base 用 import.meta.env.BASE_URL 读取，与这里保持一致。
  base: '/wehelp/',
  plugins: [
    vue(),
    Autoimport({
      resolvers:[ElementPlusResolver()],
    }),
    Components({
      resolvers: [
        ElementPlusResolver({importStyle: "sass"}),
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: ` 
          @use "@/styles/element/index.scss" as *;
          @use "@/styles/var.scss" as *;
        `,
      },
    },
  },
})
