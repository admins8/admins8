<template>
  <div class="app-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航栏 -->
    <el-header class="app-header">
      <div class="header-left">
        <div class="logo" @click="router.push('/')">
          <template v-if="siteLogo">
            <el-image :src="siteLogo" fit="contain" class="logo-img" />
          </template>
          <template v-else>
            <el-icon :size="24"><Reading /></el-icon>
            <span v-if="siteTitle" class="logo-text">{{ siteTitle }}</span>
          </template>
        </div>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          :ellipsis="false"
          class="nav-menu"
          router
        >
          <el-menu-item index="/" class="mobile-main-nav-item">
            <el-icon><HomeFilled /></el-icon>
            <span>首页</span>
          </el-menu-item>
          <el-menu-item index="/girls" class="mobile-main-nav-item">
            <el-icon><Reading /></el-icon>
            <span class="desktop-label">女生频道</span>
            <span class="mobile-label">女频</span>
          </el-menu-item>
          <el-menu-item index="/library" class="mobile-main-nav-item">
            <el-icon><Collection /></el-icon>
            <span>书库</span>
          </el-menu-item>
          <el-menu-item index="/ranking" class="mobile-main-nav-item">
            <el-icon><TrendCharts /></el-icon>
            <span>排行榜</span>
          </el-menu-item>
          <el-menu-item v-if="authStore.canManageSources" index="/sources" class="mobile-extra-nav-item">
            <el-icon><Collection /></el-icon>
            <span>书源</span>
          </el-menu-item>
          <el-menu-item index="/bookshelf" class="mobile-main-nav-item">
            <el-icon><Reading /></el-icon>
            <span>我的书架</span>
          </el-menu-item>
        </el-menu>
      </div>
      <div class="header-right">
        <el-switch
          v-model="isDark"
          inline-prompt
          active-icon="Moon"
          inactive-icon="Sunny"
          class="theme-switch"
        />
        <template v-if="authStore.isLoggedIn">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :icon="UserFilled" />
              <span class="username">{{ authStore.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item v-if="authStore.isAdmin || authStore.permissions.length > 0" command="admin" divided>
                  <el-icon><Setting /></el-icon>管理后台
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <el-button @click="router.push('/login')">登录</el-button>
          <el-button type="primary" @click="router.push('/register')">注册</el-button>
        </template>
      </div>
    </el-header>

    <!-- 主内容区 -->
    <el-main class="app-main" :class="{ 'is-admin-route': activeMenu === '/admin' }">
      <router-view />
    </el-main>

    <footer v-if="copyright || icpNumber || friendlyLinks.length" class="app-footer">
      <div v-if="friendlyLinks.length" class="friendly-links">
        <span>友情链接：</span>
        <a
          v-for="link in friendlyLinks"
          :key="link.id || link.url"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ link.name }}
        </a>
      </div>
      <div class="footer-meta">
        <router-link v-for="page in contentPages" :key="page.slug" :to="`/${page.slug}`">{{ page.title }}</router-link>
        <span v-if="copyright">{{ copyright }}</span>
        <a
          v-if="icpNumber"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ icpNumber }}
        </a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { configApi, pageApi, type FriendlyLink } from '@/api'
import { configsToMap, setAnalyticsCode } from '@/utils/siteConfig'
import {
  Reading, HomeFilled, Collection, Setting,
  UserFilled, ArrowDown, User, SwitchButton, TrendCharts,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isDark = ref(false)
const siteLogo = ref('')
const siteTitle = ref('')
const copyright = ref('')
const icpNumber = ref('')
const friendlyLinks = ref<FriendlyLink[]>([])
const contentPages = ref<Array<{ slug: string; title: string }>>([])

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/admin')) return '/admin'
  if (path.startsWith('/sources')) return '/sources'
  if (path.startsWith('/bookshelf')) return '/bookshelf'
  if (path.startsWith('/library')) return '/library'
  if (path.startsWith('/girls') || path.startsWith('/home/girls.html')) return '/girls'
  if (path.startsWith('/read')) return '/'
  return path
})

watch(isDark, (val) => {
  document.documentElement.classList.toggle('dark', val)
})

watch(() => route.fullPath, () => {
  loadFriendlyLinks()
})

async function loadSiteLogo() {
  try {
    const res = await configApi.getPublicConfigs()
    const configMap = configsToMap(res.data || [])
    siteLogo.value = configMap.site_logo || ''
    siteTitle.value = configMap.site_title || ''
    copyright.value = configMap.copyright || ''
    icpNumber.value = configMap.icp_number || ''
    setAnalyticsCode(configMap.analytics_code || '')
  } catch {
    siteLogo.value = ''
    siteTitle.value = ''
    copyright.value = ''
    icpNumber.value = ''
  }
}

async function loadFriendlyLinks() {
  try {
    friendlyLinks.value = await pageApi.getFriendlyLinks()
  } catch {
    friendlyLinks.value = []
  }
}

async function loadContentPages() {
  try {
    contentPages.value = await pageApi.getContentPages()
  } catch {
    contentPages.value = []
  }
}

onMounted(() => {
  loadSiteLogo()
  loadFriendlyLinks()
  loadContentPages()
  window.addEventListener('focus', loadFriendlyLinks)
  window.addEventListener('friendly-links-updated', loadFriendlyLinks)
  window.addEventListener('content-pages-updated', loadContentPages)
  window.addEventListener('site-logo-updated', (e: any) => {
    siteLogo.value = e.detail
  })
  window.addEventListener('site-config-updated', (e: any) => {
    const configMap = e.detail || {}
    siteLogo.value = configMap.site_logo || ''
    siteTitle.value = configMap.site_title || ''
    copyright.value = configMap.copyright || ''
    icpNumber.value = configMap.icp_number || ''
    setAnalyticsCode(configMap.analytics_code || '')
  })
})

function handleCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'admin') {
    router.push('/admin')
  } else if (command === 'logout') {
    authStore.logout()
    router.push('/')
  }
}
</script>

<style scoped lang="scss">
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--el-color-primary);
  font-weight: 700;
  font-size: var(--app-font-size-title);
  height: 40px;

  .logo-text {
    background: linear-gradient(135deg, var(--el-color-primary), #67c23a);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .logo-img {
    height: 36px;
    max-width: 150px;
  }
}

.nav-menu {
  border-bottom: none !important;

  .el-menu-item {
    font-size: var(--app-font-size-base);
    height: 60px;
    line-height: 60px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.theme-switch {
  --el-switch-on-color: #1a1a2e;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  .username {
    font-size: var(--app-font-size-base);
    color: var(--el-text-color-primary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.app-main {
  flex: 1;
  padding: 20px 24px;
  background: var(--app-bg-color);
  min-height: calc(100vh - 108px);
}

.app-footer {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 24px;
  font-size: var(--app-font-size-base);
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);

  .friendly-links {
    width: min(1200px, 100%);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 14px;
    line-height: 1.8;
    text-align: left;
  }

  .footer-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  a {
    color: var(--el-text-color-secondary);
    text-decoration: none;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

@media (max-width: 1024px) {
  .app-header {
    padding: 0 16px;
  }

  .header-left {
    gap: 14px;
    min-width: 0;
  }

  .logo .logo-img {
    max-width: 120px;
  }

  .app-main {
    padding: 16px;
  }
}

.mobile-label {
  display: none;
}

@media (max-width: 1024px) {
  .app-container {
    width: 100vw;
    max-width: 100vw;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .app-header {
    height: auto;
    min-height: 96px;
    padding: 8px 10px 6px;
    gap: 6px 10px;
    flex-wrap: wrap;
  }

  .header-left {
    display: contents;
  }

  .logo {
    order: 1;
    flex: 1 1 auto;
    min-width: 0;
  }

  .nav-menu {
    order: 3;
    width: 100%;
    max-width: 100%;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    overflow-x: hidden;
    overflow-y: hidden;
    justify-content: stretch;

    :deep(.el-menu-item) {
      height: 42px;
      line-height: 42px;
      padding: 0 4px;
      font-size: 13px;
      justify-content: center;
      min-width: 0;
    }

    :deep(.mobile-extra-nav-item) {
      display: none;
    }
  }

  .desktop-label {
    display: none;
  }

  .mobile-label {
    display: inline;
  }

  .header-right {
    order: 2;
    width: auto;
    flex: 0 0 auto;
    justify-content: flex-end;
    gap: 8px;

    :deep(.el-button) {
      padding: 6px 9px;
      font-size: 13px;
    }
  }

  .user-info .username {
    max-width: 86px;
  }

  .app-main {
    width: 100vw;
    max-width: 100vw;
    box-sizing: border-box;
    padding: 12px;
    min-height: calc(100dvh - 128px);
    overflow-x: hidden;
  }

  .app-main.is-admin-route {
    padding: 0 !important;
  }

  .app-footer {
    padding: 10px 12px;
    font-size: 12px;
  }

  :deep(.el-dialog) {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px);
  }

  :deep(.el-drawer) {
    max-width: 92vw;
  }
}

@media (max-width: 480px) {
  .logo .logo-img {
    max-width: 96px;
  }

  .theme-switch {
    transform: scale(0.9);
  }
}
</style>
