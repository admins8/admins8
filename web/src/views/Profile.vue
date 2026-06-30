<template>
  <div class="profile-page">
    <!-- 用户信息横幅 -->
    <div class="profile-banner">
      <el-avatar :size="64" :icon="UserFilled" class="banner-avatar" />
      <div class="banner-meta">
        <h2>{{ authStore.user?.username }}</h2>
        <div class="banner-tags">
          <el-tag :type="authStore.isAdmin ? 'danger' : 'info'" size="small">
            {{ authStore.isAdmin ? '管理员' : '普通用户' }}
          </el-tag>
          <el-tag
            v-if="authStore.user?.isMember"
            :type="memberTagType"
            size="small"
            effect="dark"
            style="margin-left: 8px"
          >
            {{ memberBadge }}
          </el-tag>
        </div>
      </div>
      <el-button
        class="banner-checkin-btn"
        :type="checkinStatus.checkedInToday ? 'success' : 'warning'"
        plain
        :loading="checkingIn"
        @click="handleCheckin"
      >
        {{ checkinStatus.checkedInToday ? '今日已签到' : '签到' }}
      </el-button>
    </div>

    <!-- 主体：左侧菜单 + 右侧内容 -->
    <div class="profile-body">
      <aside class="profile-sidebar">
        <el-menu :default-active="activeMenu" @select="onMenuSelect">
          <el-menu-item index="info">
            <el-icon><User /></el-icon>
            <span>个人信息</span>
          </el-menu-item>
          <el-menu-item index="follows">
            <el-icon><Star /></el-icon>
            <span>我的关注</span>
          </el-menu-item>
          <el-menu-item index="collection">
            <el-icon><Collection /></el-icon>
            <span>我的收藏</span>
          </el-menu-item>
          <el-menu-item index="stats">
            <el-icon><TrendCharts /></el-icon>
            <span>阅读统计</span>
          </el-menu-item>
          <el-menu-item index="checkin">
            <el-icon><Calendar /></el-icon>
            <span>签到记录</span>
          </el-menu-item>
          <el-menu-item index="member" class="member-menu-item">
            <el-icon><Medal /></el-icon>
            <span>会员中心</span>
          </el-menu-item>
          <el-menu-item v-if="authStore.isAdmin" index="admin" class="admin-menu-item">
            <el-icon><Setting /></el-icon>
            <span>后台管理</span>
          </el-menu-item>
          <div class="sidebar-divider" />
          <el-menu-item index="logout" class="logout-menu-item">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <main class="profile-content">
        <!-- ========== 个人信息 ========== -->
        <div v-show="activeMenu === 'info'" class="content-panel">
          <h3 class="panel-title">个人信息</h3>
          <div class="info-card">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="用户名">
                {{ authStore.user?.username }}
              </el-descriptions-item>
              <el-descriptions-item label="邮箱">
                {{ authStore.user?.email || '未设置' }}
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">
                {{ formatDate(authStore.user?.createdAt || authStore.user?.created_at) }}
              </el-descriptions-item>
              <el-descriptions-item label="角色">
                <el-tag :type="authStore.isAdmin ? 'danger' : 'info'" size="small">
                  {{ authStore.isAdmin ? '管理员' : '普通用户' }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <h3 class="panel-title" style="margin-top: 28px">修改邮箱</h3>
          <div class="info-card">
            <el-form
              ref="profileFormRef"
              :model="profileForm"
              :rules="profileRules"
              label-width="80px"
            >
              <el-form-item label="邮箱" prop="email">
                <el-input v-model="profileForm.email" placeholder="请输入邮箱" style="max-width: 400px" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="updatingProfile" @click="handleUpdateProfile">
                  保存修改
                </el-button>
              </el-form-item>
            </el-form>
          </div>

          <h3 class="panel-title" style="margin-top: 28px">修改密码</h3>
          <div class="info-card">
            <el-form
              ref="passwordFormRef"
              :model="passwordForm"
              :rules="passwordRules"
              label-width="100px"
            >
              <el-form-item label="当前密码" prop="oldPassword">
                <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" show-password style="max-width: 400px" />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password style="max-width: 400px" />
              </el-form-item>
              <el-form-item label="确认新密码" prop="confirmPassword">
                <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password style="max-width: 400px" />
              </el-form-item>
              <el-form-item>
                <el-button type="warning" :loading="changingPassword" @click="handleChangePassword">
                  修改密码
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>

        <!-- ========== 我的关注 ========== -->
        <div v-show="activeMenu === 'follows'" class="content-panel">
          <h3 class="panel-title">我的关注 <span v-if="followedAuthors.length" class="card-count">{{ followedAuthors.length }}位作者</span></h3>
          <div v-if="followedAuthorsLoading" class="card-loading">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else-if="followedAuthors.length" class="author-list">
            <div v-for="item in followedAuthors" :key="item.name" class="author-item">
              <div class="author-info">
                <div class="author-avatar-sm">{{ item.name.charAt(0) }}</div>
                <div>
                  <div class="author-name-text">{{ item.name }}</div>
                  <div class="author-meta">{{ item.followerCount }}粉丝 · 关注于 {{ formatDate(item.followedAt) }}</div>
                </div>
              </div>
              <el-button size="small" round @click="searchAuthorBooks(item.name)">
                <el-icon><Search /></el-icon> 查看作品
              </el-button>
            </div>
          </div>
          <el-empty v-else description="还没有关注作者" :image-size="80" />
        </div>

        <!-- ========== 我的收藏 ========== -->
        <div v-show="activeMenu === 'collection'" class="content-panel">
          <h3 class="panel-title">我的收藏 <span v-if="bookStore.shelf.length" class="card-count">{{ bookStore.shelf.length }}本书</span></h3>
          <div v-if="bookStore.shelf.length" class="shelf-list">
            <div v-for="item in bookStore.shelf.slice(0, 20)" :key="item.bookUrl" class="shelf-item" @click="goToBook(item)">
              <img :src="resolveBookCover(item.coverUrl || item.cover_url, item.name || item.bookName, item.author, siteTitle)" class="shelf-cover" @error="onCoverError" />
              <div class="shelf-info">
                <div class="shelf-name">{{ item.name || item.bookName }}</div>
                <div class="shelf-author">{{ item.author }}</div>
              </div>
            </div>
            <div v-if="bookStore.shelf.length > 20" class="shelf-more" @click="router.push('/')">
              查看全部 {{ bookStore.shelf.length }} 本
            </div>
          </div>
          <el-empty v-else description="书架空空如也" :image-size="80" />
        </div>

        <!-- ========== 阅读统计 ========== -->
        <div v-show="activeMenu === 'stats'" class="content-panel">
          <h3 class="panel-title">阅读统计</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ bookStore.shelf.length }}</div>
              <div class="stat-label">书架书籍</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ finishedCount }}</div>
              <div class="stat-label">已读完</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ bookStore.fontSize }}px</div>
              <div class="stat-label">当前字号</div>
            </div>
          </div>
        </div>

        <!-- ========== 签到记录 ========== -->
        <div v-show="activeMenu === 'checkin'" class="content-panel">
          <div class="checkin-head">
            <div>
              <h3 class="panel-title">签到记录</h3>
              <p class="checkin-desc">查看本月签到情况，已签到和未签到日期会用不同颜色区分。</p>
            </div>
            <div class="calendar-switch">
              <el-button size="small" plain @click="changeCheckinMonth(-1)">上月</el-button>
              <span>{{ currentMonthText }}</span>
              <el-button size="small" plain @click="changeCheckinMonth(1)">下月</el-button>
            </div>
          </div>
          <div class="stats-grid checkin-stats">
            <div class="stat-item">
              <div class="stat-value">{{ checkinStatus.totalDays }}</div>
              <div class="stat-label">累计签到</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ checkinStatus.totalPoints }}</div>
              <div class="stat-label">累计积分</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ checkinStatus.today || '-' }}</div>
              <div class="stat-label">今日日期</div>
            </div>
          </div>
          <div class="checkin-legend">
            <span><i class="legend-dot signed" />已签到</span>
            <span><i class="legend-dot unsigned" />未签到</span>
            <span><i class="legend-dot today" />今日</span>
          </div>
          <div class="checkin-calendar">
            <div v-for="week in weekLabels" :key="week" class="weekday">{{ week }}</div>
            <div
              v-for="day in calendarDays"
              :key="day.key"
              class="calendar-day"
              :class="{
                empty: !day.date,
                signed: day.signed,
                unsigned: day.date && !day.signed,
                today: day.isToday,
              }"
            >
              <template v-if="day.date">
                <strong>{{ day.day }}</strong>
                <span>{{ day.signed ? '已签' : '未签' }}</span>
              </template>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useBookStore } from '@/store/book'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  UserFilled, SwitchButton, Search, Loading,
  User, Star, Collection, TrendCharts, Calendar, Setting, Medal,
} from '@element-plus/icons-vue'
import { userApi, bookApi, unwrapResponse, type CheckinMonth, type CheckinStatus } from '@/api'
import { resolveBookCover } from '@/utils/bookCover'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const bookStore = useBookStore()

const activeMenu = ref('info')

const memberTagType = computed(() => {
  const type = authStore.user?.membership_type
  if (type === 'yearly') return 'danger'
  if (type === 'quarterly') return 'warning'
  return 'success'
})

const memberBadge = computed(() => {
  const type = authStore.user?.membership_type
  const map: Record<string, string> = { monthly: '月会员', quarterly: '季会员', yearly: '年会员' }
  return map[type || ''] || '会员'
})

function onMenuSelect(index: string) {
  if (index === 'logout') {
    handleLogout()
    return
  }
  if (index === 'admin') {
    router.push('/admin')
    return
  }
  if (index === 'member') {
    router.push('/member')
    return
  }
  activeMenu.value = index
}

// ---- Forms ----
const profileFormRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()
const updatingProfile = ref(false)
const changingPassword = ref(false)
const checkingIn = ref(false)

const profileForm = reactive({
  email: authStore.user?.email || '',
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const profileRules: FormRules = {
  email: [{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
}

const validateConfirmPassword = (_rule: any, value: string, callback: Function) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

// ---- Checkin ----
const currentMonth = ref(getMonthString())
const checkinStatus = ref<CheckinStatus>({
  today: '',
  checkedInToday: false,
  totalDays: 0,
  totalPoints: 0,
})
const checkinMonth = ref<CheckinMonth>({
  month: currentMonth.value,
  start: '',
  end: '',
  records: [],
})
const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

const currentMonthText = computed(() => {
  const [year, month] = currentMonth.value.split('-')
  return `${year}年${Number(month)}月`
})

const signedDates = computed(() => new Set(checkinMonth.value.records.map(item => item.checkinDate)))

const calendarDays = computed(() => {
  const [year, month] = currentMonth.value.split('-').map(Number)
  const firstDate = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ key: string; date: string; day: number; signed: boolean; isToday: boolean }> = []
  for (let i = 0; i < firstDate.getDay(); i += 1) {
    cells.push({ key: `empty-${i}`, date: '', day: 0, signed: false, isToday: false })
  }
  const today = checkinStatus.value.today || getDateString(new Date())
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`
    cells.push({
      key: date,
      date,
      day,
      signed: signedDates.value.has(date),
      isToday: date === today,
    })
  }
  return cells
})

// ---- Follows ----
const followedAuthors = ref<{ name: string; followedAt: string; followerCount: number }[]>([])
const followedAuthorsLoading = ref(false)

// ---- Stats ----
const finishedCount = computed(() => {
  return bookStore.shelf.filter(
    (b) => b.durChapterIndex != null && b.totalChapterNum != null && b.durChapterIndex >= b.totalChapterNum - 1
  ).length
})

// ---- Helpers ----
function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function getDateString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function getMonthString(date = new Date()) {
  return getDateString(date).slice(0, 7)
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '未知'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function searchAuthorBooks(authorName: string) {
  const routeData = router.resolve({ path: '/', query: { keyword: authorName } })
  window.open(routeData.href, '_self')
}

function goToBook(item: any) {
  const bookUrl = item.bookUrl || item.book_url
  const sourceUrl = item.origin || item.sourceUrl || item.source_url
  if (bookUrl) {
    router.push({ name: 'BookDetail', query: { bookUrl, sourceUrl: sourceUrl || undefined } })
  }
}

function getCover(url: string) {
  return url || '/placeholder-book.png'
}

function onCoverError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = '/placeholder-book.png'
}

// ---- Actions ----
async function handleUpdateProfile() {
  const valid = await profileFormRef.value?.validate().catch(() => false)
  if (!valid) return

  updatingProfile.value = true
  try {
    await authStore.updateProfile({ email: profileForm.email })
    ElMessage.success('信息更新成功')
  } catch (err: any) {
    ElMessage.error(err?.message || '更新失败')
  } finally {
    updatingProfile.value = false
  }
}

async function handleChangePassword() {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid) return

  changingPassword.value = true
  try {
    await authStore.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    ElMessage.success('密码修改成功')
    Object.assign(passwordForm, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '密码修改失败，请检查当前密码')
  } finally {
    changingPassword.value = false
  }
}

function handleLogout() {
  ElMessageBox.confirm('确定退出登录？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    authStore.logout()
    router.push('/')
    ElMessage.success('已退出登录')
  }).catch(() => {})
}

async function loadCheckinStatus() {
  try {
    checkinStatus.value = unwrapResponse<CheckinStatus>(await userApi.getCheckinStatus())
  } catch {
    checkinStatus.value = {
      today: '',
      checkedInToday: false,
      totalDays: 0,
      totalPoints: 0,
    }
  }
}

async function loadCheckinMonth() {
  try {
    checkinMonth.value = unwrapResponse<CheckinMonth>(await userApi.getCheckinMonth(currentMonth.value))
  } catch {
    checkinMonth.value = {
      month: currentMonth.value,
      start: '',
      end: '',
      records: [],
    }
  }
}

async function changeCheckinMonth(offset: number) {
  const [year, month] = currentMonth.value.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  currentMonth.value = getMonthString(date)
  await loadCheckinMonth()
}

async function handleCheckin() {
  if (checkinStatus.value.checkedInToday) {
    ElMessage.info('今日已签到')
    return
  }
  checkingIn.value = true
  try {
    const data = unwrapResponse<CheckinStatus>(await userApi.checkin())
    checkinStatus.value = data
    window.dispatchEvent(new CustomEvent('checkin-updated', { detail: data }))
    await loadCheckinMonth()
    ElMessage.success(data.alreadyChecked ? '今日已签到' : `签到成功，获得 ${data.pointsEarned || 0} 积分`)
  } catch {
    ElMessage.error('签到失败')
  } finally {
    checkingIn.value = false
  }
}

async function loadFollowedAuthors() {
  followedAuthorsLoading.value = true
  try {
    const data = unwrapResponse(await bookApi.getMyFollowedAuthors())
    followedAuthors.value = data || []
  } catch { /* 静默 */ } finally {
    followedAuthorsLoading.value = false
  }
}

onMounted(async () => {
  await authStore.fetchProfile()
  bookStore.loadShelf()
  loadCheckinStatus()
  loadCheckinMonth()
  loadFollowedAuthors()
  window.addEventListener('checkin-updated', ((event: CustomEvent<CheckinStatus>) => {
    checkinStatus.value = event.detail
    loadCheckinMonth()
  }) as EventListener)
})
</script>

<style scoped lang="scss">
.profile-page {
  max-width: var(--app-content-width);
  margin: 0 auto;
}

// 顶部横幅
.profile-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;

  .banner-avatar {
    background: linear-gradient(135deg, #409eff, #67c23a);
    flex-shrink: 0;
  }

  .banner-meta {
    flex: 1;
    min-width: 0;

    h2 {
      margin: 0 0 6px;
      font-size: 20px;
    }
  }

  .banner-checkin-btn {
    flex-shrink: 0;
    border-radius: 999px;
    font-weight: 600;
  }
}

// 主体
.profile-body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

// 左侧菜单
.profile-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  position: sticky;
  top: 80px;

  .el-menu {
    border-right: none;
  }

  .el-menu-item {
    height: 48px;
    line-height: 48px;
    font-size: 14px;
  }

  .admin-menu-item {
    color: var(--el-color-warning);
  }

  .logout-menu-item {
    color: var(--el-color-danger);
  }

  .sidebar-divider {
    height: 1px;
    background: var(--el-border-color-lighter);
    margin: 4px 0;
  }
}

// 右侧内容
.profile-content {
  flex: 1;
  min-width: 0;
}

.content-panel {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.panel-title {
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-card {
  padding: 4px 0;
}

// 阅读统计
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  .stat-item {
    text-align: center;
    padding: 20px;
    background: var(--el-fill-color-light);
    border-radius: 10px;

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--el-color-primary);
      margin-bottom: 6px;
    }

    .stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}

// 我的关注
.author-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.author-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  transition: background 0.2s;

  &:hover {
    background: var(--el-fill-color);
  }
}

.author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar-sm {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-color-primary-light-7), var(--el-color-primary-light-3));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.author-name-text {
  font-weight: 500;
  font-size: 14px;
}

.author-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.card-count {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.card-loading {
  text-align: center;
  padding: 30px;
  color: var(--el-text-color-secondary);
}

// 我的收藏
.shelf-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.shelf-item {
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);

    .shelf-name {
      color: var(--el-color-primary);
    }
  }
}

.shelf-cover {
  width: 100%;
  aspect-ratio: 3/4;
  object-fit: cover;
  border-radius: 6px;
  background: var(--el-fill-color);
}

.shelf-info {
  padding: 6px 2px;
}

.shelf-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.shelf-author {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-more {
  grid-column: 1 / -1;
  text-align: center;
  padding: 12px;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
  border-radius: 6px;
  background: var(--el-fill-color-light);

  &:hover {
    background: var(--el-fill-color);
  }
}

// 签到
.checkin-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 20px;

  .panel-title {
    margin-bottom: 8px;
  }
}

.checkin-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.calendar-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-primary);
  font-weight: 600;
  white-space: nowrap;
}

.checkin-stats {
  .stat-value {
    font-size: 26px;
  }
}

.checkin-legend {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin: 18px 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;

  &.signed {
    background: #67c23a;
  }

  &.unsigned {
    background: #e4e7ed;
  }

  &.today {
    background: #e6a23c;
  }
}

.checkin-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.weekday {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 0;
}

.calendar-day {
  min-height: 58px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: transform .18s ease, box-shadow .18s ease;

  strong {
    font-size: 18px;
  }

  span {
    font-size: 12px;
  }

  &.signed {
    color: #1f7a35;
    border-color: #b3e19d;
    background: linear-gradient(180deg, #f0f9eb, #e1f3d8);
  }

  &.unsigned {
    color: var(--el-text-color-secondary);
  }

  &.today {
    border-color: #e6a23c;
    box-shadow: 0 0 0 2px rgba(230, 162, 60, .18);
  }

  &.empty {
    border: none;
    background: transparent;
    box-shadow: none;
  }

  &:not(.empty):hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(15, 23, 42, .08);
  }
}

// 响应式
@media (max-width: 768px) {
  .profile-banner {
    flex-wrap: wrap;

    .banner-checkin-btn {
      width: 100%;
    }
  }

  .profile-body {
    flex-direction: column;
  }

  .profile-sidebar {
    width: 100%;
    position: static;

    .el-menu {
      display: flex;
      flex-wrap: wrap;
      overflow-x: auto;
    }

    .el-menu-item {
      flex-shrink: 0;
      height: 40px;
      line-height: 40px;
    }

    .sidebar-divider {
      width: 1px;
      height: auto;
      margin: 0 4px;
    }
  }

  .content-panel {
    padding: 18px;
  }

  .shelf-list {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .checkin-head {
    flex-direction: column;
  }

  .calendar-switch {
    width: 100%;
    justify-content: space-between;
  }

  .checkin-calendar {
    gap: 6px;
  }

  .calendar-day {
    min-height: 48px;
    border-radius: 10px;

    strong {
      font-size: 16px;
    }

    span {
      font-size: 11px;
    }
  }

  .stats-grid {
    gap: 12px;

    .stat-item {
      padding: 14px 8px;

      .stat-value {
        font-size: 24px;
      }
    }
  }
}
</style>
