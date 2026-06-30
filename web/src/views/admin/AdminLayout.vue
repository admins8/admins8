<!-- v1.0.4014 -->
<template>
  <div class="admin-dashboard">
    <button
      v-if="isMobileMenu"
      class="mobile-sidebar-toggle"
      :class="{ 'is-sidebar-open': mobileSidebarOpen }"
      type="button"
      aria-label="打开后台菜单"
      @click="mobileSidebarOpen = true"
    >
      <el-icon><Operation /></el-icon>
      <span>后台</span>
    </button>
    <div
      v-if="isMobileMenu && mobileSidebarOpen"
      class="mobile-sidebar-mask"
      @click="mobileSidebarOpen = false"
    />
    <div class="admin-layout">
      <!-- 左侧菜单 -->
      <aside class="admin-sidebar" :class="{ 'is-sidebar-open': mobileSidebarOpen }">
        <div class="sidebar-title">
          <el-icon><Setting /></el-icon>
          <span>管理后台</span>
          <button
            v-if="isMobileMenu"
            class="mobile-sidebar-close"
            type="button"
            aria-label="关闭后台菜单"
            @click="mobileSidebarOpen = false"
          >
            ×
          </button>
        </div>
        <el-button
          class="cache-clean-button"
          type="warning"
          plain
          :icon="Refresh"
          :loading="clearingCache"
          @click="handleClearCache"
        >
          清理缓存
        </el-button>
        <el-menu
          :default-active="activeMenu"
          :default-openeds="defaultOpeneds"
          :ellipsis="false"
          mode="vertical"
          :unique-opened="isMobileMenu"
          class="admin-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/admin/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>
          <el-sub-menu v-if="hasPermission('site_config')" index="site-config">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>网站配置</span>
            </template>
            <el-menu-item index="/admin/site-config/basic">
              <el-icon><Setting /></el-icon>
              <span>基础配置</span>
            </el-menu-item>
            <el-menu-item index="/admin/site-config/email">
              <el-icon><Message /></el-icon>
              <span>邮箱配置</span>
            </el-menu-item>
            <el-menu-item index="/admin/site-config/seo">
              <el-icon><Document /></el-icon>
              <span>SEO配置</span>
            </el-menu-item>
            <el-menu-item index="/admin/site-config/search-switch">
              <el-icon><Search /></el-icon>
              <span>搜索/换源配置</span>
            </el-menu-item>
            <el-menu-item v-if="isSuperAdmin" index="/admin/site-config/database">
              <el-icon><Files /></el-icon>
              <span>数据库管理</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('content_manage')" index="content">
            <template #title>
              <el-icon><HomeFilled /></el-icon>
              <span>内容管理</span>
            </template>
            <el-menu-item index="/admin/home-content">
              <el-icon><HomeFilled /></el-icon>
              <span>首页内容</span>
            </el-menu-item>
            <el-menu-item index="/admin/basic-data">
              <el-icon><Files /></el-icon>
              <span>基础数据</span>
            </el-menu-item>
            <el-menu-item index="/admin/ads">
              <el-icon><Picture /></el-icon>
              <span>广告管理</span>
            </el-menu-item>
            <el-menu-item index="/admin/content-cleaner">
              <el-icon><Document /></el-icon>
              <span>净化管理</span>
            </el-menu-item>
            <el-menu-item index="/admin/reading-settings">
              <el-icon><Reading /></el-icon>
              <span>阅读设置</span>
            </el-menu-item>
            <el-sub-menu index="page-manage">
              <template #title>
                <el-icon><Document /></el-icon>
                <span>页面管理</span>
              </template>
              <el-menu-item index="/admin/page-manage/female">
                <el-icon><Document /></el-icon>
                <span>女生频道</span>
              </el-menu-item>
              <el-menu-item index="/admin/page-manage/about">
                <el-icon><Document /></el-icon>
                <span>关于我们</span>
              </el-menu-item>
              <el-menu-item index="/admin/page-manage/contact">
                <el-icon><Document /></el-icon>
                <span>联系我们</span>
              </el-menu-item>
              <el-menu-item index="/admin/page-manage/agreement">
                <el-icon><Document /></el-icon>
                <span>用户协议</span>
              </el-menu-item>
              <el-menu-item index="/admin/page-manage/privacy">
                <el-icon><Document /></el-icon>
                <span>隐私政策</span>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item index="/admin/friendly-links">
              <el-icon><Link /></el-icon>
              <span>友情链接</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('book_manage')" index="book">
            <template #title>
              <el-icon><Reading /></el-icon>
              <span>书籍管理</span>
            </template>
            <el-menu-item index="/admin/books">
              <el-icon><Reading /></el-icon>
              <span>书籍列表</span>
            </el-menu-item>
            <el-menu-item index="/admin/book-categories">
              <el-icon><Files /></el-icon>
              <span>分类管理</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('source_manage')" index="source-manage">
            <template #title>
              <el-icon><Connection /></el-icon>
              <span>书源管理</span>
            </template>
            <el-menu-item index="/admin/sources/import">
              <el-icon><Upload /></el-icon>
              <span>书源导入</span>
            </el-menu-item>
            <el-menu-item index="/admin/sources/validate">
              <el-icon><CircleCheck /></el-icon>
              <span>一键验证</span>
            </el-menu-item>
            <el-menu-item index="/admin/sources/schedule">
              <el-icon><Calendar /></el-icon>
              <span>定时验证</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('plugin_manage')" index="plugin-manage">
            <template #title>
              <el-icon><Operation /></el-icon>
              <span>插件管理</span>
            </template>
            <el-menu-item index="/admin/plugins/collector">
              <el-icon><Operation /></el-icon>
              <span>采集插件</span>
            </el-menu-item>
            <el-menu-item index="/admin/plugins/baidu-push">
              <el-icon><Connection /></el-icon>
              <span>百度推送</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('user_manage')" index="user-manage">
            <template #title>
              <el-icon><User /></el-icon>
              <span>用户管理</span>
            </template>
            <el-menu-item index="/admin/users">
              <el-icon><User /></el-icon>
              <span>用户管理</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/reading">
              <el-icon><Reading /></el-icon>
              <span>阅读记录</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/searches">
              <el-icon><Search /></el-icon>
              <span>搜索记录</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/comments">
              <el-icon><Document /></el-icon>
              <span>评论记录</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/likes">
              <el-icon><Collection /></el-icon>
              <span>点赞记录</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/favorites">
              <el-icon><Star /></el-icon>
              <span>收藏记录</span>
            </el-menu-item>
            <el-menu-item index="/admin/user-records/checkins">
              <el-icon><Calendar /></el-icon>
              <span>签到记录</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('member_manage')" index="/admin/member">
            <template #title>
              <el-icon><UserFilled /></el-icon>
              <span>会员管理</span>
            </template>
            <el-menu-item index="/admin/member-manage">
              <span>会员套餐</span>
            </el-menu-item>
            <el-menu-item index="/admin/member-list">
              <span>会员名单</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-if="hasPermission('payment_manage')" index="/admin/payment">
            <template #title>
              <el-icon><CreditCard /></el-icon>
              <span>交易管理</span>
            </template>
            <el-menu-item index="/admin/payment-manage">
              <span>交易配置</span>
            </el-menu-item>
            <el-menu-item index="/admin/transaction-detail">
              <span>交易明细</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-if="hasPermission('app_manage')" index="/admin/app-manage">
            <el-icon><Operation /></el-icon>
            <span>APP管理</span>
          </el-menu-item>
          <el-menu-item v-if="hasPermission('system_upgrade')" index="/admin/system-update">
            <el-icon><Refresh /></el-icon>
            <span>系统升级
              <el-badge v-if="hasUpdate" is-dot type="danger" style="margin-left: 6px" />
            </span>
          </el-menu-item>
        </el-menu>
      </aside>

      <!-- 右侧内容 -->
      <main class="admin-content">
        <el-alert
          v-if="authStore.isTest"
          title="当前为测试账号，仅支持预览，不支持操作"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />
        <router-view :key="adminRouteViewKey" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { useAuthStore } from '@/store/auth'
import { Setting, DataAnalysis, User, Reading, HomeFilled, Files, Picture, Document, Refresh, Message, Search, Link, Star, Calendar, Collection, Connection, Upload, CircleCheck, Operation, CreditCard } from '@element-plus/icons-vue'
import { updateApi } from '@/api'
import { navigateAdminMenu } from './adminMenuNavigation'
import { buildAdminRouteViewKey } from './adminRouteViewKey'
import { clearAdminRuntimeCache } from './adminCacheCleaner'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)
const adminRouteViewKey = computed(() => buildAdminRouteViewKey(route.fullPath))
const hasUpdate = ref(false)
const clearingCache = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
const isMobileMenu = computed(() => viewportWidth.value <= 768)
const mobileSidebarOpen = ref(false)

// 当处于内容管理子页面时，默认展开内容管理
const defaultOpeneds = computed<string[]>(() => {
  if (route.path.startsWith('/admin/site-config')) {
    return ['site-config']
  }
  if (route.path.startsWith('/admin/basic-data') || route.path.startsWith('/admin/ads') || route.path.startsWith('/admin/home-content') || route.path.startsWith('/admin/content-cleaner') || route.path.startsWith('/admin/reading-settings') || route.path.startsWith('/admin/page-manage')) {
    return route.path.startsWith('/admin/page-manage') ? ['content', 'page-manage'] : ['content']
  }
  if (route.path.startsWith('/admin/books') || route.path.startsWith('/admin/book-categories') || route.path.startsWith('/admin/book-detail-seo')) {
    return ['book']
  }
  if (route.path.startsWith('/admin/sources')) {
    return ['source-manage']
  }
  if (route.path.startsWith('/admin/plugins')) {
    return ['plugin-manage']
  }
  if (route.path.startsWith('/admin/users') || route.path.startsWith('/admin/user-records')) {
    return ['user-manage']
  }
  return ['content']
})

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// 检查用户是否拥有指定权限（superadmin 拥有全部权限）
function hasPermission(permission: string): boolean {
  return authStore.isSuperAdmin || authStore.permissions.includes(permission)
}

const NOTICE_KEY = 'legado-update-notice-version'

async function handleMenuSelect(index: string) {
  try {
    await navigateAdminMenu(index, route.path, router)
    if (isMobileMenu.value) {
      mobileSidebarOpen.value = false
    }
  } catch (error) {
    console.error('[后台菜单] 跳转失败:', error)
  }
}

async function handleClearCache() {
  try {
    await ElMessageBox.confirm(
      '将清理后台运行缓存并刷新当前页面，不会退出登录。遇到菜单卡住、页面无反应或旧资源错误时可以使用。',
      '清理缓存',
      {
        confirmButtonText: '清理并刷新',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  clearingCache.value = true
  try {
    await clearAdminRuntimeCache()
    ElMessage.success('缓存已清理，正在刷新页面')
  } catch (error: any) {
    clearingCache.value = false
    ElMessage.error(`清理缓存失败：${error?.message || '未知错误'}`)
  }
}

async function checkUpdateBackground() {
  if (!isSuperAdmin.value) return
  try {
    const r = await updateApi.check()
    if (r.hasUpdate && r.latest) {
      hasUpdate.value = true
      const dismissed = localStorage.getItem(NOTICE_KEY)
      if (dismissed === r.latest) return
      ElNotification({
        title: `发现新版本 ${r.latest}`,
        dangerouslyUseHTMLString: true,
        message: `
          <div style="line-height:1.6">
            <div>当前版本：${r.current}</div>
            ${r.release?.changelog ? `<div style="margin-top:6px;color:#666">${r.release.changelog}</div>` : ''}
            <div style="margin-top:8px"><a href="javascript:void(0)" id="legado-update-go">前往升级 →</a></div>
          </div>
        `,
        type: 'success',
        duration: 0,
        onClose() {
          localStorage.setItem(NOTICE_KEY, r.latest!)
        },
      })
      // 给链接绑定路由跳转
      setTimeout(() => {
        const a = document.getElementById('legado-update-go')
        if (a) a.addEventListener('click', () => router.push('/admin/system-update'))
      }, 50)
    } else {
      hasUpdate.value = false
    }
  } catch {
    // 静默
  }
}

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
  if (!isMobileMenu.value) {
    mobileSidebarOpen.value = false
  }
}

onMounted(() => {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth, { passive: true })
  checkUpdateBackground()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<style scoped lang="scss">
.admin-dashboard {
  min-height: calc(100vh - 100px);
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  overflow-x: hidden;
}

.admin-layout {
  display: flex;
  align-items: flex-start;
  min-height: calc(100vh - 100px);
  gap: 18px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.admin-sidebar {
  width: 236px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  padding: 14px 10px;
  box-sizing: border-box;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  position: sticky;
  top: 76px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;

  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    padding: 8px 12px 14px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    margin-bottom: 10px;
  }

  .cache-clean-button {
    width: calc(100% - 8px);
    margin: 0 4px 12px;
    border-radius: 10px;
    font-weight: 600;
  }

  .admin-menu {
    border-right: none;
    background: transparent;

    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
      height: 38px;
      line-height: 38px;
      border-radius: 8px;
      margin: 2px 0;
      padding-right: 10px;
    }

    :deep(.el-sub-menu .el-menu-item) {
      height: 36px;
      line-height: 36px;
      min-width: 0;
      padding-left: 36px !important;
      font-size: 13px;
    }

    :deep(.el-menu-item.is-active) {
      background: var(--el-color-primary-light-9);
      font-weight: 600;
    }
  }
}

.admin-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;

  :deep(.el-table) {
    min-width: 720px;
  }
}

.mobile-sidebar-toggle,
.mobile-sidebar-mask,
.mobile-sidebar-close {
  display: none;
}

@media (max-width: 1024px) {
  .admin-dashboard {
    height: auto;
    min-height: calc(100vh - 96px);
  }

  .admin-layout {
    gap: 12px;
  }

  .admin-sidebar {
    width: 208px;
    padding: 12px;
  }

  .admin-content {
    padding: 0;
  }
}

@media (max-width: 768px) {
  :global(html),
  :global(body) {
    max-width: 100%;
    overflow-x: hidden;
  }

  .admin-dashboard {
    min-height: calc(100vh - 120px);
    padding: 0 4px;
  }

  .admin-layout {
    display: block;
    min-height: 0;
    gap: 0;
  }

  .mobile-sidebar-toggle {
    position: fixed;
    left: 0;
    top: 50%;
    z-index: 2100;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 42px;
    min-height: 76px;
    padding: 8px 6px;
    border: 1px solid var(--el-color-primary-light-5);
    border-left: none;
    border-radius: 0 14px 14px 0;
    background: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
    transform: translateY(-50%);
    transition: transform 0.22s ease, opacity 0.22s ease;

    span {
      writing-mode: vertical-rl;
      letter-spacing: 2px;
      font-size: 12px;
      line-height: 1;
    }

    &.is-sidebar-open {
      transform: translate(-60px, -50%);
      opacity: 0;
      pointer-events: none;
    }
  }

  .mobile-sidebar-mask {
    position: fixed;
    inset: 0;
    z-index: 2090;
    display: block;
    background: rgba(15, 23, 42, 0.42);
    backdrop-filter: blur(1px);
  }

  .admin-sidebar {
    position: fixed;
    top: 0;
    left: -320px;
    z-index: 2101;
    width: min(82vw, 286px);
    max-width: 286px;
    height: 100vh;
    max-height: 100vh;
    padding: 14px 10px 18px;
    border-radius: 0 18px 18px 0;
    overflow-y: auto;
    box-shadow: 12px 0 32px rgba(15, 23, 42, 0.22);
    transition: left 0.24s ease;
    -webkit-overflow-scrolling: touch;

    &.is-sidebar-open {
      left: 0 !important;
    }

    .sidebar-title {
      display: flex;
      position: sticky;
      top: -14px;
      z-index: 1;
      background: var(--el-bg-color);
      padding-top: 12px;
      margin-top: -12px;
    }

    .cache-clean-button {
      width: calc(100% - 8px);
      margin: 0 4px 12px;
      height: 38px;
    }

    .admin-menu {
      width: 100%;
      border-bottom: none;
      overflow: visible;
      white-space: normal;

      :deep(.el-menu-item),
      :deep(.el-sub-menu__title) {
        height: 40px;
        line-height: 40px;
        margin: 2px 0;
        border-radius: 10px;
      }

      :deep(.el-sub-menu .el-menu-item) {
        height: 38px;
        line-height: 38px;
        padding-left: 38px !important;
      }

      :deep(.el-menu-item .el-icon),
      :deep(.el-sub-menu__title .el-icon) {
        margin-right: 4px;
      }
    }
  }

  .mobile-sidebar-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    margin-left: auto;
    border: none;
    border-radius: 999px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-size: 22px;
    line-height: 1;
  }

  .admin-content {
    width: 100%;
    max-width: 100%;
    padding: 0;
    border-radius: 0;
    overflow-x: auto;

    :deep(.el-card) {
      border-radius: 10px;
    }

    :deep(.el-card__header) {
      padding: 10px 4px !important;
    }

    :deep(.el-card__body) {
      padding: 10px 4px !important;
    }

    :deep(.el-table__inner-wrapper) {
      overflow-x: auto;
    }

    :deep(.el-table) {
      width: 100%;
      min-width: 640px;
    }

    :deep(.el-form-item) {
      margin-bottom: 12px;
    }

    :deep(.el-form-item__label) {
      padding-right: 6px;
    }

    :deep(.el-pagination) {
      justify-content: center;
      white-space: normal;
    }
  }
}
</style>
