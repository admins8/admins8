<template>
  <div class="database-manage">
    <div class="page-header">
      <div>
        <h2>数据库管理</h2>
        <p>用于备份、还原、优化和修复数据库表。还原数据前建议先做一次全库备份。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="loadingTables" @click="loadTables">刷新表</el-button>
        <el-button type="primary" :loading="backingUpAll" @click="handleBackupAll">全库备份</el-button>
      </div>
    </div>

    <el-alert
      title="数据还原会覆盖当前数据库中的同名表数据，请谨慎操作。建议在低峰期执行，并确保当前站点没有大量写入操作。"
      type="warning"
      show-icon
      :closable="false"
      class="mb16"
    />

    <el-card shadow="never" class="mb16">
      <template #header>
        <div class="card-header">
          <span>数据表</span>
          <span class="muted">总大小：{{ formatSize(tableSummary.totalSizeKB) }}，共 {{ tables.length }} 张表</span>
        </div>
      </template>

      <div class="toolbar">
        <el-button :disabled="!selectedTables.length" :loading="optimizing" @click="handleOptimize">
          优化选中表
        </el-button>
        <el-button :disabled="!selectedTables.length" :loading="repairing" @click="handleRepair">
          修复选中表
        </el-button>
        <el-button type="success" :disabled="selectedTables.length !== 1" :loading="backingUpTable" @click="handleBackupSelectedTable">
          备份选中表
        </el-button>
      </div>

      <el-table
        v-loading="loadingTables"
        :data="tables"
        border
        @selection-change="selectedTables = $event"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="name" label="表名" min-width="180" />
        <el-table-column prop="engine" label="引擎" width="90" />
        <el-table-column prop="rows" label="行数" width="110" align="right" />
        <el-table-column label="数据大小" width="110" align="right">
          <template #default="{ row }">{{ formatSize(row.dataSizeKB) }}</template>
        </el-table-column>
        <el-table-column label="索引大小" width="110" align="right">
          <template #default="{ row }">{{ formatSize(row.indexSizeKB) }}</template>
        </el-table-column>
        <el-table-column label="总大小" width="110" align="right">
          <template #default="{ row }">{{ formatSize(row.totalSizeKB) }}</template>
        </el-table-column>
        <el-table-column prop="collation" label="排序规则" min-width="150" />
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>备份文件</span>
          <span class="muted">总大小：{{ formatSize(backupSummary.totalSizeKB) }}，共 {{ backups.length }} 个文件</span>
        </div>
      </template>

      <div class="toolbar">
        <el-button :loading="loadingBackups" @click="loadBackups">刷新备份</el-button>
      </div>

      <el-table v-loading="loadingBackups" :data="backups" border>
        <el-table-column prop="fileName" label="文件名" min-width="260" />
        <el-table-column label="大小" width="110" align="right">
          <template #default="{ row }">{{ formatSize(row.sizeKB) }}</template>
        </el-table-column>
        <el-table-column label="备份时间" width="190">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" :loading="restoring === row.fileName" @click="handleRestore(row.fileName)">
              还原
            </el-button>
            <el-button size="small" type="danger" :loading="deleting === row.fileName" @click="handleDeleteBackup(row.fileName)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="resultDialogVisible" title="执行结果" width="720px">
      <el-table :data="operateResults" border max-height="420">
        <el-table-column prop="table" label="表名" min-width="180" />
        <el-table-column prop="operation" label="操作" width="90" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'error' ? 'danger' : row.status === 'warning' ? 'warning' : 'success'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="信息" min-width="220" />
        <el-table-column prop="durationMs" label="耗时(ms)" width="100" align="right" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { databaseApi, type DatabaseBackupFile, type DatabaseOperateResult, type DatabaseTableInfo } from '@/api'

const loadingTables = ref(false)
const loadingBackups = ref(false)
const backingUpAll = ref(false)
const backingUpTable = ref(false)
const optimizing = ref(false)
const repairing = ref(false)
const restoring = ref('')
const deleting = ref('')

const tables = ref<DatabaseTableInfo[]>([])
const backups = ref<DatabaseBackupFile[]>([])
const selectedTables = ref<DatabaseTableInfo[]>([])
const tableSummary = ref({ totalSizeKB: 0 })
const backupSummary = ref({ totalSizeKB: 0 })
const operateResults = ref<DatabaseOperateResult[]>([])
const resultDialogVisible = ref(false)

function formatSize(kb: number) {
  if (!Number.isFinite(kb)) return '-'
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GB`
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`
  return `${kb.toFixed(2)} KB`
}

function formatTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

async function loadTables() {
  loadingTables.value = true
  try {
    const res = await databaseApi.getTables()
    tables.value = res.tables || []
    tableSummary.value.totalSizeKB = res.totalSizeKB || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '读取数据表失败')
  } finally {
    loadingTables.value = false
  }
}

async function loadBackups() {
  loadingBackups.value = true
  try {
    const res = await databaseApi.getBackups()
    backups.value = res.files || []
    backupSummary.value.totalSizeKB = res.totalSizeKB || 0
  } catch (e: any) {
    ElMessage.error(e?.message || '读取备份文件失败')
  } finally {
    loadingBackups.value = false
  }
}

async function handleBackupAll() {
  await ElMessageBox.confirm('确认备份整个数据库吗？备份期间请勿关闭服务。', '全库备份', { type: 'warning' })
  backingUpAll.value = true
  try {
    const res = await databaseApi.backupAll()
    ElMessage.success(`备份成功：${res.fileName}`)
    await loadBackups()
  } catch (e: any) {
    ElMessage.error(e?.message || '全库备份失败')
  } finally {
    backingUpAll.value = false
  }
}

async function handleBackupSelectedTable() {
  const table = selectedTables.value[0]?.name
  if (!table) return
  backingUpTable.value = true
  try {
    const res = await databaseApi.backupTable(table)
    ElMessage.success(`备份成功：${res.fileName}`)
    await loadBackups()
  } catch (e: any) {
    ElMessage.error(e?.message || '备份数据表失败')
  } finally {
    backingUpTable.value = false
  }
}

async function handleOptimize() {
  const names = selectedTables.value.map((t) => t.name)
  if (!names.length) return
  optimizing.value = true
  try {
    operateResults.value = await databaseApi.optimize(names)
    resultDialogVisible.value = true
    ElMessage.success('数据表优化完成')
    await loadTables()
  } catch (e: any) {
    ElMessage.error(e?.message || '数据表优化失败')
  } finally {
    optimizing.value = false
  }
}

async function handleRepair() {
  const names = selectedTables.value.map((t) => t.name)
  if (!names.length) return
  await ElMessageBox.confirm('确认修复选中的数据表吗？MySQL 会根据表引擎返回实际修复结果。', '修复数据表', { type: 'warning' })
  repairing.value = true
  try {
    operateResults.value = await databaseApi.repair(names)
    resultDialogVisible.value = true
    ElMessage.success('数据表修复完成')
    await loadTables()
  } catch (e: any) {
    ElMessage.error(e?.message || '数据表修复失败')
  } finally {
    repairing.value = false
  }
}

async function handleRestore(fileName: string) {
  await ElMessageBox.confirm(`确认还原备份 ${fileName} 吗？该操作会写入当前数据库。`, '还原备份', { type: 'error' })
  restoring.value = fileName
  try {
    await databaseApi.restore(fileName)
    ElMessage.success('还原成功')
    await loadTables()
  } catch (e: any) {
    ElMessage.error(e?.message || '还原失败')
  } finally {
    restoring.value = ''
  }
}

async function handleDeleteBackup(fileName: string) {
  await ElMessageBox.confirm(`确认删除备份 ${fileName} 吗？`, '删除备份', { type: 'warning' })
  deleting.value = fileName
  try {
    await databaseApi.deleteBackup(fileName)
    ElMessage.success('删除成功')
    await loadBackups()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  } finally {
    deleting.value = ''
  }
}

onMounted(() => {
  loadTables()
  loadBackups()
})
</script>

<style scoped lang="scss">
.database-manage {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;

    h2 {
      margin: 0 0 8px;
      font-size: 22px;
      color: var(--el-text-color-primary);
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }

  .header-actions,
  .toolbar,
  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .toolbar {
    margin-bottom: 12px;
  }

  .card-header {
    justify-content: space-between;
  }

  .muted {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .mb16 {
    margin-bottom: 16px;
  }
}
</style>
