<template>
  <div class="app-config-panel">
    <el-form :model="config" label-width="120px" :rules="rules" ref="formRef">
      <el-form-item label="应用名称" prop="app_name">
        <el-input v-model="config.app_name" placeholder="搜猫阅读" />
      </el-form-item>
      <el-form-item label="包名" prop="app_package">
        <el-input v-model="config.app_package" placeholder="com.soumal.reader" />
      </el-form-item>
      <el-form-item label="服务器地址" prop="api_base_url">
        <el-input v-model="config.api_base_url" placeholder="https://soumal.com" />
      </el-form-item>
      <el-form-item label="主题色" prop="theme_color">
        <el-color-picker v-model="config.theme_color" />
      </el-form-item>
      <el-form-item label="隐私政策URL">
        <el-input v-model="config.privacy_policy_url" placeholder="https://soumal.com/privacy" />
      </el-form-item>
      <el-form-item label="用户协议URL">
        <el-input v-model="config.user_agreement_url" placeholder="https://soumal.com/agreement" />
      </el-form-item>
      <el-form-item label="About内容">
        <el-input v-model="config.about_content" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { appApi } from '@/api';

const config = ref({
  app_name: '',
  app_package: '',
  api_base_url: '',
  theme_color: '#409EFF',
  about_content: '',
  privacy_policy_url: '',
  user_agreement_url: '',
});

const saving = ref(false);
const formRef = ref();

const rules = {
  app_name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  app_package: [{ required: true, message: '请输入包名', trigger: 'blur' }],
  api_base_url: [{ required: true, message: '请输入服务器地址', trigger: 'blur' }],
};

const loadConfig = async () => {
  try {
    const res = await appApi.getAppConfig();
    const data = res.data || res;
    Object.assign(config.value, data);
  } catch { ElMessage.error('加载配置失败'); }
};

const saveConfig = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    await appApi.updateAppConfig(config.value);
    ElMessage.success('配置已保存');
  } catch { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
};

onMounted(loadConfig);
</script>
