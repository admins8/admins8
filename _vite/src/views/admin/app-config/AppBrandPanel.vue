<template>
  <div class="app-brand-panel">
    <el-row :gutter="40">
      <el-col :xs="24" :sm="12">
        <h4>应用图标</h4>
        <p class="tip">建议尺寸 1024x1024，PNG格式</p>
        <el-upload
          class="icon-uploader"
          action="/api/app/admin/upload-icon"
          :headers="uploadHeaders"
          :show-file-list="false"
          :on-success="onIconSuccess"
          :before-upload="beforeUpload"
          accept="image/*"
        >
          <img v-if="iconUrl" :src="iconUrl" class="icon-preview" />
          <el-icon v-else class="uploader-icon"><Plus /></el-icon>
        </el-upload>
      </el-col>
      <el-col :xs="24" :sm="12">
        <h4>启动图</h4>
        <p class="tip">建议尺寸 2732x2732，PNG格式</p>
        <el-upload
          class="splash-uploader"
          action="/api/app/admin/upload-splash"
          :headers="uploadHeaders"
          :show-file-list="false"
          :on-success="onSplashSuccess"
          :before-upload="beforeUpload"
          accept="image/*"
        >
          <img v-if="splashUrl" :src="splashUrl" class="splash-preview" />
          <el-icon v-else class="uploader-icon"><Plus /></el-icon>
        </el-upload>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getAppConfig } from '@/api/app';

const iconUrl = ref('');
const splashUrl = ref('');

const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
}));

const loadConfig = async () => {
  try {
    const res = await getAppConfig();
    if (res.data.code === 0 && res.data.data) {
      iconUrl.value = res.data.data.icon_path || '';
      splashUrl.value = res.data.data.splash_path || '';
    }
  } catch { ElMessage.error('加载配置失败'); }
};

const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isImage) { ElMessage.error('请上传图片文件'); return false; }
  if (!isLt10M) { ElMessage.error('图片大小不能超过10MB'); return false; }
  return true;
};

const onIconSuccess = (response: any) => {
  if (response.code === 0) {
    iconUrl.value = response.data.path;
    ElMessage.success('图标上传成功');
  } else { ElMessage.error(response.msg || '上传失败'); }
};

const onSplashSuccess = (response: any) => {
  if (response.code === 0) {
    splashUrl.value = response.data.path;
    ElMessage.success('启动图上传成功');
  } else { ElMessage.error(response.msg || '上传失败'); }
};

onMounted(loadConfig);
</script>

<style scoped lang="scss">
.app-brand-panel {
  h4 { margin: 0 0 8px; font-size: 16px; }
  .tip { color: #999; font-size: 12px; margin: 0 0 16px; }
  .icon-uploader,
  .splash-uploader {
    :deep(.el-upload) {
      border: 1px dashed #d9d9d9;
      border-radius: 6px;
      cursor: pointer;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .uploader-icon { font-size: 28px; color: #8c939d; }
  }
  .icon-uploader :deep(.el-upload) {
    width: 120px; height: 120px;
  }
  .icon-preview { width: 100%; height: 100%; object-fit: cover; }
  .splash-uploader :deep(.el-upload) {
    width: 200px; height: 356px;
  }
  .splash-preview { width: 100%; height: 100%; object-fit: cover; }
}
</style>
