<template>
  <div class="email-config-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>邮箱配置</span>
        </div>
      </template>

      <el-form :model="form" label-width="140px" class="email-config-form">
        <el-divider content-position="left">发送设置</el-divider>
        <el-form-item label="启用邮件发送">
          <el-switch v-model="form.email_enabled" active-value="true" inactive-value="false" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="发件人名称">
            <el-input v-model="form.email_from_name" placeholder="例如：Legado Home" />
          </el-form-item>
          <el-form-item label="发件人邮箱">
            <el-input v-model="form.email_from_address" placeholder="例如：noreply@example.com" />
          </el-form-item>
        </div>

        <el-divider content-position="left">SMTP</el-divider>
        <div class="form-grid">
          <el-form-item label="SMTP 主机">
            <el-input v-model="form.smtp_host" placeholder="例如：smtp.example.com" />
          </el-form-item>
          <el-form-item label="SMTP 端口">
            <el-input v-model="form.smtp_port" placeholder="465" />
          </el-form-item>
          <el-form-item label="SMTP SSL/TLS">
            <el-switch v-model="form.smtp_secure" active-value="true" inactive-value="false" />
          </el-form-item>
          <el-form-item label="SMTP 用户名">
            <el-input v-model="form.smtp_username" placeholder="通常为邮箱地址" />
          </el-form-item>
        </div>
        <el-form-item label="SMTP 密码">
          <el-input v-model="form.smtp_password" type="password" show-password placeholder="留空或保持已配置占位则不修改" />
        </el-form-item>

        <el-divider content-position="left">POP3 / IMAP</el-divider>
        <div class="form-grid">
          <el-form-item label="POP3 主机">
            <el-input v-model="form.pop3_host" placeholder="例如：pop.example.com" />
          </el-form-item>
          <el-form-item label="POP3 端口">
            <el-input v-model="form.pop3_port" placeholder="995" />
          </el-form-item>
          <el-form-item label="POP3 SSL/TLS">
            <el-switch v-model="form.pop3_secure" active-value="true" inactive-value="false" />
          </el-form-item>
          <el-form-item label="IMAP 主机">
            <el-input v-model="form.imap_host" placeholder="例如：imap.example.com" />
          </el-form-item>
          <el-form-item label="IMAP 端口">
            <el-input v-model="form.imap_port" placeholder="993" />
          </el-form-item>
          <el-form-item label="IMAP SSL/TLS">
            <el-switch v-model="form.imap_secure" active-value="true" inactive-value="false" />
          </el-form-item>
        </div>

        <el-divider content-position="left">测试邮件</el-divider>
        <el-form-item label="测试收件邮箱">
          <div class="test-row">
            <el-input v-model="testEmail" placeholder="请输入测试收件邮箱" />
            <el-button :loading="testing" @click="sendTestEmail">发送测试邮件</el-button>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'

const defaultForm = {
  email_enabled: 'false',
  email_from_name: '',
  email_from_address: '',
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_username: '',
  smtp_password: '',
  pop3_host: '',
  pop3_port: '995',
  pop3_secure: 'true',
  imap_host: '',
  imap_port: '993',
  imap_secure: 'true',
}

const configKeys = Object.keys(defaultForm) as Array<keyof typeof defaultForm>
const form = ref({ ...defaultForm })
const originalForm = ref({ ...defaultForm })
const testEmail = ref('')
const testing = ref(false)

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    configKeys.forEach((key) => {
      form.value[key] = configMap[key] || defaultForm[key]
      originalForm.value[key] = form.value[key]
    })
  } catch {
    ElMessage.error('加载邮箱配置失败')
  }
}

async function saveConfig() {
  try {
    await configApi.updateConfigs(configKeys.map((key) => ({
      config_key: key,
      config_value: form.value[key],
    })))
    originalForm.value = { ...form.value }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

async function sendTestEmail() {
  if (!testEmail.value) {
    ElMessage.warning('请输入测试收件邮箱')
    return
  }
  testing.value = true
  try {
    await configApi.testEmail({ to: testEmail.value })
    ElMessage.success('测试邮件发送成功')
  } catch (err: any) {
    ElMessage.error(err.message || '测试邮件发送失败')
  } finally {
    testing.value = false
  }
}

function resetForm() {
  form.value = { ...originalForm.value }
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
.email-config-manage {
  .card-header {
    font-size: 16px;
    font-weight: 600;
  }

  .email-config-form {
    max-width: 980px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }

  .test-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .email-config-manage {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .test-row {
      flex-direction: column;
    }
  }
}
</style>
