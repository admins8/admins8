<template>
  <div class="system-update">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span><el-icon><Refresh /></el-icon> 系统升级</span>
          <el-button :loading="checking" type="primary" plain @click="onCheck">检查更新</el-button>
        </div>
      </template>

      <div class="version-card">
        <span class="version-label">当前版本</span>
        <span class="version-number">{{ versionInfo.current || '-' }}</span>
        <el-tag v-if="checkResult?.hasUpdate && checkResult.latest" type="success" effect="light">
          可升级到 {{ checkResult.latest }} 版本
        </el-tag>
      </div>

      <el-alert
        v-if="checkResult"
        :title="checkResult.hasUpdate
          ? `发现新版本 ${checkResult.latest}`
          : (checkResult.reason || '当前已是最新版本')"
        :type="checkResult.hasUpdate ? 'success' : 'info'"
        show-icon
        style="margin-top: 16px"
        :closable="false"
      >
        <template v-if="checkResult.hasUpdate && checkResult.release?.changelog" #default>
          <div class="changelog">{{ checkResult.release.changelog }}</div>
        </template>
      </el-alert>
    </el-card>

    <el-card v-if="checkResult?.hasUpdate" shadow="never" style="margin-top: 16px">
      <template #header><span>在线升级</span></template>
      <el-steps :active="installStep" finish-status="success" align-center>
        <el-step title="下载并校验" />
        <el-step title="备份当前版本" />
        <el-step title="原子替换 + PM2 重载" />
        <el-step title="完成" />
      </el-steps>
      <div class="action-row">
        <el-button :loading="downloading" type="primary" :disabled="!checkResult?.hasUpdate" @click="onDownload">
          下载升级包
        </el-button>
        <el-button :loading="installing" type="success" :disabled="!prepared" @click="onInstall">
          应用升级（自动备份+回滚）
        </el-button>
      </div>
      <el-alert v-if="prepared" type="success" :closable="false" style="margin-top: 12px"
        :title="`已下载并解压：${prepared.version}，可点击「应用升级」`" show-icon />
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header><span>手动上传升级包</span></template>
      <p class="muted">
        当服务器无法访问 GitHub Pages 时，可在本地准备好 <code>update.zip</code> 与 <code>update.zip.sig</code> 后手动上传。
      </p>
      <el-upload
        :auto-upload="false"
        :limit="1"
        :on-change="onZipChange"
        :on-remove="() => (zipFile = null)"
        :file-list="zipFiles"
      >
        <el-button>选择 update.zip</el-button>
      </el-upload>
      <el-upload
        :auto-upload="false"
        :limit="1"
        :on-change="onSigChange"
        :on-remove="() => (sigFile = null)"
        :file-list="sigFiles"
        style="margin-top: 8px"
      >
        <el-button>选择 update.zip.sig</el-button>
      </el-upload>
      <div class="action-row">
        <el-button :loading="uploading" type="primary" :disabled="!zipFile || !sigFile" @click="onUpload">
          上传并校验
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>升级历史</span>
          <el-button text @click="loadHistory">刷新</el-button>
        </div>
      </template>
      <el-table :data="history" empty-text="暂无升级记录" border>
        <el-table-column label="时间" prop="finishedAt" width="180" />
        <el-table-column label="操作人" prop="operator" width="120" />
        <el-table-column label="版本变更" width="180">
          <template #default="{ row }">{{ row.fromVersion || '-' }} → {{ row.toVersion || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.success" type="success">成功</el-tag>
            <el-tag v-else-if="row.rolledBack" type="warning">已回滚</el-tag>
            <el-tag v-else type="danger">失败</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备份目录" prop="backupPath" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              v-if="row.backupPath"
              title="确定回滚到此备份吗？"
              @confirm="onRollback(row.backupPath)"
            >
              <template #reference>
                <el-button size="small" type="warning" plain>回滚</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { updateApi, type UpdateCheckResult, type UpdateHistoryRecord } from '@/api'

const versionInfo = ref<{ current: string; manifestUrl: string; online: boolean }>({
  current: '',
  manifestUrl: '',
  online: true,
})

const checking = ref(false)
const downloading = ref(false)
const installing = ref(false)
const uploading = ref(false)

const checkResult = ref<UpdateCheckResult | null>(null)
const prepared = ref<{ version: string; extractDir: string } | null>(null)
const installStep = ref(0)
const history = ref<UpdateHistoryRecord[]>([])

const zipFile = ref<File | null>(null)
const sigFile = ref<File | null>(null)
const zipFiles = ref<any[]>([])
const sigFiles = ref<any[]>([])

async function loadVersion() {
  try {
    versionInfo.value = await updateApi.getVersion()
  } catch {
    ElMessage.error('读取版本失败，请稍后重试')
  }
}

async function loadHistory() {
  try {
    history.value = await updateApi.history()
  } catch {
    ElMessage.error('读取升级历史失败，请稍后重试')
  }
}

async function onCheck() {
  checking.value = true
  try {
    checkResult.value = await updateApi.check()
    if (checkResult.value.hasUpdate) {
      ElMessage.success(`发现新版本 ${checkResult.value.latest}`)
    } else {
      ElMessage.info(checkResult.value.reason || '已是最新版本')
    }
  } catch {
    ElMessage.error('检查更新失败，请稍后重试')
  } finally {
    checking.value = false
  }
}

async function onDownload() {
  downloading.value = true
  installStep.value = 0
  try {
    prepared.value = await updateApi.download()
    installStep.value = 1
    ElMessage.success(`已下载并校验：${prepared.value.version}`)
  } catch {
    ElMessage.error('下载失败，请检查升级配置或稍后重试')
  } finally {
    downloading.value = false
  }
}

async function onInstall() {
  if (!prepared.value) return
  try {
    await ElMessageBox.confirm(
      `即将升级到 ${prepared.value.version}，期间服务会零停机重载，确认继续？`,
      '应用升级',
      { type: 'warning' }
    )
  } catch {
    return
  }
  installing.value = true
  installStep.value = 2
  try {
    const r = await updateApi.install()
    installStep.value = 4
    ElMessage.success(`升级完成：${r.fromVersion} → ${r.toVersion}`)
    prepared.value = null
    checkResult.value = null
    await loadVersion()
    await loadHistory()
  } catch {
    ElMessage.error('升级失败，系统已尝试自动回滚')
    await loadHistory()
  } finally {
    installing.value = false
  }
}

function onZipChange(file: any) {
  zipFile.value = file.raw
  zipFiles.value = [file]
}
function onSigChange(file: any) {
  sigFile.value = file.raw
  sigFiles.value = [file]
}

async function onUpload() {
  if (!zipFile.value || !sigFile.value) return
  uploading.value = true
  try {
    prepared.value = await updateApi.upload(zipFile.value, sigFile.value)
    ElMessage.success(`已上传并校验：${prepared.value.version}，可点击「应用升级」`)
    // 切换到对应步骤展示
    if (!checkResult.value) {
      checkResult.value = {
        hasUpdate: true,
        current: versionInfo.value.current,
        latest: prepared.value.version,
      } as UpdateCheckResult
    }
    installStep.value = 1
  } catch {
    ElMessage.error('上传或校验失败，请检查升级包后重试')
  } finally {
    uploading.value = false
  }
}

async function onRollback(backupPath: string) {
  try {
    await updateApi.rollback(backupPath)
    ElMessage.success('回滚成功')
    await loadVersion()
    await loadHistory()
  } catch {
    ElMessage.error('回滚失败，请检查备份状态后重试')
  }
}

onMounted(async () => {
  await loadVersion()
  await loadHistory()
  // 自动后台检查（不阻塞）
  if (versionInfo.value.online) {
    onCheck()
  }
})
</script>

<style scoped lang="scss">
.system-update {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.action-row {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.version-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}
.version-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.version-number {
  font-weight: 600;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
}
.muted { color: var(--el-text-color-secondary); }
.changelog {
  white-space: pre-line;
  margin-top: 6px;
  color: var(--el-text-color-regular);
}
</style>
