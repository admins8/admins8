<template>
  <div class="member-purchase">
    <h2>开通会员</h2>
    <p class="subtitle">选择适合您的会员套餐，享受尊贵权益</p>

    <el-row :gutter="20" class="product-list">
      <el-col :span="8" v-for="item in configs" :key="item.product_type">
        <el-card
          :class="['product-card', selectedType === item.product_type ? 'active' : '']"
          @click="selectedType = item.product_type"
        >
          <div class="product-badge" :style="{ background: item.badge_color }">
            {{ item.badge_icon }}
          </div>
          <h3>{{ item.name }}</h3>
          <div class="product-price">
            <span class="sale-price">¥{{ item.sale_price }}</span>
            <span class="original-price">¥{{ item.price }}</span>
          </div>
          <div class="product-duration">{{ item.duration_days }}天</div>
          <p class="product-desc">{{ item.description }}</p>
        </el-card>
      </el-col>
    </el-row>

    <div class="pay-section" v-if="selectedType">
      <h3>选择支付方式</h3>
      <el-radio-group v-model="payChannel">
        <el-radio-button label="wechat">
          <el-icon><ChatDotRound /></el-icon> 微信支付
        </el-radio-button>
        <el-radio-button label="alipay">
          <el-icon><CreditCard /></el-icon> 支付宝
        </el-radio-button>
      </el-radio-group>

      <div class="pay-action">
        <el-button type="primary" size="large" :loading="payLoading" @click="createOrder">
          立即支付 ¥{{ selectedConfig?.sale_price || 0 }}
        </el-button>
      </div>
    </div>

    <!-- 支付二维码弹窗 -->
    <el-dialog v-model="qrDialogVisible" title="扫码支付" width="360px" align-center>
      <div class="qr-content">
        <p>订单号：{{ orderInfo.orderNo }}</p>
        <p>金额：¥{{ orderInfo.amount }}</p>
        <div class="qr-placeholder">
          <p>请使用{{ payChannel === 'wechat' ? '微信' : '支付宝' }}扫码支付</p>
          <p class="qr-tip">（支付功能待接入SDK）</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { memberApi, unwrapResponse, type MembershipConfig } from '@/api'
import { ElMessage } from 'element-plus'
import { ChatDotRound, CreditCard } from '@element-plus/icons-vue'

const configs = ref<MembershipConfig[]>([])
const selectedType = ref('')
const payChannel = ref('wechat')
const payLoading = ref(false)
const qrDialogVisible = ref(false)
const orderInfo = ref({ orderNo: '', amount: 0 })

const selectedConfig = computed(() => configs.value.find(c => c.product_type === selectedType.value))

async function loadConfigs() {
  try {
    const res = await memberApi.getConfigs()
    configs.value = unwrapResponse(res).filter((c: MembershipConfig) => c.is_active)
    if (configs.value.length > 0) {
      selectedType.value = configs.value[0].product_type
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  }
}

async function createOrder() {
  if (!selectedType.value) {
    ElMessage.warning('请选择会员套餐')
    return
  }
  payLoading.value = true
  try {
    const res = await memberApi.createOrder(selectedType.value)
    const data = unwrapResponse(res)
    orderInfo.value = { orderNo: data.orderNo, amount: data.amount }
    qrDialogVisible.value = true
  } catch (e: any) {
    ElMessage.error(e.message || '创建订单失败')
  } finally {
    payLoading.value = false
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.member-purchase {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}
.subtitle {
  color: #666;
  margin-bottom: 24px;
}
.product-list {
  margin-bottom: 32px;
}
.product-card {
  cursor: pointer;
  transition: all 0.3s;
  padding: 20px;
  text-align: center;
}
.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
.product-card.active {
  border: 2px solid #409eff;
}
.product-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
  font-size: 12px;
  margin-bottom: 12px;
}
.product-card h3 {
  margin: 0 0 12px;
}
.product-price {
  margin-bottom: 8px;
}
.sale-price {
  font-size: 28px;
  font-weight: bold;
  color: #f56c6c;
}
.original-price {
  font-size: 14px;
  color: #999;
  text-decoration: line-through;
  margin-left: 8px;
}
.product-duration {
  color: #666;
  margin-bottom: 8px;
}
.product-desc {
  color: #999;
  font-size: 12px;
  margin: 0;
}
.pay-section {
  margin-top: 24px;
}
.pay-action {
  margin-top: 24px;
}
.qr-content {
  text-align: center;
}
.qr-placeholder {
  margin-top: 16px;
  padding: 40px;
  background: #f5f5f5;
  border-radius: 8px;
}
.qr-tip {
  color: #999;
  font-size: 12px;
}
</style>
