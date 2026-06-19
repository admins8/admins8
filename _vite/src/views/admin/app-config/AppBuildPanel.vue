<template>
  <div class="app-build-panel">
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
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
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
import { listBuildTasks } from '@/api/app';

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
    const res = await listBuildTasks();
    if (res.data.code === 0) tasks.value = res.data.data || [];
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
  }, 5000);
});

onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>

<style scoped lang="scss">
.app-build-panel {
  .build-log {
    background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px;
    max-height: 400px; overflow-y: auto; font-family: Consolas, monospace;
    font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
  }
}
</style>
