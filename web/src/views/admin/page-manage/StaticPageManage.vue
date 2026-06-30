<template>
  <div class="static-page-manage">
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="card-header">
          <div>
            <h2>{{ pageTitle }}</h2>
            <p>编辑前台静态页面内容和 SEO 信息。</p>
          </div>
          <el-button type="primary" :loading="saving" @click="savePage">保存页面</el-button>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="页面标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="页面内容（支持 HTML）">
          <el-input v-model="form.content" type="textarea" :rows="14" />
        </el-form-item>
        <el-divider content-position="left">SEO 设置</el-divider>
        <el-form-item label="SEO 标题">
          <el-input v-model="form.seo_title" />
        </el-form-item>
        <el-form-item label="SEO 关键词">
          <el-input v-model="form.seo_keywords" />
        </el-form-item>
        <el-form-item label="SEO 描述">
          <el-input v-model="form.seo_description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pageAdminApi } from '@/api'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const slug = computed(() => String(route.meta.slug || 'about'))
const pageTitle = computed(() => String(route.meta.title || '页面管理'))

const form = reactive({
  title: '',
  content: '',
  is_active: 1,
  seo_title: '',
  seo_keywords: '',
  seo_description: '',
})

async function loadPage() {
  loading.value = true
  try {
    const page = await pageAdminApi.getContentPage(slug.value)
    Object.assign(form, {
      title: page.title || '',
      content: page.content || '',
      is_active: Number(page.is_active) === 1 ? 1 : 0,
      seo_title: page.seo_title || '',
      seo_keywords: page.seo_keywords || '',
      seo_description: page.seo_description || '',
    })
  } catch {
    ElMessage.error('加载页面失败')
  } finally {
    loading.value = false
  }
}

async function savePage() {
  saving.value = true
  try {
    await pageAdminApi.updateContentPage(slug.value, form)
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

watch(slug, loadPage)
onMounted(loadPage)
</script>

<style scoped lang="scss">
.static-page-manage {
  .card-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;

    h2 {
      margin: 0 0 6px;
    }

    p {
      margin: 0;
      color: #909399;
    }
  }
}
</style>
