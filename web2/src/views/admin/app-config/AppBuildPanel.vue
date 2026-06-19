<template>
  <div class="app-build-panel">
    <el-alert
      v-if="!tasks.length"
      title="暂无构建任务"
      description="在「版本管理」中点击「构建」按钮来创建构建任务。构建通过 GitHub Actions 云端执行，无需本地安装 Android SDK。"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <el-table :data="tasks" v-loading="loading" style="min-width: 720px">
      <el-table-column prop="id" label="任务ID" width="80" />
      <el-table-column prop="platform" label="平台" width="100">
        <template #default="{ row }">
          <el-tag :type="row.platform === 'android' ? 'success' : 'warning'">
            {{ row.platform === 'android' ? 'Android' : '鸿蒙' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version_name" label="版本号" width="120" />
      <el-table-column prop="status" label="状态" width="160">
        <template #default="{ row }">
          <div class="status-cell">
            <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
            <el-icon v-if="row.status === 'building'" class="is-loading"><Loading /></el-icon>
          </div>
          <div v-if="row.status === 'building'" class="status-hint">GitHub Actions 云端构建中...</div>
          <div v-else-if="row.status === 'failed' && row.build_log?.includes('GitHub')" class="status-hint error">
            请检查 .env 中 GitHub 配置
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column prop="completed_at" label="完成时间" width="180">
        <template #default="{ row }">{{ row.completed_at ? formatDate(row.completed_at) : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'success' && row.output_path" type="primary" size="small" @click="downloadApk(row)">下载</el-button>
          <el-button type="info" size="small" @click="viewLog(row)">日志</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showLogDialog" title="构建日志" width="700px">
      <pre class="build-log">{{ currentLog }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { appApi } from '@/api';

const tasks = ref<any[]>([]);
const loading = ref(false);
const showLogDialog = ref(false);
const currentLog = ref('');
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const statusType = (s: string) => ({ pending: 'info', building: 'warning', success: 'success', failed: 'danger' }[s] || 'info');
const statusText = (s: string) => ({ pending: '等待中', building: '构建中', success: '成功', failed: '失败' }[s] || s);
const formatDate = (d: string) => d ? new Date(d).toLocaleString('zh-CN') : '-';

const loadTasks = async () => {
  loading.value = true;
  try {
    const res = await appApi.listBuildTasks();
    if (res.code === 0) tasks.value = res.data || [];
  } catch { ElMessage.error('加载构建任务失败'); }
  finally { loading.value = false; }
};

const downloadApk = (row: any) => {
  const url = row.output_path?.replace('/uploads/', '/api/uploads/');
  if (url) window.open(url, '_blank');
};

const viewLog = (row: any) => {
  currentLog.value = row.build_log || '暂无日志';
  showLogDialog.value = true;
};

onMounted(() => {
  loadTasks();
  refreshTimer = setInterval(() => {
    if (tasks.value.some((t: any) => t.status === 'building' || t.status === 'pending')) loadTasks();
  }, 10000); // 每 10 秒轮询一次
});

onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>

<style scoped lang="scss">
.app-build-panel {
  .status-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .status-hint {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
    &.error { color: #f56c6c; }
  }
  .build-log {
    background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px;
    max-height: 400px; overflow-y: auto; font-family: Consolas, monospace;
    font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
  }
}
</style>
