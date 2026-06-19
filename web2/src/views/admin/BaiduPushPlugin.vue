<template>
  <div class="baidu-push-plugin">
    <el-card shadow="never">
      <template #header>
        <div class="page-toolbar">
          <div>
            <h2>百度主动推送</h2>
            <p>将 sitemap、新书和更新链接主动提交到百度搜索资源平台，缩短百度发现链接的时间。</p>
          </div>
          <div class="toolbar-actions">
            <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
            <el-button :loading="loading" @click="loadAll">刷新</el-button>
            <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="tips"
        title="百度主动推送只能加快链接被发现，不保证一定收录。请先在百度搜索资源平台验证站点，并获取普通收录 API token。"
      />

      <el-form label-position="top" class="config-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="站点地址">
              <el-input v-model="form.site" placeholder="https://so.soumal.com" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每日推送上限">
              <el-input-number v-model="form.dailyLimit" :min="1" :max="50000" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="百度推送 Token">
              <el-input v-model="form.token" show-password placeholder="百度搜索资源平台普通收录 API token" />
              <span v-if="form.maskedToken && !form.token" class="form-tip">当前已配置：{{ form.maskedToken }}</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="page-toolbar">
          <div>
            <h3>手动推送</h3>
            <p>可粘贴指定 URL，或一键推送 sitemap 中最近的 URL。</p>
          </div>
          <div class="toolbar-actions">
            <el-button type="success" :loading="pushingSitemap" @click="pushSitemap">推送 sitemap</el-button>
            <el-button type="primary" :loading="pushingUrls" @click="pushUrls">推送下方 URL</el-button>
          </div>
        </div>
      </template>
      <el-input
        v-model="urlsText"
        type="textarea"
        :rows="8"
        placeholder="每行一个完整 URL，例如：https://so.soumal.com/book/1-test.html"
      />
      <el-alert v-if="lastResult" class="result-alert" :type="lastResult.ok ? 'success' : 'warning'" :closable="false">
        <template #title>
          推送{{ lastResult.ok ? '完成' : '失败' }}：提交 {{ lastResult.urlCount }} 条，成功 {{ lastResult.success }} 条，剩余额度 {{ lastResult.remain ?? '未知' }}{{ lastResult.error ? `，错误：${lastResult.error}` : '' }}
        </template>
      </el-alert>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="page-toolbar">
          <h3>推送日志</h3>
          <el-button :loading="loadingLogs" @click="loadLogs">刷新日志</el-button>
        </div>
      </template>
      <el-table :data="logs" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="urlCount" label="提交 URL" width="110" />
        <el-table-column prop="successCount" label="成功" width="90" />
        <el-table-column prop="remainCount" label="剩余额度" width="110" />
        <el-table-column prop="message" label="消息" min-width="220" />
        <el-table-column prop="createdAt" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { baiduPushApi, type BaiduPushConfig, type BaiduPushLog, type BaiduPushResult } from '@/api'

const loading = ref(false)
const saving = ref(false)
const loadingLogs = ref(false)
const pushingUrls = ref(false)
const pushingSitemap = ref(false)
const logs = ref<BaiduPushLog[]>([])
const urlsText = ref('')
const lastResult = ref<BaiduPushResult | null>(null)

const form = reactive<BaiduPushConfig>({
  site: 'https://so.soumal.com',
  token: '',
  enabled: false,
  dailyLimit: 100,
  maskedToken: '',
})

async function loadConfig() {
  const config = await baiduPushApi.getConfig()
  Object.assign(form, config)
  if (config.maskedToken) form.token = ''
}

async function loadLogs() {
  loadingLogs.value = true
  try {
    logs.value = await baiduPushApi.getLogs()
  } finally {
    loadingLogs.value = false
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadConfig(), loadLogs()])
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const payload = { ...form }
    if (!payload.token && form.maskedToken) delete (payload as any).token
    const saved = await baiduPushApi.saveConfig(payload)
    Object.assign(form, saved)
    if (saved.maskedToken) form.token = ''
    ElMessage.success('百度推送插件配置已保存')
  } finally {
    saving.value = false
  }
}

async function pushUrls() {
  const urls = urlsText.value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
  if (!urls.length) {
    ElMessage.warning('请先填写要推送的 URL')
    return
  }
  pushingUrls.value = true
  try {
    lastResult.value = await baiduPushApi.pushUrls(urls)
    await loadLogs()
  } finally {
    pushingUrls.value = false
  }
}

async function pushSitemap() {
  pushingSitemap.value = true
  try {
    lastResult.value = await baiduPushApi.pushSitemap(form.dailyLimit)
    await loadLogs()
  } finally {
    pushingSitemap.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.baidu-push-plugin {
  .page-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;

    h2,
    h3,
    p {
      margin: 0;
    }

    p {
      color: var(--el-text-color-secondary);
      margin-top: 6px;
    }
  }

  .toolbar-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .tips,
  .section-card,
  .result-alert {
    margin-top: 16px;
  }

  .config-form {
    margin-top: 16px;
  }

  .form-tip {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-top: 6px;
    display: inline-block;
  }
}
</style>
