<template>
  <div class="payment-manage">
    <el-card class="payment-card">
      <template #header>
        <div class="card-header">
          <span>微信支付</span>
          <el-tag :type="forms.wechat.is_active ? 'success' : 'info'">{{ forms.wechat.is_active ? '已启用' : '未启用' }}</el-tag>
        </div>
      </template>
      <el-form :model="forms.wechat" label-width="120px">
        <el-form-item label="App ID">
          <el-input v-model="forms.wechat.app_id" placeholder="请输入微信App ID" />
        </el-form-item>
        <el-form-item label="商户号">
          <el-input v-model="forms.wechat.merchant_id" placeholder="请输入微信商户号（MCH ID）" />
        </el-form-item>
        <el-form-item label="APIv3密钥">
          <el-input v-model="forms.wechat.api_key" placeholder="请输入微信APIv3密钥" />
        </el-form-item>
        <el-form-item label="回调地址">
          <el-input v-model="forms.wechat.notify_url" placeholder="如 https://example.com/api/payment/notify/wechat" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="forms.wechat.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <div class="card-actions">
        <el-button type="primary" @click="saveConfig('wechat')">保存配置</el-button>
      </div>
    </el-card>

    <el-card class="payment-card">
      <template #header>
        <div class="card-header">
          <span>支付宝</span>
          <el-tag :type="forms.alipay.is_active ? 'success' : 'info'">{{ forms.alipay.is_active ? '已启用' : '未启用' }}</el-tag>
        </div>
      </template>
      <el-form :model="forms.alipay" label-width="120px">
        <el-form-item label="App ID">
          <el-input v-model="forms.alipay.app_id" placeholder="请输入支付宝App ID" />
        </el-form-item>
        <el-form-item label="商户PID">
          <el-input v-model="forms.alipay.merchant_id" placeholder="请输入支付宝商户PID" />
        </el-form-item>
        <el-form-item label="应用私钥">
          <el-input v-model="forms.alipay.private_key" type="textarea" :rows="4" placeholder="请输入支付宝应用私钥（留空则不更新）" />
        </el-form-item>
        <el-form-item label="支付宝公钥">
          <el-input v-model="forms.alipay.public_key" type="textarea" :rows="4" placeholder="请输入支付宝公钥" />
        </el-form-item>
        <el-form-item label="回调地址">
          <el-input v-model="forms.alipay.notify_url" placeholder="如 https://example.com/api/payment/notify/alipay" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="forms.alipay.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <div class="card-actions">
        <el-button type="primary" @click="saveConfig('alipay')">保存配置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { paymentApi, unwrapResponse, type PaymentConfig } from '@/api'
import { ElMessage } from 'element-plus'

const configs = ref<PaymentConfig[]>([])
const forms = ref<Record<string, Partial<PaymentConfig>>>({
  wechat: { channel: 'wechat', app_id: '', merchant_id: '', private_key: '', public_key: '', api_key: '', notify_url: '', is_active: 0 },
  alipay: { channel: 'alipay', app_id: '', merchant_id: '', private_key: '', public_key: '', api_key: '', notify_url: '', is_active: 0 },
})

async function loadConfigs() {
  try {
    const res = await paymentApi.getConfigs()
    const data = unwrapResponse(res)
    configs.value = data
    data.forEach((cfg: PaymentConfig) => {
      forms.value[cfg.channel] = { ...cfg, private_key: '' }
    })
  } catch (e: any) {
    ElMessage.error(e.message || '加载配置失败')
  }
}

async function saveConfig(channel: string) {
  try {
    await paymentApi.saveConfig(forms.value[channel])
    ElMessage.success('保存成功')
    loadConfigs()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

onMounted(loadConfigs)
</script>

<style scoped>
.payment-manage {
  padding: 20px;
}
.payment-card {
  margin-bottom: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-actions {
  text-align: right;
  margin-top: 12px;
}
</style>
