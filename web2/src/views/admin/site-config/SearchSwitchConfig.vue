<template>
  <div class="search-switch-config-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <h2>搜索/换源配置</h2>
            <p>调整搜索速度、换源缓存、目录验证和书源并发参数。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-alert
        title="默认策略：搜索阶段不强制验证目录，详情页/阅读前再校验；换源结果缓存 1 小时；失败多、响应慢的书源会自动靠后。"
        type="info"
        show-icon
        :closable="false"
        class="tips"
      />

      <el-form label-position="top" class="config-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-card shadow="never" class="section-card">
              <template #header>搜索配置</template>
              <el-form-item label="搜索阶段强制验证目录">
                <el-switch
                  v-model="form.search_verify_toc"
                  active-value="true"
                  inactive-value="false"
                  active-text="开启"
                  inactive-text="关闭"
                />
                <div class="form-tip">关闭后搜索结果更快展示，详情页和阅读前仍会做可读性校验。</div>
              </el-form-item>
              <el-form-item label="单次搜索书源并发数">
                <el-input-number v-model="numbers.search_source_concurrency" :min="1" :max="50" />
              </el-form-item>
              <el-form-item label="搜索书源超时（毫秒）">
                <el-input-number v-model="numbers.search_source_timeout_ms" :min="1000" :max="30000" :step="500" />
              </el-form-item>
              <el-form-item label="搜索目录验证超时（毫秒）">
                <el-input-number v-model="numbers.search_toc_timeout_ms" :min="1000" :max="30000" :step="500" />
              </el-form-item>
            </el-card>
          </el-col>

          <el-col :span="12">
            <el-card shadow="never" class="section-card">
              <template #header>换源配置</template>
              <el-form-item label="单次换源书源并发数">
                <el-input-number v-model="numbers.source_switch_concurrency" :min="1" :max="80" />
              </el-form-item>
              <el-form-item label="换源搜索超时（毫秒）">
                <el-input-number v-model="numbers.source_switch_timeout_ms" :min="1000" :max="30000" :step="500" />
              </el-form-item>
              <el-form-item label="换源目录验证超时（毫秒）">
                <el-input-number v-model="numbers.source_switch_toc_timeout_ms" :min="1000" :max="30000" :step="500" />
              </el-form-item>
              <el-form-item label="换源结果缓存时间（秒）">
                <el-input-number v-model="numbers.alternate_source_cache_ttl_seconds" :min="0" :max="86400" :step="300" />
                <div class="form-tip">默认 3600 秒；设为 0 可关闭换源缓存。</div>
              </el-form-item>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" class="section-card request-card">
          <template #header>请求伪装与代理</template>
          <el-form-item label="模拟 UA">
            <el-input
              v-model="form.search_request_user_agents"
              type="textarea"
              :rows="6"
              placeholder="每行一个 User-Agent，例如：Mozilla/5.0 ..."
            />
            <div class="form-tip">搜索和换源搜索时，每次请求会随机取一个 UA；为空则使用默认随机 UA。此项设置不受代理影响。</div>
          </el-form-item>
          <el-form-item label="IP 代理池">
            <div class="proxy-input-row">
              <el-input
                v-model="form.search_request_proxy"
                type="textarea"
                :rows="5"
                placeholder="每行一个代理，例如：http://127.0.0.1:7890、socks5://127.0.0.1:1080"
                clearable
              />
              <el-button :loading="testingProxy" @click="testProxy">检测代理</el-button>
            </div>
            <div class="form-tip">仅用于搜索和换源请求；每行一个代理，随机选用。支持 HTTP/HTTPS/SOCKS5；只填 IP:端口时默认按 HTTP。</div>
            <el-alert
              v-if="proxyTestResult"
              class="proxy-test-result"
              :type="proxyTestResult.ok ? 'success' : 'error'"
              :title="proxyTestResult.ok ? `代理池可用：${proxyTestResult.available}/${proxyTestResult.total}` : '代理池不可用'"
              :description="proxyTestResultText"
              show-icon
              :closable="false"
            />
            <el-table v-if="proxyTestResults.length" :data="proxyTestResults" class="proxy-test-table" size="small">
              <el-table-column label="代理" prop="proxy" min-width="220" show-overflow-tooltip />
              <el-table-column label="结果" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.ok ? '可用' : '失败' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">{{ row.status ? `HTTP ${row.status}` : '-' }}</template>
              </el-table-column>
              <el-table-column label="耗时" width="90">
                <template #default="{ row }">{{ row.elapsedMs ? `${row.elapsedMs}ms` : '-' }}</template>
              </el-table-column>
              <el-table-column label="出口 IP" prop="outboundIp" min-width="140" show-overflow-tooltip />
              <el-table-column label="错误" min-width="180" show-overflow-tooltip>
                <template #default="{ row }">{{ row.error || row.message || '-' }}</template>
              </el-table-column>
            </el-table>
          </el-form-item>
        </el-card>
      </el-form>

      <template #footer>
        <el-button @click="resetDefaults">恢复推荐默认值</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'

const defaults = {
  search_verify_toc: 'false',
  search_source_concurrency: '50',
  search_source_timeout_ms: '5000',
  search_toc_timeout_ms: '3000',
  source_switch_concurrency: '50',
  source_switch_timeout_ms: '5000',
  source_switch_toc_timeout_ms: '3000',
  alternate_source_cache_ttl_seconds: '3600',
  search_request_user_agents: '',
  search_request_proxy: '',
}

const form = reactive<Record<string, string>>({ ...defaults })
const numbers = reactive<Record<string, number>>({
  search_source_concurrency: 50,
  search_source_timeout_ms: 5000,
  search_toc_timeout_ms: 3000,
  source_switch_concurrency: 50,
  source_switch_timeout_ms: 5000,
  source_switch_toc_timeout_ms: 3000,
  alternate_source_cache_ttl_seconds: 3600,
})

const saving = ref(false)
const testingProxy = ref(false)
const proxyTestResult = ref<any>(null)
const proxyTestResults = ref<any[]>([])

Object.keys(numbers).forEach((key) => {
  watch(() => numbers[key], (value) => {
    form[key] = String(value)
  })
})

function syncNumbers() {
  Object.keys(numbers).forEach((key) => {
    numbers[key] = Number.parseInt(form[key] || defaults[key as keyof typeof defaults], 10)
  })
}

async function loadConfig() {
  try {
    const res = await configApi.getAllConfigs()
    const configMap = configsToMap(res.data || [])
    Object.keys(defaults).forEach((key) => {
      form[key] = configMap[key] || defaults[key as keyof typeof defaults]
    })
    syncNumbers()
  } catch {
    ElMessage.error('加载搜索/换源配置失败')
  }
}

async function saveConfig() {
  saving.value = true
  try {
    await configApi.updateConfigs(Object.keys(defaults).map((config_key) => ({
      config_key,
      config_value: form[config_key] || defaults[config_key as keyof typeof defaults],
    })))
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const proxyTestResultText = computed(() => {
  if (!proxyTestResult.value) return ''
  const result = proxyTestResult.value
  if (result.ok) {
    return `检测 ${result.total} 个代理，${result.available} 个可用；搜索和换源会从代理池中随机选择。`
  }
  return result.total ? `检测 ${result.total} 个代理，0 个可用，请更换代理池。` : '请先填写代理地址'
})

async function testProxy() {
  const proxy = form.search_request_proxy.trim()
  if (!proxy) {
    ElMessage.warning('请先填写代理地址')
    return
  }
  testingProxy.value = true
  proxyTestResult.value = null
  proxyTestResults.value = []
  try {
    const res = await configApi.testProxy({
      proxy,
      userAgents: form.search_request_user_agents,
    })
    proxyTestResult.value = res.data || res
    proxyTestResults.value = proxyTestResult.value.results || []
    if (proxyTestResult.value.ok) {
      ElMessage.success(`代理检测通过：${proxyTestResult.value.available}/${proxyTestResult.value.total} 可用`)
    } else {
      ElMessage.error('代理池不可用')
    }
  } catch (err: any) {
    proxyTestResult.value = { ok: false, error: err?.message || '代理检测失败' }
    proxyTestResults.value = []
    ElMessage.error(proxyTestResult.value.error)
  } finally {
    testingProxy.value = false
  }
}

function resetDefaults() {
  Object.assign(form, defaults)
  syncNumbers()
}

onMounted(loadConfig)
</script>

<style scoped lang="scss">
.search-switch-config-page {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      margin: 0 0 6px;
      font-size: 22px;
    }

    p {
      margin: 0;
      color: #6b7280;
    }
  }

  .tips {
    margin-bottom: 20px;
  }

  .section-card {
    min-height: 420px;
  }

  .request-card {
    margin-top: 20px;
    min-height: auto;
  }

  .form-tip {
    margin-top: 6px;
    color: #909399;
    font-size: 12px;
    line-height: 1.5;
  }

  .proxy-input-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .proxy-test-result {
    margin-top: 10px;
  }

  .proxy-test-table {
    margin-top: 10px;
  }
}
</style>
