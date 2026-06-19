<template>
  <div class="detail-seo-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <h2>详情页管理</h2>
            <p>管理小说详情页的浏览器标题、关键词和描述模板。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-alert
        title="可用变量：{bookName} 书名、{author} 作者、{intro} 简介、{category} 分类、{latestChapter} 最新章节、{sourceName} 书源、{siteName} 网站名"
        type="info"
        :closable="false"
        show-icon
        class="tips"
      />

      <el-form label-position="top" class="seo-form">
        <el-form-item label="详情页标题模板">
          <el-input
            v-model="form.detail_title_template"
            placeholder="{bookName}全文免费阅读_{bookName}最新章节_{siteName}"
          />
        </el-form-item>

        <el-form-item label="详情页关键词模板">
          <el-input
            v-model="form.detail_keywords_template"
            placeholder="{bookName},{author},{bookName}最新章节,{bookName}全文阅读"
          />
        </el-form-item>

        <el-form-item label="详情页描述模板">
          <el-input
            v-model="form.detail_description_template"
            type="textarea"
            :rows="4"
            placeholder="{bookName}是{author}创作的小说，最新章节：{latestChapter}。{intro}"
          />
        </el-form-item>
      </el-form>

      <el-divider content-position="left">预览</el-divider>
      <div class="preview-box">
        <div class="preview-title">{{ preview.title }}</div>
        <div class="preview-url">https://example.com/book-detail?bookUrl=demo</div>
        <div class="preview-desc">{{ preview.description }}</div>
        <div class="preview-keywords">关键词：{{ preview.keywords }}</div>
      </div>

      <template #footer>
        <el-button @click="resetForm">重置</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'
import { defaultDetailSeoTemplates, renderDetailSeoTemplate } from '@/utils/bookDetail'

const form = ref({ ...defaultDetailSeoTemplates })
const originalForm = ref({ ...defaultDetailSeoTemplates })
const saving = ref(false)

const demoBook = {
  name: '仙工开物',
  author: '蛊真人',
  intro: '火山中，先贤大能遗留的机关仙宫，隐秘开启。',
  kind: '修真小说',
  latestChapterTitle: '第八百七十二章 炉灵择主',
  sourceName: '示例书源',
}

const preview = computed(() => ({
  title: renderDetailSeoTemplate(form.value.detail_title_template, demoBook, '搜书网'),
  keywords: renderDetailSeoTemplate(form.value.detail_keywords_template, demoBook, '搜书网'),
  description: renderDetailSeoTemplate(form.value.detail_description_template, demoBook, '搜书网'),
}))

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    form.value = {
      detail_title_template: configMap.detail_title_template || defaultDetailSeoTemplates.detail_title_template,
      detail_keywords_template: configMap.detail_keywords_template || defaultDetailSeoTemplates.detail_keywords_template,
      detail_description_template: configMap.detail_description_template || defaultDetailSeoTemplates.detail_description_template,
    }
    originalForm.value = { ...form.value }
  } catch {
    ElMessage.error('加载详情页 SEO 配置失败')
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await configApi.updateConfigs(Object.entries(form.value).map(([config_key, config_value]) => ({
      config_key,
      config_value,
    })))
    originalForm.value = { ...form.value }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function resetForm() {
  form.value = { ...originalForm.value }
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
.detail-seo-page {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    h2 {
      margin: 0 0 6px;
      font-size: 20px;
    }
    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }
}

.tips {
  margin-bottom: 18px;
}

.seo-form {
  max-width: 900px;
}

.preview-box {
  max-width: 760px;
  padding: 18px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  .preview-title {
    color: #1a0dab;
    font-size: 18px;
    margin-bottom: 6px;
  }
  .preview-url {
    color: #188038;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .preview-desc,
  .preview-keywords {
    color: var(--el-text-color-regular);
    line-height: 1.7;
  }
  .preview-keywords {
    margin-top: 8px;
    color: var(--el-text-color-secondary);
  }
}
</style>
