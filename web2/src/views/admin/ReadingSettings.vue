<template>
  <div class="reading-settings-page">
    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <h2>阅读设置</h2>
            <p>控制未登录用户是否可以搜索，以及未登录可试读的章节数量。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="saveSettings">
            保存设置
          </el-button>
        </div>
      </template>

      <el-form label-width="180px" class="settings-form">
        <el-form-item label="未登录搜索">
          <el-switch
            v-model="form.guestSearchEnabled"
            active-text="允许"
            inactive-text="需要登录"
          />
          <div class="form-tip">
            关闭后，未登录用户点击搜索会提示先登录。
          </div>
        </el-form-item>

        <el-form-item label="未登录可阅读章节">
          <el-input-number
            v-model="form.guestReadChapterLimit"
            :min="-1"
            :max="9999"
            :step="1"
            controls-position="right"
          />
          <div class="form-tip">
            设置为 3 表示未登录只能读前 3 章；设置为 0 表示未登录不能阅读；设置为 -1 表示不限制。
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { configApi, unwrapResponse, type SiteConfigItem } from '@/api'

const saving = ref(false)

const form = reactive({
  guestSearchEnabled: true,
  guestReadChapterLimit: 3,
})

function configsToMap(items: SiteConfigItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.config_key] = item.config_value || ''
    return acc
  }, {})
}

function parseLimit(value: string | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(-1, Math.trunc(parsed))
}

async function loadSettings() {
  const items = unwrapResponse<SiteConfigItem[]>(await configApi.getAllConfigs()) || []
  const map = configsToMap(items)
  form.guestSearchEnabled = map.guest_search_enabled !== '0'
  form.guestReadChapterLimit = parseLimit(map.guest_read_chapter_limit)
}

async function saveSettings() {
  saving.value = true
  try {
    await configApi.updateConfigs([
      {
        config_key: 'guest_search_enabled',
        config_value: form.guestSearchEnabled ? '1' : '0',
      },
      {
        config_key: 'guest_read_chapter_limit',
        config_value: String(Math.trunc(form.guestReadChapterLimit)),
      },
    ])
    ElMessage.success('阅读设置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped lang="scss">
.reading-settings-page {
  .settings-card {
    border-radius: 12px;
  }

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
      color: #666;
      font-size: 13px;
    }
  }

  .settings-form {
    max-width: 720px;
  }

  .form-tip {
    width: 100%;
    margin-top: 8px;
    color: #888;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
