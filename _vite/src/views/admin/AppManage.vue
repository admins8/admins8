<template>
  <div class="app-manage">
    <div class="page-header">
      <h2>APP管理</h2>
      <p class="page-desc">管理移动应用配置、版本和构建</p>
    </div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="基础配置" name="config">
        <AppConfigPanel />
      </el-tab-pane>
      <el-tab-pane label="品牌配置" name="brand">
        <AppBrandPanel />
      </el-tab-pane>
      <el-tab-pane label="版本管理" name="versions">
        <AppVersionPanel />
      </el-tab-pane>
      <el-tab-pane label="构建任务" name="builds">
        <AppBuildPanel />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppConfigPanel from './app-config/AppConfigPanel.vue';
import AppBrandPanel from './app-config/AppBrandPanel.vue';
import AppVersionPanel from './app-config/AppVersionPanel.vue';
import AppBuildPanel from './app-config/AppBuildPanel.vue';

const activeTab = ref('config');
</script>

<style scoped lang="scss">
.app-manage {
  .page-header {
    margin-bottom: 20px;
    h2 { margin: 0 0 8px; font-size: 20px; }
    .page-desc { margin: 0; color: #666; font-size: 14px; }
  }
}
</style>
