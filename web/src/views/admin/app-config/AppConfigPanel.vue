<template>
  <div class="app-config-panel">
    <el-form :model="config" label-width="140px" :rules="rules" ref="formRef">
      <el-divider content-position="left">基础配置</el-divider>

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

      <el-divider content-position="left">GitHub Actions 构建配置</el-divider>

      <el-alert
        title="配置说明"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        <template #default>
          <div class="github-help">
            <p>用于通过 GitHub Actions 远程构建 Android APK，无需在服务器安装 Android SDK。</p>
            <p><strong>配置步骤：</strong></p>
            <ol>
              <li>在 GitHub 创建仓库（或使用已有仓库），确保仓库中包含 <code>.github/workflows/build-android.yml</code> 工作流文件</li>
              <li>前往 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens，创建 Token</li>
              <li>Token 需要勾选 <code>Actions</code> 权限（Read and Write）</li>
              <li>将 Token、仓库所有者、仓库名称填写到下方对应字段</li>
              <li>在仓库的 Settings → Secrets and variables → Actions 中添加 <code>BUILD_CALLBACK_SECRET</code> 密钥，值与下方「回调密钥」一致</li>
            </ol>
            <p><strong>工作流示例（build-android.yml）：</strong></p>
            <pre class="workflow-example">name: Build Android APK
on:
  workflow_dispatch:
    inputs:
      task_id:
        description: 'Task ID'
        required: true
      version_name:
        description: 'Version Name'
        required: true
      version_code:
        description: 'Version Code'
        required: true
      callback_secret:
        description: 'Callback Secret'
        required: true
      callback_url:
        description: 'Callback URL'
        required: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'
      - run: chmod +x ./gradlew
      - run: ./gradlew assembleRelease
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: apk-${{ github.event.inputs.task_id }}
          path: app/build/outputs/apk/release/*.apk
      - name: Callback
        if: always()
        run: |
          STATUS="${{ job.status == 'success' && 'success' || 'failed' }}"
          curl -X POST "${{ github.event.inputs.callback_url }}" \
            -H "Content-Type: application/json" \
            -d "{\"task_id\":${{ github.event.inputs.task_id }},\"status\":\"$STATUS\",\"run_id\":${{ github.run_id }},\"callback_secret\":\"${{ github.event.inputs.callback_secret }}\"}"</pre>
          </div>
        </template>
      </el-alert>

      <el-form-item label="GitHub Token" prop="github_token">
        <el-input
          v-model="config.github_token"
          :name="tokenInputName"
          placeholder="ghp_xxxxxxxxxxxx"
          type="password"
          show-password
          autocomplete="new-password"
        >
          <template #append>
            <el-tooltip content="GitHub Personal Access Token，需 Actions 权限">
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="仓库所有者" prop="github_owner">
        <el-input v-model="config.github_owner" placeholder="your-github-username" />
      </el-form-item>

      <el-form-item label="仓库名称" prop="github_repo">
        <el-input v-model="config.github_repo" placeholder="your-repo-name" />
      </el-form-item>

      <el-form-item label="工作流文件">
        <el-input v-model="config.github_workflow" placeholder="build-android.yml" />
      </el-form-item>

      <el-form-item label="分支名">
        <el-input v-model="config.github_branch" placeholder="main" />
      </el-form-item>

      <el-form-item label="回调密钥">
        <el-input
          v-model="config.build_callback_secret"
          :name="secretInputName"
          placeholder="随机字符串"
          type="password"
          show-password
          autocomplete="new-password"
        />
      </el-form-item>

      <el-form-item label="配置状态">
        <el-tag :type="githubConfigured ? 'success' : 'danger'">
          {{ githubConfigured ? '已配置' : '未配置' }}
        </el-tag>
        <span v-if="githubConfigured" class="config-hint">
          仓库：{{ config.github_owner }}/{{ config.github_repo }}
        </span>
        <span v-else class="config-hint">请填写上方 GitHub Token、仓库所有者、仓库名称</span>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { appApi } from '@/api';

const config = ref({
  app_name: '',
  app_package: '',
  api_base_url: '',
  theme_color: '#409EFF',
  about_content: '',
  privacy_policy_url: '',
  user_agreement_url: '',
  github_token: '',
  github_owner: '',
  github_repo: '',
  github_workflow: 'build-android.yml',
  github_branch: 'main',
  build_callback_secret: '',
});

const saving = ref(false);
const formRef = ref();

// 防止浏览器自动填充：使用随机 name 属性
const tokenInputName = ref(`gh-token-${Date.now()}`);
const secretInputName = ref(`gh-secret-${Date.now()}`);

const githubConfigured = computed(() => {
  return !!(config.value.github_token && config.value.github_owner && config.value.github_repo);
});

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
    // 延迟重置，覆盖浏览器自动填充插件可能写入的值
    window.setTimeout(() => {
      tokenInputName.value = `gh-token-${Date.now()}`;
      secretInputName.value = `gh-secret-${Date.now()}`;
    }, 100);
  } catch { ElMessage.error('加载配置失败'); }
};

const saveConfig = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const data = { ...config.value };
    // 如果 token 是掩码格式（包含 ****），说明用户没有修改，不要提交
    if (data.github_token && data.github_token.includes('****')) {
      delete data.github_token;
    }
    if (data.build_callback_secret && data.build_callback_secret.includes('****')) {
      delete data.build_callback_secret;
    }
    await appApi.updateAppConfig(data);
    ElMessage.success('配置已保存');
  } catch { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
};

onMounted(loadConfig);
</script>

<style scoped lang="scss">
.app-config-panel {
  max-width: 800px;

  .github-help {
    font-size: 13px;
    line-height: 1.8;

    p { margin: 4px 0; }
    ol { padding-left: 20px; margin: 4px 0; }
    li { margin: 2px 0; }
    code {
      background: #f5f5f5;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
      color: #c7254e;
    }

    .workflow-example {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px;
      border-radius: 4px;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 400px;
      overflow-y: auto;
    }
  }

  .config-hint {
    margin-left: 12px;
    font-size: 13px;
    color: #909399;
  }
}
</style>
