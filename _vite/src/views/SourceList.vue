<template>
  <div class="source-page">
    <div class="page-header">
      <h2>{{ pageTitle }}</h2>
      <div class="header-actions">
        <el-button type="warning" :icon="Link" @click="showUrlImportDialog = true">
          书源导入
        </el-button>
        <el-button
          type="success"
          :icon="CircleCheck"
          :loading="batchValidating"
          @click="openBatchValidateDialog"
        >
          一键验证{{ selectedIds.length > 0 ? `（${selectedIds.length}）` : '' }}
        </el-button>
        <el-button
          type="primary"
          :icon="CircleCheck"
          :disabled="selectedIds.length === 0"
          :loading="batchStatusUpdating"
          @click="batchUpdateEnabled(true)"
        >
          批量启用 ({{ selectedIds.length }})
        </el-button>
        <el-button
          type="info"
          :disabled="selectedIds.length === 0"
          :loading="batchStatusUpdating"
          @click="batchUpdateEnabled(false)"
        >
          批量禁用 ({{ selectedIds.length }})
        </el-button>
        <el-button
          type="warning"
          :icon="Refresh"
          :loading="dedupingSources"
          @click="dedupeSourceList"
        >
          书源去重
        </el-button>
        <el-button
          type="warning"
          plain
          @click="selectMediaSources"
        >
          选择媒体类源
        </el-button>
        <el-button
          type="danger"
          :icon="Delete"
          :disabled="selectedIds.length === 0"
          @click="batchDelete"
        >
          批量删除 ({{ selectedIds.length }})
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="filterKeyword"
        placeholder="搜索书源名称..."
        prefix-icon="Search"
        clearable
        class="filter-input"
      />
      <el-select v-model="filterGroup" placeholder="选择分组" clearable>
        <el-option
          v-for="group in groups"
          :key="group"
          :label="group"
          :value="group"
        />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable>
        <el-option label="已启用" value="enabled" />
        <el-option label="已禁用" value="disabled" />
      </el-select>
      <el-select v-model="filterCheckStatus" placeholder="验证结果" clearable style="width: 140px;">
        <el-option label="未验证" value="0" />
        <el-option label="有效" value="1" />
        <el-option label="失效" value="2" />
      </el-select>
    </div>

    <!-- 书源表格 -->
    <el-table
      ref="tableRef"
      :data="pagedSources"
      stripe
      @selection-change="handleSelectionChange"
      class="source-table"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column prop="bookSourceName" label="书源名称" min-width="160">
        <template #default="{ row }">
          <div class="source-name-cell">
            <el-icon color="#409EFF"><Link /></el-icon>
            <span>{{ row.bookSourceName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="bookSourceUrl" label="书源地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="bookSourceGroup" label="分组" width="120">
        <template #default="{ row }">
          <el-tag v-if="row.bookSourceGroup" size="small">{{ row.bookSourceGroup }}</el-tag>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="enabled" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.enabled"
            @change="toggleSource(row)"
            :loading="row._toggling"
          />
        </template>
      </el-table-column>
      <el-table-column prop="weight" label="权重" width="80" align="center">
        <template #default="{ row }">
          {{ row.weight ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column label="验证状态" width="180">
        <template #default="{ row }">
          <div v-if="row._validating" class="check-cell">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span class="check-text">验证中</span>
          </div>
          <div v-else-if="row.lastCheckStatus === 1" class="check-cell">
            <el-tag type="success" size="small" effect="light">✓ 有效</el-tag>
            <span class="check-text" :title="row.lastCheckMessage">
              {{ formatRespond(row.respondTime) }}
            </span>
          </div>
          <div v-else-if="row.lastCheckStatus === 2" class="check-cell">
            <el-tag type="danger" size="small" effect="light">✗ 失效</el-tag>
            <span class="check-text danger" :title="row.lastCheckMessage">
              {{ row.lastCheckMessage || '失败' }}
            </span>
          </div>
          <span v-else class="text-muted">○ 未验证</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            type="success"
            link
            size="small"
            :loading="row._validating"
            @click="validateSingle(row)"
          >
            <el-icon><CircleCheck /></el-icon>验证
          </el-button>
          <el-button type="primary" link size="small" @click="editSource(row)">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button type="danger" link size="small" @click="deleteSource(row)">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        :total="totalCount"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>

    <!-- 编辑书源对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="编辑书源"
      width="560px"
      destroy-on-close
    >
      <el-form
        ref="sourceFormRef"
        :model="sourceForm"
        :rules="sourceRules"
        label-position="top"
      >
        <el-form-item label="书源名称" prop="bookSourceName">
          <el-input v-model="sourceForm.bookSourceName" placeholder="请输入书源名称" />
        </el-form-item>
        <el-form-item label="书源地址" prop="bookSourceUrl">
          <el-input v-model="sourceForm.bookSourceUrl" placeholder="请输入书源地址URL" />
        </el-form-item>
        <el-form-item label="分组" prop="bookSourceGroup">
          <el-input v-model="sourceForm.bookSourceGroup" placeholder="可选，输入分组名称" />
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="sourceForm.weight" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="sourceForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSource">保存</el-button>
      </template>
    </el-dialog>

    <!-- 书源导入对话框 -->
    <el-dialog v-model="showUrlImportDialog" title="书源导入" width="640px" destroy-on-close>
      <el-alert
        title="支持单个书源链接、书源集合链接，以及可直接返回书源 JSON 的 http/https 地址。/yuedu/rsss/ 是订阅源集合，不属于书源管理。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-alert
        v-if="importUrlType === 'rss'"
        title="当前链接是订阅源集合链接，请不要在书源管理中导入。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-form @submit.prevent="handleUrlImport">
        <el-form-item label="书源链接">
          <el-input
            v-model="importUrl"
            placeholder="https://www.yck2026.top/yuedu/shuyuan/json/id/xxx.json"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUrlImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="urlImporting" :disabled="importUrlType === 'rss'" @click="handleUrlImport">
          导入书源
        </el-button>
      </template>
    </el-dialog>

    <!-- 一键验证对话框 -->
    <el-dialog
      v-model="showValidateDialog"
      :title="batchValidating ? '正在验证书源...' : '一键验证书源'"
      width="600px"
      :close-on-click-modal="false"
      :close-on-press-escape="!batchValidating"
      :show-close="!batchValidating"
      destroy-on-close
    >
      <template v-if="!batchValidating">
        <el-alert
          :title="`将验证 ${pendingValidateCount} 个书源`"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />
        <el-form label-width="100px">
          <el-form-item label="搜索关键词">
            <el-input
              v-model="validateKeyword"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              placeholder="多个关键词用换行或逗号分隔，如：&#10;诡秘之主,斗破苍穹,凡人修仙传&#10;任意一个关键词搜到结果即视为有效书源"
              clearable
            />
            <div class="form-tips">支持多个关键词（换行或逗号分隔），任意一个关键词搜到结果即视为有效书源。</div>
          </el-form-item>
          <el-form-item label="单条超时">
            <el-input-number v-model="validateTimeout" :min="3" :max="60" :step="1" />
            <span class="form-tips" style="margin-left: 8px;">秒</span>
          </el-form-item>
          <el-form-item label="并发数">
            <el-input-number v-model="validateConcurrency" :min="1" :max="10" :step="1" />
          </el-form-item>
        </el-form>
      </template>
      <template v-else>
        <el-progress
          :percentage="validateProgressPercent"
          :status="validateProgressStatus"
          :stroke-width="14"
        />
        <div class="validate-stat">
          <span>已验证 <b>{{ validateDone }}</b> / <b>{{ validateTotal }}</b></span>
          <span class="ok">有效 {{ validateOkCount }}</span>
          <span class="fail">失效 {{ validateFailCount }}</span>
        </div>
        <div class="validate-current">
          <span v-if="validateLastEvent">
            最后：
            <el-tag
              size="small"
              :type="validateLastEvent.ok ? 'success' : 'danger'"
              effect="light"
            >
              {{ validateLastEvent.ok ? '✓' : '✗' }} {{ validateLastEvent.name }}
            </el-tag>
            <span class="msg">{{ validateLastEvent.message }}</span>
          </span>
        </div>
      </template>
      <template #footer>
        <template v-if="!batchValidating">
          <el-button @click="showValidateDialog = false">取消</el-button>
          <el-button type="primary" @click="startBatchValidate">开始验证</el-button>
        </template>
        <template v-else>
          <el-button type="danger" @click="cancelBatchValidate">中止</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { sourceApi, type BookSource } from '@/api'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Link, Edit, CircleCheck, Loading, Refresh } from '@element-plus/icons-vue'
import type { ElTable } from 'element-plus'
import { isMediaLikeSource } from './mediaSourceClassifier'

const route = useRoute()
const sources = ref<any[]>([])
const groups = ref<string[]>([])
const selectedIds = ref<string[]>([])
const filterKeyword = ref('')
const filterGroup = ref('')
const filterStatus = ref('')
const filterCheckStatus = ref('')

// ===== 验证相关状态 =====
const showValidateDialog = ref(false)
const batchValidating = ref(false)
const validateKeyword = ref('诡秘之主')
const validateTimeout = ref(15)
const validateConcurrency = ref(5)
const validateTotal = ref(0)
const validateDone = ref(0)
const validateOkCount = ref(0)
const validateFailCount = ref(0)
const validateLastEvent = ref<{ id: string; name: string; ok: boolean; message: string } | null>(null)
const pendingValidateCount = ref(0)
let validateEventSource: EventSource | null = null

const validateProgressPercent = computed(() => {
  if (!validateTotal.value) return 0
  return Math.floor((validateDone.value / validateTotal.value) * 100)
})
const validateProgressStatus = computed(() => {
  if (validateDone.value < validateTotal.value) return ''
  return validateFailCount.value > 0 ? 'warning' : 'success'
})

function formatRespond(ms: number) {
  if (!ms || ms < 0) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const showAddDialog = ref(false)
const showUrlImportDialog = ref(false)
const editingSource = ref<BookSource | null>(null)
const saving = ref(false)
const urlImporting = ref(false)
const batchStatusUpdating = ref(false)
const dedupingSources = ref(false)
const importUrl = ref('')
const sourceFormRef = ref<FormInstance>()
const tableRef = ref<InstanceType<typeof ElTable>>()

const importUrlType = computed(() => {
  const value = importUrl.value.trim().toLowerCase()
  if (value.includes('/yuedu/rsss/') || value.includes('/yuedu/rss/')) return 'rss'
  if (value.includes('/yuedu/shuyuan/')) return 'book'
  if (value.includes('/yuedu/shuyuans/')) return 'book'
  if (value.startsWith('http://') || value.startsWith('https://')) return 'book'
  return 'unknown'
})

const pageTitle = computed(() => {
  if (route.path.includes('/admin/sources/validate')) return '书源一键验证'
  if (route.path.includes('/admin/sources/import')) return '书源导入'
  return '书源管理'
})

// 分页
const currentPage = ref(1)
const pageSize = ref(50)
const totalCount = computed(() => filteredSources.value.length)

const sourceForm = reactive({
  bookSourceName: '',
  bookSourceUrl: '',
  bookSourceGroup: '',
  weight: 0,
  enabled: true,
})

const sourceRules: FormRules = {
  bookSourceName: [{ required: true, message: '请输入书源名称', trigger: 'blur' }],
  bookSourceUrl: [{ required: true, message: '请输入书源地址', trigger: 'blur' }],
}

const filteredSources = computed(() => {
  let list = sources.value
  if (filterKeyword.value) {
    const kw = filterKeyword.value.toLowerCase()
    list = list.filter((s) => s.bookSourceName.toLowerCase().includes(kw))
  }
  if (filterGroup.value) {
    list = list.filter((s) => s.bookSourceGroup === filterGroup.value)
  }
  if (filterStatus.value === 'enabled') {
    list = list.filter((s) => s.enabled)
  } else if (filterStatus.value === 'disabled') {
    list = list.filter((s) => !s.enabled)
  }
  if (filterCheckStatus.value !== '') {
    const target = Number(filterCheckStatus.value)
    list = list.filter((s) => Number(s.lastCheckStatus ?? 0) === target)
  }
  return list
})

// 分页后的数据
const pagedSources = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSources.value.slice(start, start + pageSize.value)
})

async function loadSources() {
  try {
    const res: any = await sourceApi.getSources()
    // 后端返回下划线字段名，转换为驼峰格式（只映射列表需要的字段）
    sources.value = (res.data || res || []).map((s: any) => ({
      id: s.id,
      bookSourceName: s.book_source_name || s.bookSourceName || '未命名',
      bookSourceUrl: s.book_source_url || s.bookSourceUrl || '',
      bookSourceGroup: s.book_source_group || s.bookSourceGroup || '',
      bookSourceType: s.book_source_type ?? s.bookSourceType ?? 0,
      enabled: !!(s.enabled ?? s.enabled),
      enabledExplore: !!(s.enabled_explore ?? s.enabledExplore),
      customOrder: s.custom_order ?? s.customOrder ?? 0,
      weight: s.weight ?? 0,
      lastUpdateTime: s.last_update_time ?? s.lastUpdateTime ?? 0,
      respondTime: s.respond_time ?? s.respondTime ?? 0,
      lastCheckTime: s.last_check_time ?? s.lastCheckTime ?? null,
      lastCheckStatus: Number(s.last_check_status ?? s.lastCheckStatus ?? 0),
      lastCheckMessage: s.last_check_message ?? s.lastCheckMessage ?? '',
      bookSourceComment: s.book_source_comment ?? s.bookSourceComment ?? '',
      _validating: false,
    }))
  } catch {
    ElMessage.error('加载书源失败')
  }
}

async function loadGroups() {
  try {
    groups.value = await sourceApi.getSourceGroups()
  } catch {
    // ignore
  }
}

function handleSelectionChange(selection: BookSource[]) {
  selectedIds.value = selection.map((s) => s.id)
}

async function selectMediaSources() {
  const matched = filteredSources.value.filter(isMediaLikeSource)
  if (!matched.length) {
    ElMessage.info('当前筛选范围内没有发现媒体类书源')
    return
  }
  const matchedIds = matched.map((source) => source.id)
  const matchedSet = new Set(matchedIds)
  await nextTick()
  tableRef.value?.clearSelection()
  pagedSources.value.forEach((source) => {
    tableRef.value?.toggleRowSelection(source, matchedSet.has(source.id))
  })
  selectedIds.value = matchedIds
  ElMessage.success(`已选择 ${matched.length} 个媒体类书源，可继续批量禁用或删除`)
}

async function toggleSource(source: BookSource & { _toggling?: boolean }) {
  source._toggling = true
  try {
    await sourceApi.updateSource(source.id, { enabled: source.enabled })
    ElMessage.success(source.enabled ? '已启用' : '已禁用')
  } catch {
    source.enabled = !source.enabled
    ElMessage.error('操作失败')
  } finally {
    source._toggling = false
  }
}

function editSource(source: BookSource) {
  editingSource.value = source
  Object.assign(sourceForm, {
    bookSourceName: source.bookSourceName,
    bookSourceUrl: source.bookSourceUrl,
    bookSourceGroup: source.bookSourceGroup || '',
    weight: source.weight || 0,
    enabled: source.enabled,
  })
  showAddDialog.value = true
}

async function saveSource() {
  const valid = await sourceFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (!editingSource.value) return
    await sourceApi.updateSource(editingSource.value.id, { ...sourceForm })
    ElMessage.success('更新成功')
    showAddDialog.value = false
    editingSource.value = null
    resetForm()
    await loadSources()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function resetForm() {
  Object.assign(sourceForm, {
    bookSourceName: '',
    bookSourceUrl: '',
    bookSourceGroup: '',
    weight: 0,
    enabled: true,
  })
}

function deleteSource(source: BookSource) {
  ElMessageBox.confirm(`确定删除书源「${source.bookSourceName}」？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await sourceApi.deleteSources([source.id])
      ElMessage.success('删除成功')
      await loadSources()
    } catch {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

function batchDelete() {
  ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个书源？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await sourceApi.deleteSources(selectedIds.value)
      ElMessage.success('批量删除成功')
      await loadSources()
    } catch {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

async function batchUpdateEnabled(enabled: boolean) {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择书源')
    return
  }
  const actionText = enabled ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定${actionText}选中的 ${selectedIds.value.length} 个书源？`, '批量处理', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  batchStatusUpdating.value = true
  const ids = [...selectedIds.value]
  const selectedSet = new Set(ids)
  sources.value.forEach((source) => {
    if (selectedSet.has(source.id)) source._toggling = true
  })
  try {
    const results = await Promise.allSettled(ids.map((id) => sourceApi.updateSource(id, { enabled })))
    const okIds = ids.filter((_id, index) => results[index].status === 'fulfilled')
    const okSet = new Set(okIds)
    sources.value.forEach((source) => {
      if (okSet.has(source.id)) source.enabled = enabled
    })
    if (okIds.length === ids.length) {
      ElMessage.success(`已批量${actionText} ${okIds.length} 个书源`)
    } else {
      ElMessage.warning(`已${actionText} ${okIds.length} 个，失败 ${ids.length - okIds.length} 个`)
    }
  } finally {
    sources.value.forEach((source) => {
      if (selectedSet.has(source.id)) source._toggling = false
    })
    batchStatusUpdating.value = false
  }
}

async function dedupeSourceList() {
  try {
    await ElMessageBox.confirm('将按标准化后的书源地址去重，保留最早导入的书源，确定继续？', '书源去重', {
      confirmButtonText: '开始去重',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  dedupingSources.value = true
  try {
    const res: any = await sourceApi.dedupeSources()
    const data = res?.data || res || {}
    ElMessage.success(data.removed > 0 ? `已删除 ${data.removed} 个重复书源` : '没有发现重复书源')
    await loadSources()
  } catch (error: any) {
    ElMessage.error('书源去重失败：' + (error?.message || '未知错误'))
  } finally {
    dedupingSources.value = false
  }
}

async function handleUrlImport() {
  if (!importUrl.value.trim()) {
    ElMessage.warning('请输入书源链接')
    return
  }
  if (importUrlType.value === 'rss') {
    ElMessage.warning('这是订阅源集合链接，请不要在书源管理中导入')
    return
  }
  if (importUrlType.value !== 'book') {
    ElMessage.warning('请输入有效的 http/https 书源链接')
    return
  }
  urlImporting.value = true
  try {
    const res: any = await sourceApi.importSourcesFromUrl(importUrl.value.trim())
    if (res.code === 0) {
      ElMessage.success(`导入完成：成功 ${res.data.success} 个，失败 ${res.data.fail} 个`)
      showUrlImportDialog.value = false
      importUrl.value = ''
      await loadSources()
    } else {
      ElMessage.error(res.msg || '导入失败')
    }
  } catch (e: any) {
    ElMessage.error('导入失败：' + (e.message || '网络错误'))
  } finally {
    urlImporting.value = false
  }
}

onMounted(() => {
  loadSources()
  loadGroups()
})

// ============ 书源验证 ============

async function validateSingle(row: any) {
  if (row._validating) return
  row._validating = true
  try {
    const kw = (validateKeyword.value || '').trim() || '诡秘之主'
    const res: any = await sourceApi.validateSource(row.id, kw)
    const data = res?.data ?? res
    const ok = !!data?.ok
    row.lastCheckStatus = ok ? 1 : 2
    row.lastCheckMessage = data?.message || (ok ? '' : '验证失败')
    row.respondTime = data?.respondTime || 0
    row.lastCheckTime = Date.now()
    if (ok) {
      ElMessage.success(`「${row.bookSourceName}」验证通过 (${formatRespond(row.respondTime)})`)
    } else {
      ElMessage.warning(`「${row.bookSourceName}」验证失败：${row.lastCheckMessage}`)
    }
  } catch (e: any) {
    ElMessage.error('验证请求失败：' + (e?.message || '未知错误'))
  } finally {
    row._validating = false
  }
}

function openBatchValidateDialog() {
  // 决定要验证的范围：选中则验证选中，未选中则验证当前过滤后的全部
  const targetList: any[] = selectedIds.value.length > 0
    ? sources.value.filter((s) => selectedIds.value.includes(s.id))
    : filteredSources.value
  if (targetList.length === 0) {
    ElMessage.warning('当前没有可验证的书源')
    return
  }
  pendingValidateCount.value = targetList.length
  // 重置统计
  validateTotal.value = 0
  validateDone.value = 0
  validateOkCount.value = 0
  validateFailCount.value = 0
  validateLastEvent.value = null
  showValidateDialog.value = true
}

function startBatchValidate() {
  // 解析多个关键词：支持换行、逗号、中文逗号分隔
  const raw = (validateKeyword.value || '').trim()
  const keywords = raw
    ? raw.split(/[,，\n]+/).map((k) => k.trim()).filter(Boolean)
    : ['诡秘之主']
  const kw = keywords.join(',')

  const targetList: any[] = selectedIds.value.length > 0
    ? sources.value.filter((s) => selectedIds.value.includes(s.id))
    : filteredSources.value
  const ids = targetList.map((s) => s.id)
  if (ids.length === 0) {
    ElMessage.warning('没有可验证的书源')
    return
  }

  // 先把这些源标记为验证中
  for (const s of targetList) s._validating = true

  validateTotal.value = ids.length
  validateDone.value = 0
  validateOkCount.value = 0
  validateFailCount.value = 0
  validateLastEvent.value = null
  batchValidating.value = true

  const token = localStorage.getItem('token') || ''
  const params = new URLSearchParams({
    token,
    keyword: kw,
    timeout: String(validateTimeout.value * 1000),
    concurrency: String(validateConcurrency.value),
    ids: JSON.stringify(ids),
  })
  const url = `/api/sources/validate-stream?${params.toString()}`

  try {
    const es = new EventSource(url)
    validateEventSource = es

    es.addEventListener('start', (ev: any) => {
      try {
        const data = JSON.parse(ev.data)
        if (typeof data?.total === 'number') validateTotal.value = data.total
      } catch {}
    })

    es.addEventListener('progress', (ev: any) => {
      try {
        const data = JSON.parse(ev.data)
        validateDone.value++
        if (data.ok) validateOkCount.value++
        else validateFailCount.value++

        // 同步到表格行
        const row = sources.value.find((s) => s.id === data.id)
        if (row) {
          row.lastCheckStatus = data.ok ? 1 : 2
          row.lastCheckMessage = data.message || ''
          row.respondTime = data.respondTime || 0
          row.lastCheckTime = Date.now()
          row._validating = false
        }
        validateLastEvent.value = {
          id: data.id,
          name: data.name || row?.bookSourceName || '',
          ok: !!data.ok,
          message: data.message || '',
        }
      } catch {}
    })

    es.addEventListener('done', () => {
      finalizeValidate()
      ElMessage.success(`验证完成：有效 ${validateOkCount.value}，失效 ${validateFailCount.value}`)
    })

    es.addEventListener('error', () => {
      // SSE 异常，结束并提示
      finalizeValidate()
      if (validateDone.value < validateTotal.value) {
        ElMessage.error('验证连接异常已中断')
      }
    })
  } catch (e: any) {
    batchValidating.value = false
    ElMessage.error('启动验证失败：' + (e?.message || ''))
    for (const s of targetList) s._validating = false
  }
}

function finalizeValidate() {
  if (validateEventSource) {
    try { validateEventSource.close() } catch {}
    validateEventSource = null
  }
  // 清掉所有遗留 _validating
  for (const s of sources.value) if (s._validating) s._validating = false
  batchValidating.value = false

  // 自动选中所有失效书源
  const failedIds = sources.value
    .filter((s) => s.lastCheckStatus === 2)
    .map((s) => s.id)
  if (failedIds.length > 0) {
    nextTick(() => {
      // 先清空选中，再选中失效的
      tableRef.value?.clearSelection()
      for (const s of sources.value) {
        if (s.lastCheckStatus === 2) {
          tableRef.value?.toggleRowSelection(s, true)
        }
      }
    })
  }
}

function cancelBatchValidate() {
  ElMessageBox.confirm('确定中止当前验证任务吗？', '提示', {
    confirmButtonText: '中止',
    cancelButtonText: '继续',
    type: 'warning',
  }).then(() => {
    finalizeValidate()
    showValidateDialog.value = false
    ElMessage.info('已中止验证')
  }).catch(() => {})
}
</script>

<style scoped lang="scss">
.source-page {
  max-width: var(--app-content-width);
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;

  .filter-input {
    width: 240px;
  }
}

.source-table {
  border-radius: 8px;
  overflow: hidden;
}

.source-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.check-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  .check-text {
    color: var(--el-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 110px;
    &.danger {
      color: var(--el-color-danger);
    }
  }
}

.form-tips {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.validate-stat {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  font-size: 14px;
  b {
    color: var(--el-color-primary);
    font-weight: 600;
  }
  .ok {
    color: var(--el-color-success);
  }
  .fail {
    color: var(--el-color-danger);
  }
}

.validate-current {
  margin-top: 12px;
  min-height: 28px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  .msg {
    margin-left: 8px;
  }
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 8px 0;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .filter-bar {
    flex-wrap: wrap;

    .filter-input {
      width: 100%;
    }
  }
}
</style>
