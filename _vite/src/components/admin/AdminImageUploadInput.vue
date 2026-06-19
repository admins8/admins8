<template>
  <div class="admin-image-upload-input">
    <div class="upload-row">
      <el-input
        v-model="imageUrl"
        :placeholder="placeholder"
        clearable
      />
      <el-upload
        action="/api/upload"
        name="file"
        :show-file-list="false"
        :headers="uploadHeaders"
        :on-success="handleSuccess"
        :on-error="handleError"
        :on-progress="handleProgress"
        :before-upload="beforeUpload"
        accept="image/*"
      >
        <el-button type="primary" :icon="Upload" :loading="uploading">
          {{ uploading ? '上传中...' : '上传图片' }}
        </el-button>
      </el-upload>
    </div>

    <div v-if="imageUrl && showPreview" class="preview">
      <el-image
        :src="imageUrl"
        :fit="previewFit"
        :style="{ height: previewHeight, maxWidth: previewMaxWidth }"
        :preview-src-list="[imageUrl]"
        preview-teleported
      />
      <div v-if="hint" class="preview-hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const imageUrl = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  placeholder?: string
  limitMb?: number
  showPreview?: boolean
  previewHeight?: string
  previewMaxWidth?: string
  previewFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down'
  hint?: string
}>(), {
  placeholder: '请输入图片 URL，或上传图片',
  limitMb: 5,
  showPreview: true,
  previewHeight: '96px',
  previewMaxWidth: '220px',
  previewFit: 'contain',
  hint: '',
})

const uploading = ref(false)

const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
})

function beforeUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请上传图片文件')
    return false
  }
  if (file.size / 1024 / 1024 >= props.limitMb) {
    ElMessage.error(`图片大小不能超过 ${props.limitMb}MB`)
    return false
  }
  uploading.value = true
  return true
}

function handleProgress() {
  uploading.value = true
}

function handleSuccess(response: any) {
  uploading.value = false
  const url = response?.data?.url || response?.url
  if (response?.code === 0 && url) {
    imageUrl.value = url
    ElMessage.success('上传成功')
    return
  }
  if (url) {
    imageUrl.value = url
    ElMessage.success('上传成功')
    return
  }
  ElMessage.error(response?.msg || '上传失败')
}

function handleError(error: Error) {
  uploading.value = false
  ElMessage.error(error?.message || '上传失败，请检查后端服务或登录状态')
}
</script>

<style scoped lang="scss">
.admin-image-upload-input {
  width: 100%;

  .upload-row {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .preview {
    margin-top: 10px;
  }

  .preview-hint {
    margin-top: 6px;
    color: #909399;
    font-size: 12px;
    line-height: 1.5;
  }
}

@media (max-width: 768px) {
  .admin-image-upload-input {
    .upload-row {
      align-items: stretch;
      flex-direction: column;
    }
  }
}
</style>
