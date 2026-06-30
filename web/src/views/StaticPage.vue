<template>
  <div class="static-page">
    <el-card v-loading="loading" shadow="never">
      <h1>{{ page?.title || fallbackTitle }}</h1>
      <div v-if="page?.content" class="page-content" v-html="page.content" />
      <el-empty v-else-if="!loading" description="页面不存在或暂未启用" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { pageApi, type ContentPage } from '@/api'

const route = useRoute()
const loading = ref(false)
const page = ref<ContentPage | null>(null)

const slug = computed(() => String(route.meta.slug || route.params.slug || '').trim())
const fallbackTitle = computed(() => String(route.meta.title || '页面'))

async function loadPage() {
  if (!slug.value) return
  loading.value = true
  try {
    page.value = await pageApi.getContentPage(slug.value)
    document.title = page.value.seo_title || page.value.title || fallbackTitle.value
  } catch {
    page.value = null
  } finally {
    loading.value = false
  }
}

watch(slug, loadPage)
onMounted(loadPage)
</script>

<style scoped lang="scss">
.static-page {
  max-width: 980px;
  margin: 0 auto;

  h1 {
    margin: 0 0 24px;
    font-size: 28px;
  }

  .page-content {
    line-height: 1.9;
    color: var(--el-text-color-primary);
    word-break: break-word;

    :deep(p) {
      margin: 0 0 14px;
    }
  }
}
</style>
