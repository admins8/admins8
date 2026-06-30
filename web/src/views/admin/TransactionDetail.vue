<template>
  <div class="transaction-detail">
    <!-- 收入统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">¥{{ stats.totalAmount }}</div>
          <div class="stat-label">累计收入</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">¥{{ stats.todayAmount }}</div>
          <div class="stat-label">今日收入</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.totalOrders }}</div>
          <div class="stat-label">总订单数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.paidOrders }}</div>
          <div class="stat-label">已支付订单</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 订单列表 -->
    <el-card class="order-card">
      <template #header>
        <div class="order-header">
          <span>订单明细</span>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索订单号或用户"
            style="width: 260px"
            clearable
            @keyup.enter="loadOrders"
          />
        </div>
      </template>
      <el-table :data="orders" v-loading="orderLoading" style="width: 100%">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="username" label="用户" width="120" />
        <el-table-column prop="product_type" label="套餐" width="100">
          <template #default="{ row }">{{ memberTypeLabel(row.product_type) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="100">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="pay_channel" label="支付渠道" width="100">
          <template #default="{ row }">{{ row.pay_channel || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paid_at" label="支付时间" width="160">
          <template #default="{ row }">{{ row.paid_at || '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
      </el-table>
      <el-pagination
        v-model:current-page="orderPage"
        v-model:page-size="orderSize"
        :total="orderTotal"
        layout="total, prev, pager, next"
        @current-change="loadOrders"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { memberApi, unwrapResponse, type MemberOrder } from '@/api'
import { ElMessage } from 'element-plus'

const orders = ref<MemberOrder[]>([])
const orderLoading = ref(false)
const orderPage = ref(1)
const orderSize = ref(20)
const orderTotal = ref(0)
const searchKeyword = ref('')

const stats = ref({
  totalAmount: 0,
  todayAmount: 0,
  totalOrders: 0,
  paidOrders: 0,
})

function memberTypeLabel(type: string) {
  const map: Record<string, string> = { monthly: '月会员', quarterly: '季会员', yearly: '年会员' }
  return map[type] || type
}

function statusType(status: string) {
  const map: Record<string, string> = { pending: 'warning', paid: 'success', cancelled: 'info', refunded: 'danger' }
  return map[status] || 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款' }
  return map[status] || status
}

async function loadOrders() {
  orderLoading.value = true
  try {
    const res = await memberApi.getAdminOrders(orderPage.value, orderSize.value)
    const data = unwrapResponse(res)
    orders.value = data.list
    orderTotal.value = data.total
  } catch (e: any) {
    ElMessage.error(e.message || '加载订单失败')
  } finally {
    orderLoading.value = false
  }
}

async function loadStats() {
  try {
    const res = await memberApi.getOrderStats()
    const data = unwrapResponse(res)
    stats.value = {
      totalAmount: Number(data.totalAmount) || 0,
      todayAmount: Number(data.todayAmount) || 0,
      totalOrders: data.totalOrders || 0,
      paidOrders: data.paidOrders || 0,
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载统计失败')
  }
}

onMounted(() => {
  loadOrders()
  loadStats()
})
</script>

<style scoped>
.transaction-detail {
  padding: 20px;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-card {
  text-align: center;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
}
.stat-label {
  margin-top: 8px;
  color: #666;
}
.order-card {
  margin-top: 20px;
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
