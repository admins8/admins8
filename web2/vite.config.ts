import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import http from 'node:http'

type SiteConfigMap = Record<string, string>

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJsonForHtml(value: SiteConfigMap): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function renderSeoTemplate(template: string, configs: SiteConfigMap): string {
  const year = String(new Date().getFullYear())
  return String(template || '')
    .replace(/\{siteName\}/g, configs.site_title || '搜书网')
    .replace(/\{网站名\}/g, configs.site_title || '搜书网')
    .replace(/\{年份\}/g, year)
    .replace(/\{year\}/g, year)
}

function fetchSiteConfig(): Promise<SiteConfigMap> {
  const apiBase = process.env.SITE_CONFIG_API_BASE || process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001'
  return new Promise((resolve) => {
    const req = http.get(`${apiBase}/api/config/public/all`, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          const map = (json.data || []).reduce((acc: SiteConfigMap, item: any) => {
            acc[item.config_key] = item.config_value || ''
            return acc
          }, {})
          resolve(map)
        } catch {
          resolve({})
        }
      })
    })
    req.on('error', () => resolve({}))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve({})
    })
  })
}

function injectSiteMeta(html: string, configs: SiteConfigMap): string {
  const title = escapeHtml(renderSeoTemplate(configs.home_title || configs.site_title || '', configs))
  const keywords = escapeHtml(renderSeoTemplate(configs.home_keywords || '', configs))
  const description = escapeHtml(renderSeoTemplate(configs.home_description || '', configs))
  const webDomain = escapeHtml(configs.web_domain || '')
  const wapDomain = escapeHtml(configs.wap_domain || '')
  const icpNumber = escapeHtml(configs.icp_number || '')
  const copyright = escapeHtml(configs.copyright || '')
  const configJson = escapeJsonForHtml(configs)

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${keywords}" />`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`)
    .replace(/<meta\s+name="web_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="web_domain" content="${webDomain}" />`)
    .replace(/<meta\s+name="wap_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="wap_domain" content="${wapDomain}" />`)
    .replace(/<meta\s+name="icp_number"\s+content="[^"]*"\s*\/?>/i, `<meta name="icp_number" content="${icpNumber}" />`)
    .replace(/<meta\s+name="copyright"\s+content="[^"]*"\s*\/?>/i, `<meta name="copyright" content="${copyright}" />`)
    .replace(/<script\s+id="site-config-json"\s+type="application\/json">[\s\S]*?<\/script>/i, `<script id="site-config-json" type="application/json">${configJson}</script>`)
}

export default defineConfig({
  plugins: [
    {
      name: 'site-config-html-meta',
      async transformIndexHtml(html) {
        const configs = await fetchSiteConfig()
        return injectSiteMeta(html, configs)
      },
    },
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.headers.host) {
              proxyReq.setHeader('Host', req.headers.host)
            }
            // Forward all original headers including Authorization
            const auth = req.headers['authorization'];
            if (auth) {
              proxyReq.setHeader('Authorization', auth);
            }
          });
        },
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: false,
      },
    },
  },
  build: {
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
