<template>
  <div class="forgot-password-page">
    <div class="forgot-card">
      <div class="forgot-header">
        <h2>找回密码</h2>
        <p class="subtitle">通过注册邮箱重置你的密码</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="handleSubmit"
      >
        <!-- 第一步：输入邮箱获取验证码 -->
        <template v-if="step === 1">
          <el-form-item label="注册邮箱" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入注册时使用的邮箱"
              clearable
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" class="submit-btn" :loading="loading" native-type="submit">
              获取验证码
            </el-button>
          </el-form-item>

          <div class="form-footer">
            <span>想起密码了？</span>
            <el-link type="primary" :underline="false" @click="router.push('/login')">返回登录</el-link>
          </div>
        </template>

        <!-- 第二步：输入验证码和新密码 -->
        <template v-else>
          <el-alert
            v-if="issuedToken"
            :title="'你的验证码：' + issuedToken"
            type="success"
            description="有效期 15 分钟。请将此验证码输入下方的验证码框。（本地环境直接返回，生产环境改为邮件发送。）"
            show-icon
            :closable="false"
            class="token-alert"
          />

          <el-form-item label="注册邮箱">
            <el-input v-model="form.email" disabled />
          </el-form-item>

          <el-form-item label="验证码" prop="token">
            <el-input
              v-model="form.token"
              placeholder="请输入 6 位数字验证码"
              maxlength="6"
              clearable
            />
          </el-form-item>

          <el-form-item label="新密码" prop="new_password">
            <el-input
              v-model="form.new_password"
              type="password"
              show-password
              placeholder="请输入新密码（至少 6 位）"
            />
          </el-form-item>

          <el-form-item label="确认新密码" prop="confirm_password">
            <el-input
              v-model="form.confirm_password"
              type="password"
              show-password
              placeholder="请再次输入新密码"
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" class="submit-btn" :loading="loading" native-type="submit">
              重置密码
            </el-button>
          </el-form-item>

          <div class="form-footer">
            <el-link type="primary" :underline="false" @click="resendCode">重新获取验证码</el-link>
            <span> · </span>
            <el-link type="primary" :underline="false" @click="router.push('/login')">返回登录</el-link>
          </div>
        </template>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { authApi } from '@/api'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const step = ref(1)
const issuedToken = ref('')

const form = reactive({
  email: '',
  token: '',
  new_password: '',
  confirm_password: '',
})

const validateConfirm = (_rule: any, value: string, callback: any) => {
  if (value !== form.new_password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  token: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: ['blur', 'change'] },
  ],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 个字符', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: ['blur', 'change'] },
  ],
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    if (step.value === 1) {
      const res: any = await authApi.forgotPassword({ email: form.email })
      issuedToken.value = res?.data?.token || ''
      step.value = 2
      ElMessage.success('验证码已生成，请查看下方提示')
    } else {
      await authApi.resetPassword({
        email: form.email,
        token: form.token,
        new_password: form.new_password,
      })
      ElMessage.success('密码重置成功，正在跳转登录页...')
      setTimeout(() => router.push('/login'), 800)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

function resendCode() {
  form.token = ''
  form.new_password = ''
  form.confirm_password = ''
  issuedToken.value = ''
  step.value = 1
}
</script>

<style scoped lang="scss">
.forgot-password-page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.forgot-card {
  width: 100%;
  max-width: 420px;
  background: var(--el-bg-color);
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.forgot-header {
  text-align: center;
  margin-bottom: 32px;

  h2 {
    margin: 0;
    font-size: 24px;
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  .subtitle {
    margin-top: 12px;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }
}

.token-alert {
  margin-bottom: 16px;
  border-radius: 8px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 8px;
}

.form-footer {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);

  .el-link {
    font-size: 14px;
  }
}
</style>
