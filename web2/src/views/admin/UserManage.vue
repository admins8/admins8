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
        <el-option label="普通用户" value="user" />
      </el-select>
      <el-button type="primary" @click="showCreateDialog = true">新增用户</el-button>
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
      <el-table-column prop="created_at" label="注册时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录时间" width="180">
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
          <el-button
            v-if="row.id !== currentUserId"
            type="primary"
            link
            size="small"
            @click="openEditDialog(row)"
          >
            修改
          </el-button>
          <el-button
            v-if="row.id !== currentUserId"
            :type="row.is_active ? 'danger' : 'success'"
            link
            size="small"
            @click="toggleStatus(row)"
          >
            {{ row.is_active ? '禁用' : '启用' }}
          </el-button>
          <el-button
            v-if="row.id !== currentUserId"
            type="danger"
            link
            size="small"
            @click="deleteUser(row)"
          >
            删除
          </el-button>
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
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改用户对话框 -->
    <el-dialog v-model="showEditDialog" title="修改" width="430px">
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <span>{{ selectedUser?.username }}</span>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="newRole" placeholder="请选择角色">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
            <el-option label="超级管理员" value="superadmin" />
          </el-select>
        </el-form-item>
        <el-form-item label="功能权限">
          <div class="permission-editor">
            <el-switch
              v-model="editSourcePermission"
              :disabled="newRole !== 'user'"
              active-text="书源管理"
              inactive-text="无"
              inline-prompt
            />
            <div class="permission-hint">
              {{ newRole === 'user' ? '开启后该用户可管理书源' : '管理员默认拥有全部功能权限' }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi, unwrapResponse, type User } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'

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
const editSourcePermission = ref(false)
const SOURCE_MANAGE = 'source_manage'

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

function roleLabel(role: string) {
  const map: Record<string, string> = {
    superadmin: '超级管理员',
    admin: '管理员',
    user: '普通用户',
  }
  return map[role] || role
}

function roleTagType(role: string) {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'warning'
  return 'info'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN')
}

async function loadUsers() {
  loading.value = true
  try {
    const res: any = await adminApi.getUsers(currentPage.value, pageSize.value, searchKeyword.value)
    const data = unwrapResponse<{ list: User[]; total: number }>(res)
    users.value = data.list || []
    total.value = data.total || 0
  } catch (e: any) {
    ElMessage.error('加载用户列表失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

function hasPermission(user: User, permission: string) {
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
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

function resetEditPassword() {
  passwordForm.value = {
    password: '',
    confirmPassword: '',
  }
}

function openEditDialog(user: User) {
  selectedUser.value = user
  newRole.value = user.role
  editSourcePermission.value = hasPermission(user, SOURCE_MANAGE)
  resetEditPassword()
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
    if (newRole.value === 'user') {
      await adminApi.updateUserPermissions(userId, editSourcePermission.value ? [SOURCE_MANAGE] : [])
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

onMounted(() => {
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

  .permission-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
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
