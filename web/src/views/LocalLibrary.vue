<template>
  <div class="local-library-page">
    <section class="category-tabs">
      <button
        v-for="item in categories"
        :key="item"
        type="button"
        :class="{ active: activeCategory === item }"
        @click="changeCategory(item)"
      >
        {{ item }}
      </button>
    </section>

    <section class="library-panel">
      <header class="library-panel-header">
        <div>
          <h1>本地书库</h1>
          <p>已采集或缓存到本地的小说，共 {{ total }} 本</p>
        </div>
        <div class="library-search">
          <el-input
            v-model="keyword"
            placeholder="搜索书名、作者、分类或来源"
            clearable
            :prefix-icon="Search"
            @keyup.enter="loadLibrary(1)"
            @clear="loadLibrary(1)"
          />
          <el-button type="primary" :icon="Search" :loading="loading" @click="loadLibrary(1)">搜索</el-button>
        </div>
      </header>

      <div v-if="loading && books.length === 0" class="library-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在加载书库...</span>
      </div>

      <div v-else-if="books.length > 0" class="library-list">
        <article
          v-for="(book, index) in books"
          :key="book.bookUrl"
          class="library-row"
          @click="openBook(book)"
        >
          <div class="cover-wrap">
            <el-image
              :src="getBookCover(book.coverUrl, book.name, book.author, siteTitle)"
              fit="cover"
              @error="() => onBookCoverError(book.coverUrl, book.name)"
            />
            <span class="rank-badge">{{ rowNumber(index) }}</span>
          </div>

          <div class="book-info">
            <h2 :title="book.name">{{ book.name }}</h2>
            <div class="book-meta-line">
              <span>
                <el-icon><User /></el-icon>
                {{ cleanAuthor(book.author) }}
              </span>
              <i></i>
              <span>
                <el-icon><Collection /></el-icon>
                {{ displayCategory(book) }}
              </span>
              <i></i>
              <span :class="['status', isFinished(book) ? 'finished' : 'serial']">
                <el-icon><CircleCheck v-if="isFinished(book)" /><Sunny v-else /></el-icon>
                {{ isFinished(book) ? '完结' : '连载' }}
              </span>
            </div>
            <p class="intro">{{ book.intro || '暂无简介' }}</p>
            <p class="update-line">
              <span>最新更新</span>
              共 {{ book.totalChapterNum || 0 }} 章
              <template v-if="book.wordCount"> {{ book.wordCount }} 万字</template>
              <template v-if="book.updatedAt"> {{ formatDate(book.updatedAt) }}</template>
            </p>
          </div>
        </article>
      </div>

      <el-empty v-else description="暂无本地书籍" :image-size="180" />

      <div v-if="total > pageSize" class="library-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          background
          @current-change="loadLibrary"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheck, Collection, Loading, Search, Sunny, User } from '@element-plus/icons-vue'
import { configApi, homeApi, unwrapResponse, type LocalLibraryBook } from '@/api'
import { useBookCover } from '@/utils/bookCover'
import { saveDetailBook } from '@/utils/bookDetail'
import { configsToMap } from '@/utils/siteConfig'

const router = useRouter()
const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()

const categories = ['全部', '玄幻', '奇幻', '都市', '言情', '仙侠', '武侠', '历史', '军事', '科幻', '悬疑', '穿越', '网游', '同人', '其他']
const books = ref<LocalLibraryBook[]>([])
const keyword = ref('')
const activeCategory = ref('全部')
const page = ref(1)
const pageSize = 10
const total = ref(0)
const loading = ref(false)
const siteTitle = ref('搜书网')

async function loadSiteTitle() {
  try {
    const res = unwrapResponse<any[]>(await configApi.getPublicConfigs()) || []
    siteTitle.value = configsToMap(res).site_title || '搜书网'
  } catch {
    siteTitle.value = '搜书网'
  }
}

async function loadLibrary(nextPage = page.value) {
  loading.value = true
  try {
    page.value = nextPage
    const data = unwrapResponse(await homeApi.getLocalLibrary({
      keyword: keyword.value.trim(),
      category: activeCategory.value === '全部' ? '' : activeCategory.value,
      page: page.value,
      pageSize,
    }))
    books.value = data.items || []
    total.value = data.total || 0
  } catch {
    ElMessage.error('书库加载失败')
  } finally {
    loading.value = false
  }
}

function changeCategory(category: string) {
  activeCategory.value = category
  loadLibrary(1)
}

function rowNumber(index: number) {
  return (page.value - 1) * pageSize + index + 1
}

function cleanAuthor(author?: string) {
  return String(author || '佚名').replace(/^作者[:：]\s*/, '').trim() || '佚名'
}

function displayCategory(book: LocalLibraryBook) {
  const value = String(book.kind || book.category || '全部').trim()
  return value || '全部'
}

function isFinished(book: LocalLibraryBook) {
  const text = `${book.kind || ''}${book.category || ''}${book.latestChapterTitle || ''}`
  return /(完结|完本|大结局|终章)/.test(text)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function openBook(book: LocalLibraryBook) {
  if (!book.bookUrl) return
  saveDetailBook({
    bookUrl: book.bookUrl,
    sourceUrl: book.origin,
    sourceName: book.originName,
    name: book.name,
    author: book.author || '',
    coverUrl: book.coverUrl,
    intro: book.intro,
    kind: book.kind,
    type: book.type,
    latestChapterTitle: book.latestChapterTitle,
    wordCount: book.wordCount,
    _local: true,
    _readable: true,
  } as any)
  router.push({ name: 'BookDetail', query: { bookUrl: book.bookUrl, type: String(book.type ?? '') } })
}

onMounted(async () => {
  await loadSiteTitle()
  await loadLibrary(1)
})
</script>

<style scoped lang="scss">
.local-library-page {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 22px;
  overflow-x: auto;
  white-space: nowrap;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.05);

  button {
    flex: 0 0 auto;
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #263142;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.16s ease;

    &:hover {
      color: #2f80ed;
      background: #eef5ff;
    }

    &.active {
      color: #fff;
      background: #2f80ed;
      box-shadow: 0 6px 14px rgba(47, 128, 237, 0.24);
    }
  }
}

.library-panel {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.04);
}

.library-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 66px;
  padding: 18px 24px;
  border-bottom: 1px solid #f0f2f7;

  h1 {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
    color: #1e2736;
  }

  p {
    margin: 0;
    color: #8a94a6;
    font-size: 13px;
  }
}

.library-search {
  display: flex;
  gap: 10px;
  width: min(420px, 48%);

  .el-input {
    flex: 1;
  }
}

.library-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 260px;
  color: var(--el-text-color-secondary);
}

.library-list {
  background: #fff;
}

.library-row {
  display: flex;
  gap: 20px;
  min-height: 166px;
  padding: 22px 32px 20px 32px;
  border-bottom: 1px solid #f1f3f8;
  cursor: pointer;
  transition: background 0.16s ease;

  &:nth-child(even) {
    background: #fbfcff;
  }

  &:hover {
    background: #f6f9ff;

    .book-info h2 {
      color: #2f80ed;
    }
  }
}

.cover-wrap {
  position: relative;
  flex: 0 0 112px;
  width: 112px;
  height: 148px;
  overflow: hidden;
  border-radius: 6px;
  background: #eef1f6;
  box-shadow: 0 8px 20px rgba(18, 28, 45, 0.14);

  .el-image {
    width: 100%;
    height: 100%;
  }
}

.rank-badge {
  position: absolute;
  left: 0;
  top: 0;
  min-width: 36px;
  height: 30px;
  padding: 0 8px;
  line-height: 30px;
  color: #fff;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #ff6568, #ff4f6d);
  border-bottom-right-radius: 8px;
}

.book-info {
  flex: 1;
  min-width: 0;
  padding-top: 8px;

  h2 {
    margin: 0 0 12px;
    color: #151c29;
    font-size: 23px;
    line-height: 1.25;
    font-weight: 800;
    transition: color 0.16s ease;
  }
}

.book-meta-line {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #687386;
  font-size: 14px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  i {
    width: 1px;
    height: 14px;
    background: #d8dde6;
    font-style: normal;
  }

  .status {
    &.finished {
      color: #47b846;
    }

    &.serial {
      color: #f2a01b;
    }
  }
}

.intro {
  margin: 14px 0 10px;
  color: #5b6677;
  line-height: 1.75;
  font-size: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.update-line {
  margin: 0;
  color: #323d4f;
  font-size: 14px;

  span {
    color: #2f80ed;
    margin-right: 8px;
  }
}

.library-pagination {
  display: flex;
  justify-content: center;
  padding: 22px 0 24px;
}

@media (max-width: 768px) {
  .category-tabs {
    padding: 10px;
    gap: 6px;

    button {
      height: 32px;
      padding: 0 12px;
      font-size: 13px;
    }
  }

  .library-panel-header {
    align-items: stretch;
    flex-direction: column;
    padding: 16px;
  }

  .library-search {
    width: 100%;
    flex-direction: column;
  }

  .library-row {
    gap: 13px;
    padding: 16px 12px;
    min-height: 140px;
  }

  .cover-wrap {
    flex-basis: 82px;
    width: 82px;
    height: 112px;
  }

  .rank-badge {
    min-width: 30px;
    height: 26px;
    line-height: 26px;
    font-size: 14px;
  }

  .book-info {
    padding-top: 0;

    h2 {
      font-size: 18px;
      margin-bottom: 8px;
    }
  }

  .book-meta-line {
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12px;

    i {
      display: none;
    }
  }

  .intro {
    margin: 8px 0;
    font-size: 13px;
    line-height: 1.55;
    -webkit-line-clamp: 2;
  }

  .update-line {
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
