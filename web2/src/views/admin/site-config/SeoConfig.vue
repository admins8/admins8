<template>
  <div class="seo-config-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <h2>SEO配置</h2>
            <p>统一管理首页、详情页、阅读页、搜索页和排行榜页的 SEO 模板。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-alert
        title="通用变量：{siteName}/{网站名}、{年份}。详情和阅读页还支持 {bookName}/{书名}、{author}/{作者}、{intro}/{简介}、{category}/{分类}、{latestChapter}/{最新章节}、{chapterTitle}/{章节名}、{sourceName}/{书源}；搜索页支持 {keyword}/{关键词}；排行榜页支持 {rankName}/{榜单名}、{category}/{分类}。"
        type="info"
        :closable="false"
        show-icon
        class="tips"
      />

      <el-tabs v-model="activeTab">
        <el-tab-pane
          v-for="group in groups"
          :key="group.key"
          :label="group.label"
          :name="group.key"
        >
          <el-form label-position="top" class="seo-form">
            <el-form-item label="标题 title">
              <el-input v-model="form[group.titleKey]" :placeholder="group.defaults.title" />
            </el-form-item>
            <el-form-item label="关键词 keywords">
              <el-input v-model="form[group.keywordsKey]" :placeholder="group.defaults.keywords" />
            </el-form-item>
            <el-form-item label="描述 description">
              <el-input
                v-model="form[group.descriptionKey]"
                type="textarea"
                :rows="4"
                :placeholder="group.defaults.description"
              />
            </el-form-item>
          </el-form>

          <el-divider content-position="left">预览</el-divider>
          <div class="preview-box">
            <div class="preview-title">{{ preview(group).title }}</div>
            <div class="preview-url">{{ group.previewUrl }}</div>
            <div class="preview-desc">{{ preview(group).description }}</div>
            <div class="preview-keywords">关键词：{{ preview(group).keywords }}</div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="resetForm">重置</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'
import { defaultSeoTemplates, renderSeoTemplate } from '@/utils/seo'

type SeoGroup = {
  key: string
  label: string
  titleKey: keyof typeof defaultSeoTemplates
  keywordsKey: keyof typeof defaultSeoTemplates
  descriptionKey: keyof typeof defaultSeoTemplates
  defaults: { title: string; keywords: string; description: string }
  previewUrl: string
  vars: Record<string, string>
}

const activeTab = ref('home')
const saving = ref(false)
const form = reactive<Record<string, string>>({ ...defaultSeoTemplates })
const originalForm = ref<Record<string, string>>({ ...defaultSeoTemplates })

const groups = computed<SeoGroup[]>(() => [
  {
    key: 'home',
    label: '首页 SEO',
    titleKey: 'home_title',
    keywordsKey: 'home_keywords',
    descriptionKey: 'home_description',
    defaults: {
      title: defaultSeoTemplates.home_title,
      keywords: defaultSeoTemplates.home_keywords,
      description: defaultSeoTemplates.home_description,
    },
    previewUrl: 'https://example.com/',
    vars: { siteName: '搜书网' },
  },
  {
    key: 'detail',
    label: '详情页 SEO',
    titleKey: 'detail_title_template',
    keywordsKey: 'detail_keywords_template',
    descriptionKey: 'detail_description_template',
    defaults: {
      title: defaultSeoTemplates.detail_title_template,
      keywords: defaultSeoTemplates.detail_keywords_template,
      description: defaultSeoTemplates.detail_description_template,
    },
    previewUrl: 'https://example.com/book-detail?bookUrl=demo',
    vars: demoVars,
  },
  {
    key: 'reader',
    label: '阅读页 SEO',
    titleKey: 'reader_title_template',
    keywordsKey: 'reader_keywords_template',
    descriptionKey: 'reader_description_template',
    defaults: {
      title: defaultSeoTemplates.reader_title_template,
      keywords: defaultSeoTemplates.reader_keywords_template,
      description: defaultSeoTemplates.reader_description_template,
    },
    previewUrl: 'https://example.com/read/demo',
    vars: demoVars,
  },
  {
    key: 'search',
    label: '搜索页 SEO',
    titleKey: 'search_title_template',
    keywordsKey: 'search_keywords_template',
    descriptionKey: 'search_description_template',
    defaults: {
      title: defaultSeoTemplates.search_title_template,
      keywords: defaultSeoTemplates.search_keywords_template,
      description: defaultSeoTemplates.search_description_template,
    },
    previewUrl: 'https://example.com/?keyword=仙工开物',
    vars: { siteName: '搜书网', keyword: '仙工开物' },
  },
  {
    key: 'ranking',
    label: '排行榜页 SEO',
    titleKey: 'ranking_title_template',
    keywordsKey: 'ranking_keywords_template',
    descriptionKey: 'ranking_description_template',
    defaults: {
      title: defaultSeoTemplates.ranking_title_template,
      keywords: defaultSeoTemplates.ranking_keywords_template,
      description: defaultSeoTemplates.ranking_description_template,
    },
    previewUrl: 'https://example.com/ranking',
    vars: { siteName: '搜书网', rankName: '人气榜', category: '全部' },
  },
])

const demoVars = {
  siteName: '搜书网',
  bookName: '仙工开物',
  author: '蛊真人',
  intro: '火山中，先贤大能遗留的机关仙宫，隐秘开启。',
  category: '修真小说',
  latestChapter: '第八百七十二章 炉灵择主',
  chapterTitle: '第一章 机关仙宫',
  sourceName: '示例书源',
}

function preview(group: SeoGroup) {
  return {
    title: renderSeoTemplate(form[group.titleKey] || group.defaults.title, group.vars),
    keywords: renderSeoTemplate(form[group.keywordsKey] || group.defaults.keywords, group.vars),
    description: renderSeoTemplate(form[group.descriptionKey] || group.defaults.description, group.vars),
  }
}

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    Object.keys(defaultSeoTemplates).forEach((key) => {
      form[key] = configMap[key] || (defaultSeoTemplates as Record<string, string>)[key]
    })
    originalForm.value = { ...form }
  } catch {
    ElMessage.error('加载 SEO 配置失败')
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await configApi.updateConfigs(Object.keys(defaultSeoTemplates).map((config_key) => ({
      config_key,
      config_value: form[config_key] || '',
    })))
    originalForm.value = { ...form }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function resetForm() {
  Object.assign(form, originalForm.value)
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
.seo-config-page {
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

  .tips {
    margin-bottom: 18px;
    line-height: 1.7;
  }

  .seo-form {
    max-width: 900px;
  }

  .preview-box {
    max-width: 760px;
    padding: 18px;
    border-radius: 10px;
    background: var(--el-fill-color-lighter);
  }

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
