import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const viteModules = path.resolve('D:/legado-home/_vite/node_modules')

export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      {
        find: /^vue$/,
        replacement: path.join(viteModules, 'vue/dist/vue.runtime.esm-bundler.js'),
      },
      {
        find: /^vue-router$/,
        replacement: path.join(viteModules, 'vue-router/dist/vue-router.mjs'),
      },
      {
        find: /^pinia$/,
        replacement: path.join(viteModules, 'pinia/dist/pinia.mjs'),
      },
      {
        find: /^axios$/,
        replacement: path.join(viteModules, 'axios/index.js'),
      },
      // element-plus 和所有子路径
      {
        find: /^element-plus(\/.*)?$/,
        replacement: (match) => {
          const sub = match.replace('element-plus', '')
          return path.join(viteModules, 'element-plus', sub || 'es/index.mjs')
        },
      },
      {
        find: /^@element-plus\/icons-vue$/,
        replacement: path.join(viteModules, '@element-plus/icons-vue/dist/index.js'),
      },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: '../web2/dist-new',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@element-plus/icons-vue')) return 'vendor-element-icons'
          if (id.includes('element-plus')) return 'vendor-element-plus'
          if (id.includes('vue-router')) return 'vendor-vue-router'
          if (id.includes('pinia')) return 'vendor-pinia'
          if (id.includes('axios')) return 'vendor-axios'
          if (id.includes('vue')) return 'vendor-vue'
          return 'vendor'
        },
      },
    },
  },
})
