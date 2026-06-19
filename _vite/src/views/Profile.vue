<template>
  <div class="profile-page">
    <div class="profile-container">
      <!-- 用户信息卡片 -->
      <div class="profile-card">
        <div class="card-header">
          <el-avatar :size="80" :icon="UserFilled" class="user-avatar" />
          <div class="user-meta">
            <h2>{{ authStore.user?.username }}</h2>
            <el-tag :type="authStore.isAdmin ? 'danger' : 'info'" size="small">
              {{ authStore.isAdmin ? '管理员' : '普通用户' }}
            </el-tag>
          </div>
          <el-button
            class="profile-checkin-btn"
            :type="checkinStatus.checkedInToday ? 'success' : 'warning'"
            plain
            :loading="checkingIn"
            @click="handleCheckin"
          >
            {{ checkinStatus.checkedInToday ? '今日已签到' : '签到' }}
          </el-button>
        </div>

        <el-descriptions :column="1" border class="info-list">
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

      <!-- 管理员入口 -->
      <div v-if="authStore.isAdmin" class="profile-card admin-entry-card">
        <div>
          <h3 class="card-title">后台管理</h3>
          <p>管理员可进入后台管理采集插件、书源、站点配置和内容数据。</p>
        </div>
        <el-button type="primary" size="large" class="admin-entry-btn" @click="goAdmin">
          后台管理
        </el-button>
      </div>

      <!-- 修改信息卡片 -->
      <div class="profile-card">
        <h3 class="card-title">修改个人信息</h3>
        <el-form
          ref="profileFormRef"
          :model="profileForm"
          :rules="profileRules"
          label-width="80px"
          label-position="right"
        >
          <el-form-item label="邮箱" prop="email">
            <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="updatingProfile" @click="handleUpdateProfile">
              保存修改
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 修改密码卡片 -->
      <div class="profile-card">
        <h3 class="card-title">修改密码</h3>
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="100px"
          label-position="right"
        >
          <el-form-item label="当前密码" prop="oldPassword">
            <el-input
              v-model="passwordForm.oldPassword"
              type="password"
              placeholder="请输入当前密码"
              show-password
            />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              placeholder="请输入新密码"
              show-password
            />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button type="warning" :loading="changingPassword" @click="handleChangePassword">
              修改密码
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 阅读统计 -->
      <div class="profile-card">
        <h3 class="card-title">阅读统计</h3>
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

      <!-- 签到记录 -->
      <div class="profile-card checkin-card">
        <div class="checkin-head">
          <div>
            <h3 class="card-title">签到记录</h3>
            <p>查看本月签到情况，已签到和未签到日期会用不同颜色区分。</p>
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

      <!-- 退出登录 -->
      <div class="profile-card">
        <el-button type="danger" size="large" class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useBookStore } from '@/store/book'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { UserFilled, SwitchButton } from '@element-plus/icons-vue'
import { userApi, unwrapResponse, type CheckinMonth, type CheckinStatus } from '@/api'

const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()

const profileFormRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()
const updatingProfile = ref(false)
const changingPassword = ref(false)
const checkingIn = ref(false)
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

const finishedCount = computed(() => {
  return bookStore.shelf.filter(
    (b) => b.durChapterIndex != null && b.totalChapterNum != null && b.durChapterIndex >= b.totalChapterNum - 1
  ).length
})

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

async function handleUpdateProfile() {
  const valid = await profileFormRef.value?.validate().catch(() => false)
  if (!valid) return

  updatingProfile.value = true
  try {
    await authStore.updateProfile({ email: profileForm.email })
    ElMessage.success('信息更新成功')
  } catch {
    ElMessage.error('更新失败')
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

function goAdmin() {
  router.push('/admin')
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

onMounted(async () => {
  await authStore.fetchProfile()
  bookStore.loadShelf()
  loadCheckinStatus()
  loadCheckinMonth()
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

.profile-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.profile-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  .card-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;

    .user-avatar {
      background: linear-gradient(135deg, #409eff, #67c23a);
    }

    .user-meta {
      h2 {
        margin: 0 0 8px;
        font-size: 22px;
      }
    }

    .profile-checkin-btn {
      margin-left: auto;
      align-self: flex-start;
      min-width: 96px;
      border-radius: 999px;
      font-weight: 600;
    }
  }

  .card-title {
    margin: 0 0 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    padding-bottom: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .info-list {
    margin-top: 8px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;

    .stat-item {
      text-align: center;
      padding: 16px;
      background: var(--el-fill-color-light);
      border-radius: 8px;

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--el-color-primary);
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .logout-btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
  }
}

.checkin-card {
  .checkin-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 18px;

    .card-title {
      margin-bottom: 8px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
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
      font-size: 24px;
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
}

.admin-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  .card-title {
    margin-bottom: 8px;
  }

  p {
    margin: 0;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
  }

  .admin-entry-btn {
    min-width: 120px;
  }
}

@media (max-width: 768px) {
  .profile-card {
    padding: 16px;

    .card-header {
      flex-wrap: wrap;

      .profile-checkin-btn {
        width: 100%;
        margin-left: 0;
      }
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
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;

      .stat-item {
        padding: 12px 8px;

        .stat-value {
          font-size: 22px;
        }
      }
    }
  }

  .admin-entry-card {
    align-items: stretch;
    flex-direction: column;

    .admin-entry-btn {
      width: 100%;
    }
  }
}
</style>
