<template>
  <div class="member-list">
    <div class="toolbar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或邮箱"
        style="width: 260px"
        clearable
        @keyup.enter="loadMembers"
      />
      <el-button type="primary" @click="loadMembers">搜索</el-button>
    </div>

    <el-table :data="members" v-loading="loading" style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="email" label="邮箱" width="200" />
      <el-table-column prop="role" label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="roleTagType(row.role)">{{ roleLabel(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="membership_type" label="会员类型" width="120">
        <template #default="{ row }">
          <el-tag :type="memberTagType(row.membership_type)">{{ memberTypeLabel(row.membership_type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="member_badge" label="标识" width="100">
        <template #default="{ row }">
          <span v-if="row.member_badge" style="color: #f56c6c; font-weight: bold">{{ row.member_badge }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="membership_expire_at" label="有效期至" width="170">
        <template #default="{ row }">{{ formatDate(row.membership_expire_at) }}</template>
      </el-table-column>
      <el-table-column prop="membership_start_at" label="开通时间" width="170">
        <template #default="{ row }">{{ formatDate(row.membership_start_at) }}</template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录" width="170">
        <template #default="{ row }">{{ formatDate(row.last_login_at) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadMembers"
        @current-change="loadMembers"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { memberApi, unwrapResponse } from '@/api'
import { ElMessage } from 'element-plus'

const members = ref<any[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')

function roleLabel(role: string) {
  const map: Record<string, string> = { superadmin: '超级管理员', admin: '管理员', user: '普通用户', test: '测试账号' }
  return map[role] || role
}

function roleTagType(role: string) {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'warning'
  return 'info'
}

function memberTypeLabel(type: string) {
  const map: Record<string, string> = { monthly: '月会员', quarterly: '季会员', yearly: '年会员', free: '普通会员' }
  return map[type] || type
}

function memberTagType(type: string) {
  if (type === 'yearly') return 'danger'
  if (type === 'quarterly') return 'warning'
  if (type === 'monthly') return 'success'
  return 'info'
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN')
}

async function loadMembers() {
  loading.value = true
  try {
    const res = await memberApi.getMemberList(currentPage.value, pageSize.value, searchKeyword.value)
    const data = unwrapResponse(res)
    members.value = data.list
    total.value = data.total
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadMembers)
</script>

<style scoped>
.member-list {
  padding: 20px;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
