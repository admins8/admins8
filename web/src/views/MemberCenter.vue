<template>
  <div class="member-center">
    <div class="member-card">
      <div class="member-header">
        <el-avatar :size="64" :src="user?.avatar_url || ''" />
        <div class="member-info">
          <h2>{{ user?.username }}</h2>
          <div class="member-tag">
            <el-tag v-if="status?.isMember" :type="memberTagType" size="large">{{ memberBadge }}</el-tag>
            <el-tag v-else type="info" size="large">普通会员</el-tag>
          </div>
          <p v-if="status?.membership_expire_at" class="expire-text">
            有效期至：{{ formatDate(status.membership_expire_at) }}
          </p>
        </div>
      </div>
      <div class="member-actions">
        <el-button v-if="!status?.isMember" type="primary" size="large" @click="goPurchase">开通会员</el-button>
        <el-button v-else type="warning" size="large" @click="goPurchase">续费会员</el-button>
      </div>
    </div>

    <div class="member-benefits">
      <h3>会员权益</h3>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="benefit-card">
            <el-icon size="32"><CircleCheck /></el-icon>
            <h4>免广告</h4>
            <p>享受全站无广告阅读体验</p>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="benefit-card">
            <el-icon size="32"><Medal /></el-icon>
            <h4>专属标识</h4>
            <p>头像旁展示尊贵会员标识</p>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="benefit-card">
            <el-icon size="32"><Cloudy /></el-icon>
            <h4>云同步</h4>
            <p>阅读记录云端同步，换设备不丢失</p>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div class="member-orders" v-if="orders.length > 0">
      <h3>最近订单</h3>
      <el-table :data="orders" style="width: 100%">
        <el-table-column prop="order_no" label="订单号" />
        <el-table-column prop="product_type" label="套餐" />
        <el-table-column prop="amount" label="金额">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'paid' ? 'success' : 'warning'">{{ row.status === 'paid' ? '已支付' : '待支付' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { memberApi, unwrapResponse, type MemberStatus, type MemberOrder } from '@/api'
import { CircleCheck, Medal, Cloudy } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const user = computed(() => authStore.user)

const status = ref<MemberStatus | null>(null)
const orders = ref<MemberOrder[]>([])

const memberBadge = computed(() => {
  const type = status.value?.membership_type
  const map: Record<string, string> = { monthly: '月会员', quarterly: '季会员', yearly: '年会员' }
  return map[type || ''] || '会员'
})

const memberTagType = computed(() => {
  const type = status.value?.membership_type
  if (type === 'yearly') return 'danger'
  if (type === 'quarterly') return 'warning'
  return 'success'
})

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN')
}

function goPurchase() {
  router.push('/member/purchase')
}

async function loadData() {
  try {
    const statusRes = await memberApi.getStatus()
    status.value = unwrapResponse(statusRes)
    const orderRes = await memberApi.getMyOrders(1, 5)
    orders.value = unwrapResponse(orderRes).list
  } catch {
    // 忽略错误
  }
}

onMounted(loadData)
</script>

<style scoped>
.member-center {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
.member-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.member-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.member-info h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
}
.member-tag {
  margin-bottom: 4px;
}
.expire-text {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}
.member-benefits {
  margin-bottom: 24px;
}
.member-benefits h3 {
  margin-bottom: 16px;
}
.benefit-card {
  text-align: center;
  padding: 20px;
}
.benefit-card h4 {
  margin: 12px 0 8px;
}
.benefit-card p {
  margin: 0;
  color: #666;
  font-size: 14px;
}
.member-orders h3 {
  margin-bottom: 16px;
}
</style>
