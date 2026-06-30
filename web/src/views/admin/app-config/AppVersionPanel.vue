<template>
  <div class="app-version-panel">
    <div class="tab-header">
      <el-button type="primary" @click="showCreateDialog = true">创建版本</el-button>
    </div>

    <el-table :data="versions" v-loading="loading" style="min-width: 720px">
      <el-table-column prop="platform" label="平台" width="100">
        <template #default="{ row }">
          <el-tag :type="row.platform === 'android' ? 'success' : 'warning'">
            {{ row.platform === 'android' ? 'Android' : '鸿蒙' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version_name" label="版本号" width="120" />
      <el-table-column prop="version_code" label="版本代码" width="100" />
      <el-table-column prop="changelog" label="更新日志" show-overflow-tooltip />
      <el-table-column prop="force_update" label="强制升级" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.force_update" @change="toggleForceUpdate(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="is_published" label="已发布" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.is_published" @change="togglePublished(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="buildApp(row)">构建</el-button>
          <el-button type="danger" size="small" @click="deleteVersion(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="创建新版本" width="500px">
      <el-form :model="newVersion" label-width="100px" :rules="versionRules" ref="versionFormRef">
        <el-form-item label="平台" prop="platform">
          <el-select v-model="newVersion.platform" placeholder="选择平台">
            <el-option label="Android" value="android" />
            <el-option label="鸿蒙" value="harmony" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号" prop="version_name">
          <el-input v-model="newVersion.version_name" placeholder="1.0.0" />
        </el-form-item>
        <el-form-item label="版本代码" prop="version_code">
          <el-input-number v-model="newVersion.version_code" :min="1" />
        </el-form-item>
        <el-form-item label="更新日志">
          <el-input v-model="newVersion.changelog" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createVersion" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { appApi } from '@/api';

const versions = ref<any[]>([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const creating = ref(false);
const versionFormRef = ref();

const newVersion = ref({
  platform: 'android',
  version_name: '',
  version_code: 1,
  changelog: '',
});

const versionRules = {
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  version_name: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
  version_code: [{ required: true, message: '请输入版本代码', trigger: 'blur' }],
};

const loadVersions = async () => {
  loading.value = true;
  try {
    const res = await appApi.listAppVersions();
    if (res.code === 0) versions.value = res.data || [];
  } catch { ElMessage.error('加载版本列表失败'); }
  finally { loading.value = false; }
};

const createVersion = async () => {
  const valid = await versionFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  creating.value = true;
  try {
    await appApi.createAppVersion(newVersion.value);
    ElMessage.success('版本创建成功');
    showCreateDialog.value = false;
    loadVersions();
  } catch { ElMessage.error('创建失败'); }
  finally { creating.value = false; }
};

const toggleForceUpdate = async (row: any) => {
  try { await appApi.updateAppVersion(row.id, { force_update: row.force_update }); }
  catch { row.force_update = !row.force_update; ElMessage.error('更新失败'); }
};

const togglePublished = async (row: any) => {
  try { await appApi.updateAppVersion(row.id, { is_published: row.is_published }); }
  catch { row.is_published = !row.is_published; ElMessage.error('更新失败'); }
};

const buildApp = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要构建 ${row.platform} 版本 ${row.version_name} 吗？`, '确认构建');
    const res = await appApi.triggerBuild({
      platform: row.platform,
      version_name: row.version_name,
      version_code: row.version_code,
      version_id: row.id,
    });
    if (res.code === 0) {
      // 后端可能返回成功 code 但携带错误信息（如 GitHub Actions 未配置）
      const msg = res.data?.message || '';
      if (msg.includes('未配置') || msg.includes('未设置')) {
        ElMessage.warning(`构建任务已记录，但 ${msg}`);
      } else {
        ElMessage.success(`构建任务已创建，任务ID: ${res.data.task_id}`);
      }
    } else {
      ElMessage.error(res.msg || '构建失败');
    }
  } catch (e: any) {
    if (e === 'cancel') return;
    // 显示详细的网络/服务器错误信息
    const errMsg = e?.response?.data?.msg || e?.message || '构建失败，请检查网络或联系管理员';
    ElMessage.error(errMsg);
  }
};

const deleteVersion = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这个版本吗？', '确认删除');
    await appApi.deleteAppVersion(row.id);
    ElMessage.success('删除成功');
    loadVersions();
  } catch (e: any) { if (e !== 'cancel') ElMessage.error('删除失败'); }
};

onMounted(loadVersions);
</script>

<style scoped lang="scss">
.app-version-panel {
  .tab-header { margin-bottom: 16px; display: flex; justify-content: flex-end; }
}
</style>
