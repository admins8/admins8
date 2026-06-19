<template>
  <div class="site-config-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>基础配置</span>
        </div>
      </template>
      <el-form :model="form" label-width="120px" class="site-config-form">
        <el-divider content-position="left">基础信息</el-divider>
        <div class="form-grid">
          <el-form-item label="网站标题">
            <el-input v-model="form.site_title" placeholder="请输入网站标题" />
          </el-form-item>
          <el-form-item label="网站副标题">
            <el-input v-model="form.site_subtitle" placeholder="请输入网站副标题" />
          </el-form-item>
        </div>
        <el-form-item label="网站Logo">
          <AdminImageUploadInput
            v-model="form.site_logo"
            placeholder="请输入 Logo 图片 URL，或上传图片"
            :limit-mb="2"
            preview-height="60px"
          />
        </el-form-item>
        <el-form-item label="默认书籍封面">
          <AdminImageUploadInput
            v-model="form.default_book_cover"
            placeholder="请输入默认封面图片 URL，或上传图片"
            preview-height="120px"
            hint="当书籍无封面或封面加载失败时，将自动使用此图片作为默认封面"
          />
        </el-form-item>

        <el-divider content-position="left">域名与备案</el-divider>
        <div class="form-grid">
          <el-form-item label="Web域名">
            <el-input v-model="form.web_domain" placeholder="例如：https://www.example.com" />
          </el-form-item>
          <el-form-item label="WAP域名">
            <el-input v-model="form.wap_domain" placeholder="例如：https://m.example.com" />
          </el-form-item>
        </div>
        <el-form-item label="ICP备案号">
          <el-input v-model="form.icp_number" placeholder="例如：粤ICP备xxxxxxxx号" />
        </el-form-item>

        <el-divider content-position="left">统计与版权</el-divider>
        <el-form-item label="统计代码">
          <el-input
            v-model="form.analytics_code"
            placeholder="请输入第三方统计平台提供的完整统计代码"
            type="textarea"
            :rows="6"
          />
        </el-form-item>
        <el-form-item label="版权信息">
          <el-input v-model="form.copyright" placeholder="请输入页面底部版权信息" />
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
import AdminImageUploadInput from '@/components/admin/AdminImageUploadInput.vue'

const defaultForm = {
  site_title: '',
  site_subtitle: '',
  site_logo: '',
  default_book_cover: '',
  web_domain: '',
  wap_domain: '',
  icp_number: '',
  analytics_code: '',
  copyright: '',
}

const configKeys = Object.keys(defaultForm) as Array<keyof typeof defaultForm>
const form = ref({ ...defaultForm })
const originalForm = ref({ ...defaultForm })

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    configKeys.forEach((key) => {
      form.value[key] = configMap[key] || defaultForm[key]
      originalForm.value[key] = form.value[key]
    })
  } catch {
    ElMessage.error('加载配置失败')
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
    window.dispatchEvent(new CustomEvent('site-config-updated', { detail: { ...form.value } }))
    window.dispatchEvent(new CustomEvent('site-logo-updated', { detail: form.value.site_logo }))
  } catch {
    ElMessage.error('保存失败')
  }
}

function resetForm() {
  form.value = { ...originalForm.value }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.site-config-manage {
  .card-header {
    font-size: 16px;
    font-weight: 600;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 18px;
  }

  .logo-upload {
    display: flex;
    gap: 12px;
    align-items: center;

    .el-input {
      flex: 1;
    }
  }

  .logo-preview {
    margin-top: 12px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    display: inline-block;
  }

  .preview-hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

@media (max-width: 900px) {
  .site-config-manage {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .logo-upload {
      flex-direction: column;
      align-items: stretch;
    }
  }
}
</style>
