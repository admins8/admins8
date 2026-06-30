<template>
  <div class="user-manage">
    <div class="page-header">
      <h2>用户管理</h2>
      <div class="header-info">
        <el-tag>共 {{ total }} 位用户</el-tag>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或邮箱..."
        prefix-icon="Search"
        clearable
        class="search-input"
        @change="loadUsers"
      />
      <el-select v-model="filterRole" placeholder="角色筛选" clearable @change="loadUsers">
        <el-option label="超级管理员" value="superadmin" />
        <el-option label="管理员" value="admin" />
        <el-option label="测试账号" value="test" />
        <el-option label="普通用户" value="user" />
      </el-select>
      <el-button v-if="!authStore.isTest" type="primary" @click="showCreateDialog = true">新增用户</el-button>
    </div>

    <!-- 用户表格 -->
    <el-table :data="users" stripe class="user-table" v-loading="loading">
      <el-table-column prop="username" label="用户名" min-width="120">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="32" :icon="UserFilled" />
            <span class="user-name">{{ row.username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
      <el-table-column prop="role" label="角色" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="roleTagType(row.role)" size="small">
            {{ roleLabel(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="功能权限" min-width="200">
        <template #default="{ row }">
          <div class="permission-tags">
            <template v-if="row.role === 'superadmin'">
              <el-tag size="small" type="danger">全部权限</el-tag>
            </template>
            <template v-else-if="row.permissions && row.permissions.length > 0">
              <el-tag
                v-for="p in row.permissions"
                :key="p"
                size="small"
                class="perm-tag"
              >
                {{ getPermissionLabel(p) }}
              </el-tag>
            </template>
            <template v-else>
              <span class="no-permission">无</span>
            </template>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="注册时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录" width="180">
        <template #default="{ row }">
          {{ formatDate(row.last_login_at || row.lastLoginAt) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
            {{ row.is_active ? '正常' : '已禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="!authStore.isTest && row.id !== currentUserId">
            <el-button
              type="primary"
              link
              size="small"
              @click="openEditDialog(row)"
            >
              修改
            </el-button>
            <el-button
              :type="row.is_active ? 'danger' : 'success'"
              link
              size="small"
              @click="toggleStatus(row)"
            >
              {{ row.is_active ? '禁用' : '启用' }}
            </el-button>
            <el-button
              type="warning"
              link
              size="small"
              @click="openMemberDialog(row)"
            >
              {{ row.membership_type && row.membership_type !== 'free' ? '会员' : '开通会员' }}
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              @click="deleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadUsers"
        @current-change="loadUsers"
      />
    </div>

    <!-- 创建用户对话框 -->
    <el-dialog v-model="showCreateDialog" title="新增用户" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" placeholder="请选择角色">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="测试账号" value="test" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改用户对话框 -->
    <el-dialog v-model="showEditDialog" title="修改用户" width="480px">
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <span>{{ selectedUser?.username }}</span>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="newRole" placeholder="请选择角色">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="测试账号" value="test" />
            <el-option label="超级管理员" value="superadmin" />
          </el-select>
        </el-form-item>
        <el-form-item label="功能权限">
          <div class="permission-editor">
            <el-checkbox-group v-model="editPermissions" :disabled="newRole === 'superadmin'">
              <el-checkbox
                v-for="opt in permissionOptions"
                :key="opt.key"
                :value="opt.key"
              >
                {{ opt.label }}
              </el-checkbox>
            </el-checkbox-group>
            <div class="permission-hint">
              {{ newRole === 'superadmin' ? '超级管理员默认拥有全部功能权限' : '勾选该用户可访问的后台功能模块' }}
            </div>
          </div>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="passwordForm.password"
            type="password"
            show-password
            placeholder="不修改请留空，至少6位"
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            @keyup.enter="confirmEditUser"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmEditUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- 设置会员弹窗 -->
    <el-dialog v-model="showMemberDialog" title="设置会员" width="400px">
      <div v-if="selectedMemberUser">
        <p style="margin-bottom: 16px;">用户：{{ selectedMemberUser.username }}</p>
        <p v-if="selectedMemberUser.membership_type && selectedMemberUser.membership_type !== 'free'" style="margin-bottom: 16px;">
          当前会员：{{ memberTypeLabel(selectedMemberUser.membership_type) }}
          <span v-if="selectedMemberUser.membership_expire_at">（有效期至 {{ formatDate(selectedMemberUser.membership_expire_at) }}）</span>
        </p>
        <el-form label-width="100px">
          <el-form-item label="会员套餐">
            <el-select v-model="memberProductType" placeholder="请选择会员套餐">
              <el-option label="取消会员" value="free" />
              <el-option v-for="cfg in memberConfigs" :key="cfg.product_type" :label="cfg.name" :value="cfg.product_type" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showMemberDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSetMember">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi, memberApi, unwrapResponse, type User, type PermissionOption, type MembershipConfig } from '@/api'
import { useAuthStore } from '@/store/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'

const authStore = useAuthStore()

const users = ref<User[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const filterRole = ref('')
const loading = ref(false)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const selectedUser = ref<User | null>(null)
const newRole = ref('')
const editPermissions = ref<string[]>([])
const permissionOptions = ref<PermissionOption[]>([])

// 会员设置相关
const showMemberDialog = ref(false)
const selectedMemberUser = ref<User | null>(null)
const memberProductType = ref('')
const memberConfigs = ref<MembershipConfig[]>([])

const currentUserId = computed(() => {
  try {
    const token = localStorage.getItem('token')
    if (!token) return 0
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.userId || 0
  } catch {
    return 0
  }
})

const createForm = ref({
  username: '',
  email: '',
  password: '',
  role: 'user',
})

const passwordForm = ref({
  password: '',
  confirmPassword: '',
})

// 权限 key → 中文标签
const permissionLabelMap = computed(() => {
  const map: Record<string, string> = {}
  for (const opt of permissionOptions.value) {
    map[opt.key] = opt.label
  }
  return map
})

function getPermissionLabel(key: string): string {
  return permissionLabelMap.value[key] || key
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    superadmin: '超级管理员',
    admin: '管理员',
    test: '测试账号',
    user: '普通用户',
  }
  return map[role] || role
}

function roleTagType(role: string) {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'warning'
  if (role === 'test') return 'success'
  return 'info'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN')
}

async function loadPermissionOptions() {
  try {
    const res: any = await adminApi.getPermissionOptions()
    permissionOptions.value = unwrapResponse<PermissionOption[]>(res)
  } catch {
    // 兜底：如果接口还没部署，使用默认值
    permissionOptions.value = [
      { key: 'site_config', label: '网站配置' },
      { key: 'content_manage', label: '内容管理' },
      { key: 'book_manage', label: '书籍管理' },
      { key: 'source_manage', label: '书源管理' },
      { key: 'plugin_manage', label: '插件管理' },
      { key: 'user_manage', label: '用户管理' },
      { key: 'system_upgrade', label: '系统升级' },
      { key: 'app_manage', label: 'APP管理' },
    ]
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const res: any = await adminApi.getUsers(currentPage.value, pageSize.value, searchKeyword.value, filterRole.value)
    const data = unwrapResponse<{ list: User[]; total: number }>(res)
    users.value = data.list || []
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error('加载用户列表失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

function openEditDialog(user: User) {
  selectedUser.value = user
  newRole.value = user.role
  editPermissions.value = Array.isArray(user.permissions) ? [...user.permissions] : []
  passwordForm.value = { password: '', confirmPassword: '' }
  showEditDialog.value = true
}

async function confirmEditUser() {
  if (!selectedUser.value || !newRole.value) return
  const userId = Number(selectedUser.value.id)
  const password = passwordForm.value.password.trim()
  const confirmPassword = passwordForm.value.confirmPassword.trim()

  if (password || confirmPassword) {
    if (password.length < 6) {
      ElMessage.warning('新密码长度不能少于6位')
      return
    }
    if (password !== confirmPassword) {
      ElMessage.warning('两次输入的新密码不一致')
      return
    }
  }

  try {
    await adminApi.updateUserStatus(userId, { role: newRole.value })
    // 权限对普通用户和管理员都生效，超级管理员自动拥有全部权限
    if (newRole.value !== 'superadmin') {
      await adminApi.updateUserPermissions(userId, editPermissions.value)
    }
    if (password) {
      await adminApi.updateUserPassword(userId, password)
    }
    ElMessage.success('修改成功')
    showEditDialog.value = false
    loadUsers()
  } catch (e: any) {
    ElMessage.error('操作失败: ' + (e.response?.data?.msg || e.message))
  }
}

async function createUser() {
  if (!createForm.value.username || !createForm.value.email || !createForm.value.password) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await adminApi.createUser(createForm.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    createForm.value = { username: '', email: '', password: '', role: 'user' }
    loadUsers()
  } catch (e: any) {
    ElMessage.error('创建失败: ' + (e.response?.data?.msg || e.message))
  }
}

async function toggleStatus(user: User) {
  const action = user.is_active ? '禁用' : '启用'
  ElMessageBox.confirm(`确定${action}用户「${user.username}」？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await adminApi.updateUserStatus(user.id, { is_active: !user.is_active })
      ElMessage.success('操作成功')
      loadUsers()
    } catch (e: any) {
      ElMessage.error('操作失败: ' + (e.response?.data?.msg || e.message))
    }
  }).catch(() => {})
}

async function deleteUser(user: User) {
  ElMessageBox.confirm(`确定删除用户「${user.username}」？此操作不可恢复！`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'danger',
  }).then(async () => {
    try {
      await adminApi.deleteUser(user.id)
      ElMessage.success('删除成功')
      loadUsers()
    } catch (e: any) {
      ElMessage.error('删除失败: ' + (e.response?.data?.msg || e.message))
    }
  }).catch(() => {})
}

// 会员设置
function memberTypeLabel(type: string) {
  const map: Record<string, string> = { monthly: '月会员', quarterly: '季会员', yearly: '年会员', free: '普通会员' }
  return map[type] || type
}

async function loadMemberConfigs() {
  try {
    const res = await memberApi.getAdminConfigs()
    memberConfigs.value = unwrapResponse(res)
  } catch {
    memberConfigs.value = []
  }
}

function openMemberDialog(row: User) {
  selectedMemberUser.value = row
  memberProductType.value = row.membership_type && row.membership_type !== 'free' ? row.membership_type : 'free'
  loadMemberConfigs()
  showMemberDialog.value = true
}

async function confirmSetMember() {
  if (!selectedMemberUser.value) return
  const userId = Number(selectedMemberUser.value.id)
  try {
    if (memberProductType.value === 'free') {
      await memberApi.revokeMembership(userId)
      ElMessage.success('已取消会员资格')
    } else {
      await memberApi.grantMembership(userId, memberProductType.value)
      ElMessage.success('开通会员成功')
    }
    showMemberDialog.value = false
    loadUsers()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(() => {
  loadPermissionOptions()
  loadUsers()
})
</script>

<style scoped lang="scss">
.user-manage {
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;

    .search-input {
      width: 280px;
    }
  }

  .user-table {
    border-radius: 8px;
    overflow: hidden;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .user-name {
      font-weight: 500;
    }
  }

  .permission-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    .perm-tag {
      margin: 0;
    }

    .no-permission {
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }
  }

  .permission-editor {
    .el-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .permission-hint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}

@media (max-width: 768px) {
  .user-manage {
    .page-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }

    .filter-bar {
      flex-wrap: wrap;

      .search-input {
        width: 100%;
      }
    }

    .pagination-wrapper {
      justify-content: center;
      overflow-x: auto;
    }
  }
}
</style>
