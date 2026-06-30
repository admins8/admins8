<template>
  <div class="cleaner-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div>
            <h2>净化管理</h2>
            <p>管理阅读页正文净化规则，可移除标签、符号、广告语和自定义正则内容。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveRules">保存规则</el-button>
        </div>
      </template>

      <el-alert
        title="规则会在后端抓取正文、返回缓存正文，以及前端阅读页显示时生效。正则写错会被自动忽略，不会影响阅读。"
        type="info"
        :closable="false"
        show-icon
        class="tips"
      />

      <el-form label-position="top" class="cleaner-form">
        <el-form-item label="需要移除的 HTML 标签">
          <el-input
            v-model="removeTagsText"
            type="textarea"
            :rows="4"
            placeholder="每行一个标签名，例如：script、style、iframe"
          />
        </el-form-item>

        <el-form-item label="需要移除的固定符号/文字">
          <el-input
            v-model="removeTextsText"
            type="textarea"
            :rows="5"
            placeholder="每行一条，例如：★、请收藏本站、最新网址"
          />
        </el-form-item>

        <el-form-item label="需要移除的正则内容">
          <el-input
            v-model="removePatternsText"
            type="textarea"
            :rows="6"
            placeholder="每行一个正则，例如：第\\s*\\d+\\s*/\\s*\\d+\\s*页"
          />
        </el-form-item>

        <el-divider content-position="left">正则替换</el-divider>
        <div class="replace-list">
          <div v-for="(item, index) in replacements" :key="index" class="replace-row">
            <el-input v-model="item.pattern" placeholder="正则表达式" />
            <el-input v-model="item.replacement" placeholder="替换为，留空表示删除" />
            <el-input v-model="item.flags" placeholder="flags，例如 gmi" class="flags-input" />
            <el-button type="danger" @click="removeReplacement(index)">删除</el-button>
          </div>
          <el-button type="primary" plain @click="addReplacement">添加替换规则</el-button>
        </div>

        <el-divider content-position="left">预览</el-divider>
        <div class="preview-grid">
          <el-input v-model="previewInput" type="textarea" :rows="6" placeholder="输入需要测试的正文" />
          <div class="preview-output">{{ previewOutput }}</div>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="resetRules">重置</el-button>
        <el-button type="primary" :loading="saving" @click="saveRules">保存规则</el-button>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'
import { cleanReaderContent } from '@/utils/contentCleaner'

interface ReplacementRule {
  pattern: string
  replacement: string
  flags: string
}

const defaultRules = {
  removeTags: ['script', 'style', 'iframe'],
  removeTexts: [],
  removePatterns: [
    '第\\s*\\d+\\s*/\\s*\\d+\\s*页',
    '请收藏本站.*?$',
    '最新网址.*?$',
    '本章未完.*?$',
    '^\\s*Please\\s+(?:visit|bookmark|remember)\\b.*?(?:www\\.|https?://|latest\\s+chapter|chapter|site|website).*?$',
    '^\\s*If\\s+you\\s+find\\s+any\\s+errors\\b.*?$',
    '^\\s*(?:This\\s+chapter\\s+is\\s+updated|Read\\s+the\\s+latest\\s+chapter|Download\\s+.*?app)\\b.*?$',
    '^\\s*(?:www\\.|https?://)[^\\s\\u4e00-\\u9fa5]+\\s*$',
    "^\\s*window\\.[A-Za-z_$][\\w$]*\\s*=\\s*['\"][A-Za-z0-9+/=\\s]{40,}['\"];?\\s*$",
  ],
  replacements: [] as ReplacementRule[],
}

const removeTagsText = ref('')
const removeTextsText = ref('')
const removePatternsText = ref('')
const replacements = ref<ReplacementRule[]>([])
const originalRaw = ref('')
const saving = ref(false)
const previewInput = ref('&nbsp;&nbsp;&nbsp;&nbsp;正文<br><br>请收藏本站 第1/3页')

const previewOutput = computed(() => {
  let output = cleanReaderContent(previewInput.value)
  for (const text of lines(removeTextsText.value)) {
    output = output.replaceAll(text, '')
  }
  for (const pattern of lines(removePatternsText.value)) {
    try {
      output = output.replace(new RegExp(pattern, 'gmi'), '')
    } catch {}
  }
  for (const item of replacements.value) {
    if (!item.pattern) continue
    try {
      output = output.replace(new RegExp(item.pattern, item.flags || 'g'), item.replacement || '')
    } catch {}
  }
  return output.trim()
})

function lines(value: string) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
}

function applyRules(raw: any) {
  const rules = raw || defaultRules
  removeTagsText.value = (rules.removeTags || defaultRules.removeTags).join('\n')
  removeTextsText.value = (rules.removeTexts || []).join('\n')
  removePatternsText.value = (rules.removePatterns || defaultRules.removePatterns).join('\n')
  replacements.value = Array.isArray(rules.replacements)
    ? rules.replacements.map((item: any) => ({
      pattern: String(item.pattern || ''),
      replacement: String(item.replacement || ''),
      flags: String(item.flags || 'g'),
    }))
    : []
}

function buildRules() {
  return {
    removeTags: lines(removeTagsText.value),
    removeTexts: lines(removeTextsText.value),
    removePatterns: lines(removePatternsText.value),
    replacements: replacements.value
      .filter((item) => item.pattern.trim())
      .map((item) => ({
        pattern: item.pattern.trim(),
        replacement: item.replacement || '',
        flags: item.flags || 'g',
      })),
  }
}

async function loadRules() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    const raw = configMap.content_cleaner_rules || JSON.stringify(defaultRules)
    originalRaw.value = raw
    applyRules(JSON.parse(raw))
  } catch {
    originalRaw.value = JSON.stringify(defaultRules)
    applyRules(defaultRules)
  }
}

async function saveRules() {
  saving.value = true
  try {
    const value = JSON.stringify(buildRules())
    await configApi.updateConfig({
      config_key: 'content_cleaner_rules',
      config_value: value,
    })
    originalRaw.value = value
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function resetRules() {
  try {
    applyRules(JSON.parse(originalRaw.value || JSON.stringify(defaultRules)))
  } catch {
    applyRules(defaultRules)
  }
}

function addReplacement() {
  replacements.value.push({ pattern: '', replacement: '', flags: 'g' })
}

function removeReplacement(index: number) {
  replacements.value.splice(index, 1)
}

onMounted(loadRules)
</script>

<style scoped lang="scss">
.cleaner-page {
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

.cleaner-form {
  max-width: 980px;
}

.replace-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.replace-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 120px 80px;
  gap: 10px;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.preview-output {
  min-height: 136px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  white-space: pre-wrap;
  line-height: 1.8;
  color: var(--el-text-color-primary);
}

@media (max-width: 900px) {
  .replace-row,
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
