<template>
  <div class="collector-plugin-manage">
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="page-toolbar">
          <div class="title-block">
            <h2>采集插件管理</h2>
            <span>管理小说采集规则，支持采集、采集单本、编辑、导入导出和删除。</span>
          </div>
          <div class="toolbar-actions">
            <span class="plugin-status">插件状态</span>
            <el-switch
              v-if="collectorPlugin"
              v-model="collectorPlugin.enabled"
              active-text="启用"
              inactive-text="停用"
              @change="togglePlugin"
            />
            <el-button :loading="loading" @click="loadAll">刷新</el-button>
            <el-button @click="openImport">导入</el-button>
            <el-button type="primary" @click="newRule">新增采集</el-button>
          </div>
        </div>
      </template>

      <div class="table-scroll">
        <el-table
          v-loading="loading"
          :data="tableRows"
          border
          stripe
          class="collector-table"
        >
          <el-table-column type="selection" width="44" />
          <el-table-column prop="id" label="id" :width="isMobile ? 56 : 72" />
          <el-table-column label="采集名称" min-width="230">
            <template #default="{ row }">
              <div class="name-cell">
                <span>{{ row.collectName }}</span>
                <small>{{ row.entryUrl }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="collectType" label="采集类型" :width="isMobile ? 92 : 110" />
          <el-table-column prop="addedAt" label="添加时间" :width="isMobile ? 132 : 160" />
          <el-table-column prop="collectedAt" label="采集时间" :width="isMobile ? 132 : 160" />
          <el-table-column label="操作" :width="isMobile ? 292 : 420" :fixed="isMobile ? false : 'right'" align="center">
            <template #default="{ row }">
              <el-button size="small" type="success" :loading="runningId === row.id" @click="runCollect(row)">
                采集
              </el-button>
              <el-button size="small" plain :loading="singleForm.id === row.id && runningSingle" @click="openSingle(row)">
                采集单本
              </el-button>
              <el-button size="small" type="primary" @click="editRule(row)">
                编辑
              </el-button>
              <el-button size="small" type="info" :loading="testingId === row.id" @click="testRule(row)">
                测试
              </el-button>
              <el-button size="small" type="warning" @click="exportRule(row)">
                导出
              </el-button>
              <el-button size="small" type="danger" @click="deleteRule(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-dialog v-model="ruleDialogVisible" :title="form.id ? '编辑采集规则' : '新增采集规则'" width="920px">
      <el-form label-width="120px" class="rule-form">
        <el-form-item label="规则名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="单本详情页"><el-input v-model="form.entryUrl" placeholder="https://example.com/book/1.html" /></el-form-item>
        <el-form-item label="字符集"><el-input v-model="form.charset" placeholder="utf-8 / gbk" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        <el-divider content-position="left">详情页规则</el-divider>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="书名"><el-input v-model="form.detailRules.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="作者"><el-input v-model="form.detailRules.author" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="封面"><el-input v-model="form.detailRules.coverUrl" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="目录 URL"><el-input v-model="form.detailRules.tocUrl" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="分类"><el-input v-model="form.detailRules.kind" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="最新章节"><el-input v-model="form.detailRules.latestChapterTitle" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="简介"><el-input v-model="form.detailRules.intro" /></el-form-item></el-col>
        </el-row>
        <el-divider content-position="left">目录与正文规则</el-divider>
        <el-form-item label="章节列表"><el-input v-model="form.tocRules.chapterList" /></el-form-item>
        <el-form-item label="章节标题"><el-input v-model="form.tocRules.chapterTitle" /></el-form-item>
        <el-form-item label="章节 URL"><el-input v-model="form.tocRules.chapterUrl" /></el-form-item>
        <el-form-item label="正文规则"><el-input v-model="form.contentRule" /></el-form-item>
        <el-form-item label="请求头 JSON">
          <el-input v-model="headersText" type="textarea" :rows="4" placeholder='{"User-Agent":"Mozilla/5.0"}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="singleDialogVisible" title="采集单本" width="680px">
      <el-form label-width="110px">
        <el-form-item label="采集规则">
          <el-input v-model="singleForm.name" disabled />
        </el-form-item>
        <el-form-item label="详情页 URL">
          <el-input v-model="singleForm.entryUrl" placeholder="粘贴单本小说详情页地址" />
        </el-form-item>
        <el-form-item label="最大章节数">
          <el-input-number v-model="singleForm.maxChapters" :min="0" :max="5000" />
          <span class="form-tip">填 0 表示不限制，建议首次测试 20 章以内。</span>
        </el-form-item>
        <el-form-item label="采集正文">
          <el-switch v-model="singleForm.includeContent" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="singleDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="runningSingle" @click="runSingleFromDialog">开始采集</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="testDialogVisible" title="采集规则测试结果" width="920px">
      <div v-if="testResult" class="test-result">
        <el-alert
          :type="testResult.detail.ok && testResult.toc.ok ? 'success' : 'warning'"
          :closable="false"
          show-icon
          :title="testSummary"
        />

        <el-divider content-position="left">详情页提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.detail.ok ? 'success' : 'danger'">{{ testResult.detail.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="HTML 长度">{{ testResult.detail.htmlLength }}</el-descriptions-item>
          <el-descriptions-item label="详情 URL" :span="2">{{ testResult.detail.url }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="书名">{{ testResult.detail.book.name }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="作者">{{ testResult.detail.book.author }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book" label="目录 URL" :span="2">{{ testResult.detail.book.tocUrl }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.book?.intro" label="简介" :span="2">{{ testResult.detail.book.intro }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.detail.error" label="错误" :span="2">{{ testResult.detail.error }}</el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">目录页提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.toc.ok ? 'success' : 'danger'">{{ testResult.toc.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="章节数">{{ testResult.toc.chapterCount }}</el-descriptions-item>
          <el-descriptions-item label="目录 URL" :span="2">{{ testResult.toc.url }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.toc.error" label="提示" :span="2">{{ testResult.toc.error }}</el-descriptions-item>
        </el-descriptions>
        <el-table v-if="testResult.toc.chapters.length" :data="testResult.toc.chapters" border size="small" class="preview-table">
          <el-table-column prop="index" label="#" width="70" />
          <el-table-column prop="title" label="章节标题" width="220" />
          <el-table-column prop="url" label="章节 URL" />
        </el-table>

        <el-divider content-position="left">正文提取</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="testResult.content.ok ? 'success' : 'danger'">{{ testResult.content.ok ? '成功' : '失败' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="正文长度">{{ testResult.content.length }}</el-descriptions-item>
          <el-descriptions-item label="正文 URL" :span="2">{{ testResult.content.url || '未获取到章节 URL' }}</el-descriptions-item>
          <el-descriptions-item v-if="testResult.content.error" label="提示" :span="2">{{ testResult.content.error }}</el-descriptions-item>
        </el-descriptions>
        <pre v-if="testResult.content.preview" class="content-preview">{{ testResult.content.preview }}</pre>
      </div>
      <template #footer>
        <el-button @click="testDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入采集规则" width="760px">
      <el-input v-model="importText" type="textarea" :rows="16" placeholder="粘贴规则 JSON，支持单个规则、数组或 { rules: [...] }" />
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="importRules">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { collectorApi, pluginApi, type AdminPlugin, type CollectorRulePayload, type CollectorRuleRow, type CollectorLogRow, type CollectorTestResult } from '@/api'
import { buildCollectorPluginRows, type CollectorPluginTableRow } from './collectorPluginTable'

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const runningSingle = ref(false)
const runningId = ref<number | null>(null)
const testingId = ref<number | null>(null)
const plugins = ref<AdminPlugin[]>([])
const rules = ref<CollectorRuleRow[]>([])
const logs = ref<CollectorLogRow[]>([])
const ruleDialogVisible = ref(false)
const singleDialogVisible = ref(false)
const testDialogVisible = ref(false)
const importDialogVisible = ref(false)
const importText = ref('')
const headersText = ref('{}')
const testResult = ref<CollectorTestResult | null>(null)
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
const isMobile = computed(() => viewportWidth.value <= 768)

const emptyRule = (): CollectorRulePayload => ({
  name: '',
  entryUrl: '',
  enabled: true,
  charset: 'utf-8',
  headers: {},
  detailRules: { name: '', author: '', coverUrl: '', intro: '', tocUrl: '', kind: '', latestChapterTitle: '' },
  tocRules: { chapterList: '', chapterTitle: '', chapterUrl: '' },
  contentRule: '',
})

const form = ref<CollectorRulePayload>(emptyRule())
const singleForm = ref({
  id: 0,
  name: '',
  entryUrl: '',
  includeContent: false,
  maxChapters: 0,
})

const collectorPlugin = computed(() => plugins.value.find((plugin) => plugin.key === 'collector'))
const tableRows = computed(() => buildCollectorPluginRows(rules.value, logs.value))
const testSummary = computed(() => {
  if (!testResult.value) return ''
  const result = testResult.value
  if (!result.detail.ok) return `详情页测试失败：${result.detail.error || '请检查书名等详情页规则'}`
  if (!result.toc.ok) return `已提取《${result.detail.book?.name || ''}》，但章节为 0：${result.toc.error || '请检查目录规则'}`
  if (!result.content.ok) return `已提取《${result.detail.book?.name || ''}》和 ${result.toc.chapterCount} 个章节，但正文未提取成功：${result.content.error || '请检查正文规则'}`
  return `测试成功：已提取《${result.detail.book?.name || ''}》、${result.toc.chapterCount} 个章节和正文预览`
})

async function loadAll() {
  loading.value = true
  try {
    plugins.value = await pluginApi.getPlugins()
    rules.value = await collectorApi.getRules()
    logs.value = await collectorApi.getLogs()
  } finally {
    loading.value = false
  }
}

async function togglePlugin() {
  if (!collectorPlugin.value) return
  await pluginApi.updateStatus(collectorPlugin.value.key, collectorPlugin.value.enabled)
  ElMessage.success('插件状态已更新')
}

function newRule() {
  form.value = emptyRule()
  headersText.value = '{}'
  ruleDialogVisible.value = true
}

function editRule(row: CollectorPluginTableRow) {
  form.value = JSON.parse(JSON.stringify({ ...row.raw.rule, id: row.id }))
  headersText.value = typeof form.value.headers === 'string' ? form.value.headers : JSON.stringify(form.value.headers || {}, null, 2)
  ruleDialogVisible.value = true
}

async function saveRule() {
  saving.value = true
  try {
    form.value.headers = headersText.value ? JSON.parse(headersText.value) : {}
    await collectorApi.saveRule(form.value)
    ElMessage.success('采集规则已保存')
    ruleDialogVisible.value = false
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败，请检查 JSON 和规则字段')
  } finally {
    saving.value = false
  }
}

async function deleteRule(row: CollectorPluginTableRow) {
  await ElMessageBox.confirm(`确定删除采集规则“${row.collectName}”？`, '删除规则', { type: 'warning' })
  await collectorApi.deleteRule(row.id)
  ElMessage.success('已删除')
  await loadAll()
}

async function runCollect(row: CollectorPluginTableRow) {
  runningId.value = row.id
  try {
    const result = await collectorApi.runSingle(row.id, { includeContent: false, maxChapters: 0 })
    showCollectMessage(result)
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '采集失败')
  } finally {
    runningId.value = null
  }
}

function openSingle(row: CollectorPluginTableRow) {
  singleForm.value = {
    id: row.id,
    name: row.collectName,
    entryUrl: row.entryUrl,
    includeContent: false,
    maxChapters: 0,
  }
  singleDialogVisible.value = true
}

async function runSingleFromDialog() {
  if (!singleForm.value.id || !singleForm.value.entryUrl.trim()) {
    ElMessage.warning('请填写单本详情页 URL')
    return
  }
  runningSingle.value = true
  try {
    const result = await collectorApi.runSingle(singleForm.value.id, {
      entryUrl: singleForm.value.entryUrl.trim(),
      includeContent: singleForm.value.includeContent,
      maxChapters: singleForm.value.maxChapters,
    })
    showCollectMessage(result)
    singleDialogVisible.value = false
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '采集失败')
  } finally {
    runningSingle.value = false
  }
}

function showCollectMessage(result: Awaited<ReturnType<typeof collectorApi.runSingle>>) {
  const text = `已采集《${result.book.name}》，章节 ${result.chapterCount}，正文 ${result.contentCount}`
  if (result.chapterCount === 0) {
    ElMessage.warning(`${text}。章节为 0，请点击“测试”检查目录规则。`)
  } else if (result.contentCount === 0) {
    ElMessage.warning(`${text}。正文为 0，请点击“测试”检查正文规则。`)
  } else {
    ElMessage.success(text)
  }
}

async function testRule(row: CollectorPluginTableRow) {
  testingId.value = row.id
  testResult.value = null
  try {
    testResult.value = await collectorApi.testRule(row.id, { entryUrl: row.entryUrl })
    testDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '测试失败')
  } finally {
    testingId.value = null
  }
}

function openImport() {
  importText.value = ''
  importDialogVisible.value = true
}

async function importRules() {
  importing.value = true
  try {
    const payload = JSON.parse(importText.value)
    const result = await collectorApi.importRules(payload)
    const success = Number(result.success || 0)
    const fail = Number(result.fail || 0)
    if (fail > 0) {
      ElMessage.warning(`导入成功 ${success} 条，失败 ${fail} 条：${result.errors?.join('；') || '请检查规则 JSON'}`)
    } else {
      ElMessage.success(`导入成功 ${success} 条`)
      importDialogVisible.value = false
    }
    await loadAll()
  } catch (error: any) {
    ElMessage.error(error?.message || '导入失败，请检查 JSON')
  } finally {
    importing.value = false
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportRule(row: CollectorPluginTableRow) {
  downloadJson(`collector-rule-${row.id}.json`, {
    rules: [row.raw.rule],
    exportedAt: new Date().toISOString(),
  })
}

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth, { passive: true })
  loadAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<style scoped lang="scss">
.collector-plugin-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-card {
  border-radius: 10px;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.title-block {
  h2 {
    margin: 0;
    font-size: 20px;
    color: #303133;
  }

  span {
    display: block;
    margin-top: 6px;
    color: #909399;
    font-size: 13px;
  }
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.plugin-status {
  color: #606266;
  font-size: 13px;
}

.collector-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: #f5f5f5;
    color: #606266;
    font-weight: 600;
  }

  :deep(.el-button + .el-button) {
    margin-left: 6px;
  }
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: #606266;
    line-height: 1.45;
  }

  small {
    color: #b0b3b8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.rule-form {
  max-height: 66vh;
  overflow-y: auto;
  padding-right: 8px;
}

.form-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.test-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-table {
  margin-top: 10px;
}

.content-preview {
  margin: 10px 0 0;
  padding: 12px;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f7f8fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  color: #303133;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 768px) {
  .collector-plugin-manage {
    gap: 10px;
  }

  .table-card {
    :deep(.el-card__header) {
      padding: 14px 14px 10px;
    }

    :deep(.el-card__body) {
      padding: 0 10px 12px;
      overflow-x: auto;
    }
  }

  .page-toolbar {
    width: 100%;
    align-items: flex-start;
    gap: 12px;
  }

  .title-block {
    h2 {
      font-size: 18px;
    }

    span {
      font-size: 12px;
      line-height: 1.5;
    }
  }

  .toolbar-actions {
    width: 100%;
    gap: 8px;

    .plugin-status {
      width: 100%;
    }

    :deep(.el-button) {
      flex: 1 1 calc(33.333% - 8px);
      min-width: 0;
      margin-left: 0;
      padding: 8px 10px;
    }

    :deep(.el-switch) {
      flex: 0 0 auto;
      margin-right: auto;
    }
  }

  .collector-table {
    min-width: 640px;

    :deep(.el-button) {
      margin: 2px;
      padding: 5px 8px;
    }

    :deep(.el-button + .el-button) {
      margin-left: 2px;
    }
  }

  .table-scroll {
    margin: 0 -10px;
    padding: 0 10px;
    box-sizing: border-box;
  }
}
</style>
