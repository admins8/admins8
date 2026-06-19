<template>
  <div class="schedule-page">
    <div class="page-header">
      <div>
        <h2>书源定时验证</h2>
        <p>按每月固定日期和时间自动验证书源，可选择失败后仅记录、自动禁用或删除。</p>
      </div>
      <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
    </div>

    <el-card class="config-card" shadow="never">
      <el-form v-loading="loading" :model="form" label-width="130px" class="schedule-form">
        <el-form-item label="启用定时验证">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-form-item label="执行时间">
          <div class="time-row">
            <span>每月</span>
            <el-input-number v-model="form.day" :min="1" :max="28" controls-position="right" />
            <span>号</span>
            <el-time-picker
              v-model="timeValue"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              style="width: 140px"
            />
          </div>
          <div class="form-tip">日期限制为 1-28 号，避免 2 月或小月缺少日期导致任务不执行。</div>
        </el-form-item>

        <el-form-item label="验证关键词">
          <el-input
            v-model="form.keyword"
            placeholder="例如：诡秘之主，凡人修仙传"
            clearable
          />
          <div class="form-tip">支持使用逗号分隔多个关键词，任一关键词搜索有结果即视为有效。</div>
        </el-form-item>

        <el-form-item label="验证范围">
          <el-radio-group v-model="form.scope">
            <el-radio-button label="enabled">启用书源</el-radio-button>
            <el-radio-button label="all">全部书源</el-radio-button>
            <el-radio-button label="failed">上次失效</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="失败处理">
          <el-radio-group v-model="form.failureAction">
            <el-radio-button label="none">仅记录</el-radio-button>
            <el-radio-button label="disable">自动禁用</el-radio-button>
            <el-radio-button label="delete">自动删除</el-radio-button>
          </el-radio-group>
          <div class="form-tip warning">自动删除不可恢复，建议先使用“仅记录”或“自动禁用”观察一段时间。</div>
        </el-form-item>

        <el-form-item label="单源超时">
          <el-input-number v-model="timeoutSeconds" :min="3" :max="60" controls-position="right" />
          <span class="unit">秒</span>
        </el-form-item>

        <el-form-item label="并发数">
          <el-input-number v-model="form.concurrency" :min="1" :max="10" controls-position="right" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="result-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>最近执行</span>
          <el-button type="success" :loading="running" @click="runNow">立即执行一次</el-button>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="最近时间">{{ formatDate(form.lastRunAt) }}</el-descriptions-item>
        <el-descriptions-item label="最近结果">{{ form.lastResult.message || '-' }}</el-descriptions-item>
        <el-descriptions-item label="验证总数">{{ form.lastResult.total }}</el-descriptions-item>
        <el-descriptions-item label="有效">{{ form.lastResult.okCount }}</el-descriptions-item>
        <el-descriptions-item label="失效">{{ form.lastResult.failCount }}</el-descriptions-item>
        <el-descriptions-item label="已禁用 / 已删除">
          {{ form.lastResult.disabledCount }} / {{ form.lastResult.deletedCount }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { sourceApi, unwrapResponse, type SourceValidationScheduleSettings } from '@/api'

const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const timeValue = ref('03:00')

const form = reactive<SourceValidationScheduleSettings>({
  enabled: false,
  day: 1,
  hour: 3,
  minute: 0,
  keyword: '诡秘之主',
  timeoutMs: 15000,
  concurrency: 5,
  scope: 'enabled',
  failureAction: 'none',
  lastRunKey: '',
  lastRunAt: '',
  lastResult: {
    total: 0,
    okCount: 0,
    failCount: 0,
    disabledCount: 0,
    deletedCount: 0,
    message: '',
  },
})

const timeoutSeconds = computed({
  get: () => Math.round(form.timeoutMs / 1000),
  set: (value: number) => {
    form.timeoutMs = value * 1000
  },
})

watch(timeValue, (value) => {
  const [hour, minute] = String(value || '03:00').split(':').map(Number)
  form.hour = Number.isFinite(hour) ? hour : 3
  form.minute = Number.isFinite(minute) ? minute : 0
})

function applySettings(settings: SourceValidationScheduleSettings) {
  Object.assign(form, settings)
  timeValue.value = `${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadSettings() {
  loading.value = true
  try {
    applySettings(unwrapResponse<SourceValidationScheduleSettings>(await sourceApi.getValidationSchedule()))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const settings = unwrapResponse<SourceValidationScheduleSettings>(await sourceApi.updateValidationSchedule({ ...form }))
    applySettings(settings)
    ElMessage.success('定时验证设置已保存')
  } finally {
    saving.value = false
  }
}

async function runNow() {
  running.value = true
  try {
    const res = unwrapResponse<{ result: any; settings: SourceValidationScheduleSettings }>(await sourceApi.runValidationScheduleNow())
    applySettings(res.settings)
    ElMessage.success('已完成一次书源验证')
  } finally {
    running.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.schedule-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 6px;
  color: #1f2d3d;
}

.page-header p {
  margin: 0;
  color: #7a869a;
}

.config-card,
.result-card {
  border-radius: 12px;
  margin-bottom: 18px;
}

.schedule-form {
  max-width: 760px;
}

.time-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.form-tip {
  width: 100%;
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.form-tip.warning {
  color: #e6a23c;
}

.unit {
  margin-left: 8px;
  color: #606266;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
