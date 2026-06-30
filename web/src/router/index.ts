import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { clearDynamicImportReloadFlag, recoverFromDynamicImportLoadError } from './chunkErrorRecovery'

// v1.0.4014 - cache bust
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/bookshelf',
    name: 'BookShelf',
    component: () => import('@/views/BookShelf.vue'),
    meta: { title: '我的书架' },
  },
  {
    path: '/ranking',
    name: 'Ranking',
    component: () => import('@/views/RankingView.vue'),
    meta: { title: '排行榜' },
  },
  {
    path: '/girls',
    name: 'FemaleChannel',
    component: () => import('@/views/FemaleChannel.vue'),
    meta: { title: '女生频道' },
  },
  {
    path: '/library',
    name: 'LocalLibrary',
    component: () => import('@/views/LocalLibrary.vue'),
    meta: { title: '书库' },
  },
  {
    path: '/home/girls.html',
    name: 'FemaleChannelCompat',
    component: () => import('@/views/FemaleChannel.vue'),
    meta: { title: '女生频道' },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { title: '注册' },
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { title: '找回密码' },
  },
  {
    path: '/read/:bookUrl',
    name: 'Reader',
    component: () => import('@/views/Reader.vue'),
    meta: { title: '阅读' },
  },
  {
    path: '/book-detail',
    name: 'BookDetail',
    component: () => import('@/views/BookDetail.vue'),
    meta: { title: '书籍详情' },
  },
  {
    path: '/sources',
    name: 'SourceList',
    component: () => import('@/views/SourceList.vue'),
    meta: { title: '书源管理', requiresAuth: true, requiresPermission: 'source_manage' },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '个人中心', requiresAuth: true },
  },
  {
    path: '/member',
    name: 'MemberCenter',
    component: () => import('@/views/MemberCenter.vue'),
    meta: { title: '会员中心', requiresAuth: true },
  },
  {
    path: '/member/purchase',
    name: 'MemberPurchase',
    component: () => import('@/views/MemberPurchase.vue'),
    meta: { title: '开通会员', requiresAuth: true },
  },
  {
    path: '/about',
    name: 'AboutPage',
    component: () => import('@/views/StaticPage.vue'),
    meta: { title: '关于我们', slug: 'about' },
  },
  {
    path: '/contact',
    name: 'ContactPage',
    component: () => import('@/views/StaticPage.vue'),
    meta: { title: '联系我们', slug: 'contact' },
  },
  {
    path: '/agreement',
    name: 'AgreementPage',
    component: () => import('@/views/StaticPage.vue'),
    meta: { title: '用户协议', slug: 'agreement' },
  },
  {
    path: '/privacy',
    name: 'PrivacyPage',
    component: () => import('@/views/StaticPage.vue'),
    meta: { title: '隐私政策', slug: 'privacy' },
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { title: '管理后台', requiresAuth: true, requiresAdmin: true },
    redirect: '/admin/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'AdminStats',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '仪表盘', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'site-config',
        redirect: '/admin/site-config/basic',
      },
      {
        path: 'site-config/basic',
        name: 'AdminSiteBasicConfig',
        component: () => import('@/views/admin/site-config/BasicConfig.vue'),
        meta: { title: '基础配置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'site-config/email',
        name: 'AdminSiteEmailConfig',
        component: () => import('@/views/admin/site-config/EmailConfig.vue'),
        meta: { title: '邮箱配置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'site-config/seo',
        name: 'AdminSiteSeoConfig',
        component: () => import('@/views/admin/site-config/SeoConfig.vue'),
        meta: { title: 'SEO配置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'site-config/search-switch',
        name: 'AdminSearchSwitchConfig',
        component: () => import('@/views/admin/site-config/SearchSwitchConfig.vue'),
        meta: { title: '搜索/换源配置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'site-config/database',
        name: 'AdminSiteDatabaseManage',
        component: () => import('@/views/admin/site-config/DatabaseManage.vue'),
        meta: { title: '数据库管理', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'home-content',
        name: 'AdminHomeContent',
        component: () => import('@/views/admin/HomeContent.vue'),
        meta: { title: '首页内容', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'basic-data',
        name: 'AdminBasicData',
        component: () => import('@/views/admin/BasicData.vue'),
        meta: { title: '基础数据', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'ads',
        name: 'AdminAds',
        component: () => import('@/views/admin/AdManage.vue'),
        meta: { title: '广告管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'content-cleaner',
        name: 'AdminContentCleaner',
        component: () => import('@/views/admin/ContentCleanerManage.vue'),
        meta: { title: '净化管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'reading-settings',
        name: 'AdminReadingSettings',
        component: () => import('@/views/admin/ReadingSettings.vue'),
        meta: { title: '阅读设置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'page-manage/female',
        name: 'AdminFemaleChannelManage',
        component: () => import('@/views/admin/page-manage/FemaleChannelManage.vue'),
        meta: { title: '女生频道', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'page-manage/about',
        name: 'AdminAboutPageManage',
        component: () => import('@/views/admin/page-manage/StaticPageManage.vue'),
        meta: { title: '关于我们', slug: 'about', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'page-manage/contact',
        name: 'AdminContactPageManage',
        component: () => import('@/views/admin/page-manage/StaticPageManage.vue'),
        meta: { title: '联系我们', slug: 'contact', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'page-manage/agreement',
        name: 'AdminAgreementPageManage',
        component: () => import('@/views/admin/page-manage/StaticPageManage.vue'),
        meta: { title: '用户协议', slug: 'agreement', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'page-manage/privacy',
        name: 'AdminPrivacyPageManage',
        component: () => import('@/views/admin/page-manage/StaticPageManage.vue'),
        meta: { title: '隐私政策', slug: 'privacy', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'friendly-links',
        name: 'AdminFriendlyLinks',
        component: () => import('@/views/admin/FriendlyLinkManage.vue'),
        meta: { title: '友情链接', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'sources',
        redirect: '/admin/sources/import',
      },
      {
        path: 'sources/import',
        name: 'AdminSourceImport',
        component: () => import('@/views/SourceList.vue'),
        meta: { title: '书源导入', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'sources/validate',
        name: 'AdminSourceValidate',
        component: () => import('@/views/SourceList.vue'),
        meta: { title: '一键验证', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'sources/schedule',
        name: 'AdminSourceValidationSchedule',
        component: () => import('@/views/admin/SourceValidationSchedule.vue'),
        meta: { title: '定时验证', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'books',
        name: 'AdminBooks',
        component: () => import('@/views/admin/BookManage.vue'),
        meta: { title: '书籍管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'book-categories',
        name: 'AdminBookCategories',
        component: () => import('@/views/admin/CategoryManage.vue'),
        meta: { title: '分类管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'plugins',
        redirect: '/admin/plugins/collector',
      },
      {
        path: 'plugins/collector',
        name: 'AdminPlugins',
        component: () => import('@/views/admin/PluginManage.vue'),
        meta: { title: '采集插件', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'book-detail-seo',
        name: 'AdminBookDetailSeo',
        redirect: '/admin/site-config/seo',
        meta: { title: '详情页管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/UserManage.vue'),
        meta: { title: '用户管理', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/reading',
        name: 'AdminUserReadingRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '阅读记录', recordType: 'reading', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/searches',
        name: 'AdminUserSearchRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '搜索记录', recordType: 'searches', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/comments',
        name: 'AdminUserCommentRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '评论记录', recordType: 'comments', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/likes',
        name: 'AdminUserLikeRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '点赞记录', recordType: 'likes', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/favorites',
        name: 'AdminUserFavoriteRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '收藏记录', recordType: 'favorites', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'user-records/checkins',
        name: 'AdminUserCheckinRecords',
        component: () => import('@/views/admin/user-records/UserRecordList.vue'),
        meta: { title: '签到记录', recordType: 'checkins', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'system-update',
        name: 'AdminSystemUpdate',
        component: () => import('@/views/admin/SystemUpdate.vue'),
        meta: { title: '系统升级', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'app-manage',
        name: 'AdminAppManage',
        component: () => import('@/views/admin/AppManage.vue'),
        meta: { title: 'APP管理', requiresAuth: true, requiresSuperAdmin: true },
      },
      {
        path: 'member-manage',
        name: 'AdminMemberManage',
        component: () => import('@/views/admin/MemberManage.vue'),
        meta: { title: '会员套餐', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'member-list',
        name: 'AdminMemberList',
        component: () => import('@/views/admin/MemberList.vue'),
        meta: { title: '会员名单', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'payment-manage',
        name: 'AdminPaymentManage',
        component: () => import('@/views/admin/PaymentManage.vue'),
        meta: { title: '交易配置', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'transaction-detail',
        name: 'AdminTransactionDetail',
        component: () => import('@/views/admin/TransactionDetail.vue'),
        meta: { title: '交易明细', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'plugins/baidu-push',
        name: 'AdminBaiduPush',
        component: () => import('@/views/admin/BaiduPushPlugin.vue'),
        meta: { title: '百度推送', requiresAuth: true, requiresAdmin: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 从 token 解析角色的辅助函数
function getRoleFromToken(): string | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role || null
  } catch {
    return null
  }
}

function getPermissionsFromToken(): string[] {
  const token = localStorage.getItem('token')
  if (!token) return []
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Array.isArray(payload.permissions) ? payload.permissions : []
  } catch {
    return []
  }
}

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  document.title = String(to.meta.title || '')

  const authStore = useAuthStore()
  const tokenRole = getRoleFromToken()
  const tokenPermissions = getPermissionsFromToken()

  // 需要登录的页面
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 需要管理员权限的页面（有后台权限的普通用户也可访问）
  if (to.meta.requiresAdmin) {
    const isAdmin = tokenRole === 'admin' || tokenRole === 'superadmin' || authStore.isAdmin
    const hasAnyAdminPermission = tokenPermissions.length > 0 || authStore.permissions.length > 0
    if (!isAdmin && !hasAnyAdminPermission) {
      next({ name: 'BookShelf' })
      return
    }
  }

  // 需要超级管理员权限的页面（admin和superadmin都可访问，后端再做权限验证）
  if (to.meta.requiresSuperAdmin) {
    const isSuperAdmin = tokenRole === 'superadmin' || authStore.isSuperAdmin
    const isAdmin = tokenRole === 'admin' || authStore.isAdmin
    if (!isSuperAdmin && !isAdmin) {
      next({ name: 'AdminStats' })
      return
    }
  }

  if (to.meta.requiresPermission) {
    const permission = String(to.meta.requiresPermission)
    const hasPermission = tokenRole === 'admin' ||
      tokenRole === 'superadmin' ||
      authStore.isAdmin ||
      tokenPermissions.includes(permission) ||
      authStore.permissions.includes(permission)
    if (!hasPermission) {
      next({ name: 'BookShelf' })
      return
    }
  }

  next()
})

router.afterEach(() => {
  clearDynamicImportReloadFlag()
})

router.onError((error) => {
  recoverFromDynamicImportLoadError(error)
})

export default router
