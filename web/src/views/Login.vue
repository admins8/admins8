<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <el-image v-if="siteLogo" :src="siteLogo" fit="contain" class="auth-logo" />
        <el-icon v-else :size="40" color="#409EFF"><Reading /></el-icon>
        <p class="subtitle">登录您的账户</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <span>还没有账户？</span>
        <el-link type="primary" :underline="false" @click="router.push('/register')">立即注册</el-link>
        <span> | </span>
        <el-link type="primary" :underline="false" @click="router.push('/forgot-password')">忘记密码？</el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Reading } from '@element-plus/icons-vue'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const siteLogo = ref('')

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e: any) {
    ElMessage.error(e?.message || '登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}

async function loadSiteBrand() {
  try {
    const res = await configApi.getPublicConfigs()
    const configMap = configsToMap(res.data || [])
    siteLogo.value = configMap.site_logo || ''
  } catch {
    siteLogo.value = ''
  }
}

onMounted(() => {
  loadSiteBrand()
})
</script>

<style scoped lang="scss">
.login-page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--el-bg-color);
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  .auth-logo {
    height: 48px;
    max-width: 180px;
    margin: 0 auto;
  }

  .subtitle {
    margin-top: 12px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 8px;
}

.login-footer {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);

  .el-link {
    font-size: 14px;
  }
}
</style>
