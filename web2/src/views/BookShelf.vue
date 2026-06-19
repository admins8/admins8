<template>
  <div class="bookshelf-page">
    <!-- 左侧导航栏 -->
    <aside class="shelf-sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">我的书架</div>
        <el-menu
          :default-active="activeCategory"
          @select="handleCategoryChange"
    >
          <el-menu-item index="all">
            <el-icon><Grid /></el-icon>
            <span>全部书籍</span>
          </el-menu-item>
          <el-menu-item index="recent" class="mobile-hidden-shelf-entry">
            <el-icon><Clock /></el-icon>
            <span>最近阅读</span>
          </el-menu-item>
          <el-menu-item index="finished" class="mobile-hidden-shelf-entry">
            <el-icon><CircleCheck /></el-icon>
            <span>已读完</span>
          </el-menu-item>
        </el-menu>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">操作</div>
        <el-button
          type="primary"
          :icon="Search"
          class="sidebar-btn mobile-hidden-shelf-entry"
          @click="showSearch = true"
        >
          搜索书籍
        </el-button>
        <el-button
          type="success"
          :icon="Plus"
          class="sidebar-btn mobile-hidden-shelf-entry"
          @click="showAddDialog = true"
        >
          添加书籍
        </el-button>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="shelf-content">
      <!-- 顶部搜索栏 -->
      <div class="content-header">
        <h2 class="page-title">{{ categoryTitle }}</h2>
        <div class="header-actions">
          <el-input
            v-model="searchKeyword"
            placeholder="在书架中搜索..."
            prefix-icon="Search"
            clearable
            class="search-input"
          />
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="grid">
              <el-icon><Grid /></el-icon>
            </el-radio-button>
            <el-radio-button value="list">
              <el-icon><List /></el-icon>
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 书籍网格 -->
      <div v-if="filteredBooks.length > 0" :class="['book-grid', viewMode]">
        <div
          v-for="book in filteredBooks"
          :key="book.bookUrl"
          class="book-card"
          @click="openBook(book)"
        >
          <div class="book-cover">
            <el-image
              :src="getBookCover(book.coverUrl, book.name, book.author, siteTitle)"
              fit="cover"
              @error="() => onBookCoverError(book.coverUrl, book.name)"
            />
            <div v-if="book.durChapterTitle" class="book-progress">
              {{ book.durChapterTitle }}
            </div>
          </div>
          <div class="book-info">
            <div class="book-name" :title="book.name">{{ book.name }}</div>
            <div class="book-author" :title="book.author">{{ book.author }}</div>
          </div>
          <div class="book-actions" @click.stop>
            <el-dropdown trigger="click">
              <el-button type="info" :icon="MoreFilled" circle size="small" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openBook(book)">
                    <el-icon><Reading /></el-icon>开始阅读
                  </el-dropdown-item>
                  <el-dropdown-item @click="confirmRemoveBook(book)">
                    <el-icon color="#f56c6c"><Delete /></el-icon>移出书架
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty v-else description="书架空空如也，快去添加书籍吧" :image-size="200">
        <el-button type="primary" class="mobile-hidden-empty-search" @click="showSearch = true">搜索书籍</el-button>
      </el-empty>
    </main>

    <!-- 搜索对话框 -->
    <el-dialog v-model="showSearch" title="搜索书籍" width="600px" destroy-on-close>
      <el-input
        v-model="searchInput"
        placeholder="输入书名或作者名搜索"
        size="large"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button
            :icon="Search"
            :loading="bookStore.loading"
            :disabled="bookStore.loading"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </template>
      </el-input>

      <div v-if="bookStore.searchResults.length > 0" class="search-results" ref="searchResultsEl" @scroll="onSearchScroll">
        <div
          v-for="(item, index) in bookStore.searchResults"
          :key="item.bookUrl + '-' + index"
          class="search-result-item search-result-item-new"
        >
          <!-- 左侧封面 -->
          <div class="result-cover-wrap">
            <el-image
              :src="getBookCover(item.coverUrl, item.name, item.author, siteTitle)"
              fit="cover"
              class="result-cover-img"
              @error="() => onBookCoverError(item.coverUrl, item.name)"
            >
              <template #error>
                <div class="cover-fallback cover-fallback-small">
                  <span>{{ item.name?.[0] }}</span>
                </div>
              </template>
            </el-image>
          </div>

          <!-- 中间：标题 + 元信息 + 简介 + 最新 -->
          <div class="result-info" @click="goToDetail(item)">
            <div class="result-name-row">
              <span class="result-name">{{ item.name }}</span>
              <el-tag v-if="(item as any)._local" size="small" type="warning" class="result-kind-tag">已缓存</el-tag>
              <el-tag v-else-if="(item as any)._cached" size="small" type="info" class="result-kind-tag">缓存中</el-tag>
              <el-tag v-if="item.kind" size="small" type="warning" class="result-kind-tag">{{ item.kind }}</el-tag>
            </div>
            <div class="result-meta">
              <span class="result-author">
                <el-icon><User /></el-icon>
                {{ item.author || '佚名' }}
              </span>
              <span class="result-meta-dot">|</span>
              <span class="result-source">
                <el-icon><Link /></el-icon>
                {{ item.sourceName || '未知来源' }}
              </span>
              <span v-if="item.wordCount" class="result-meta-dot">|</span>
              <span v-if="item.wordCount" class="result-wordcount">
                <el-icon><Document /></el-icon>
                {{ item.wordCount }}
              </span>
            </div>
            <div v-if="item.intro" class="result-intro">{{ item.intro }}</div>
            <div v-if="item.latestChapterTitle" class="result-latest">
              <span class="result-latest-label">最新章节</span>
              <span class="result-latest-text">{{ item.latestChapterTitle }}</span>
            </div>
          </div>

          <!-- 右侧按钮（横排等宽） -->
          <div class="result-actions" @click.stop>
            <el-button type="danger" class="btn-detail" @click="goToDetail(item)">书籍详情</el-button>
            <el-button
              v-if="isBookInShelf(item.name, item.author)"
              class="btn-add btn-added"
              disabled
            >已加书架</el-button>
            <el-button v-else type="primary" class="btn-add" @click="addFromSearch(item)">加入书架</el-button>
          </div>
        </div>
        <div v-if="bookStore.hasMoreSources && !bookStore.loading" class="continue-search-bar">
          <span>已搜索 {{ bookStore.searchProgress?.searched || bookStore.nextSearchStart }}/{{ bookStore.searchProgress?.total || 0 }} 个书源，找到 {{ bookStore.searchResults.length }} 条结果</span>
          <el-button type="primary" :icon="Search" @click="bookStore.continueSearch()">
            继续搜索下一批
          </el-button>
        </div>
        <div v-else-if="bookStore.loading && bookStore.searchResults.length > 0" class="continue-search-bar searching">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在搜索中...</span>
        </div>
        <div v-else-if="!bookStore.hasMoreSources && bookStore.searchResults.length > 0 && !bookStore.loading" class="search-done-bar">
          <span>✓ 已搜索完全部书源，共找到 {{ bookStore.searchResults.length }} 条结果</span>
        </div>
      </div>
      <div v-else-if="bookStore.loading && bookStore.searchResults.length === 0" class="search-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span v-if="bookStore.searchProgress">
          正在搜索... 已搜索 {{ bookStore.searchProgress.searched }}/{{ bookStore.searchProgress.total }} 个书源，找到 {{ bookStore.searchResults.length }} 条结果
        </span>
        <span v-else>正在搜索中...</span>
      </div>
      <el-empty
        v-else-if="searchDone"
        description="未找到相关书籍"
        :image-size="100"
      />
    </el-dialog>

    <!-- 添加书籍对话框 -->
    <el-dialog v-model="showAddDialog" title="添加书籍" width="500px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="书籍URL">
          <el-input
            v-model="addBookUrl"
            placeholder="输入书籍详情页URL"
            clearable
          />
        </el-form-item>
        <el-form-item label="书源URL（可选）">
          <el-input
            v-model="addSourceUrl"
            placeholder="指定书源URL"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="addingBook" @click="handleAddBook">
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '@/store/book'
import { useAuthStore } from '@/store/auth'
import { ElMessage, ElMessageBox, ElIcon } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import {
  Search, Plus, Grid, List, Clock, CircleCheck,
  MoreFilled, Picture, Reading, Delete, User, Link, Document,
} from '@element-plus/icons-vue'
import { settingsApi, configApi, unwrapResponse, type Book, type SearchResult } from '@/api'
import { coverForSearch, resolveBookCover, useBookCover } from '@/utils/bookCover'
import { configsToMap } from '@/utils/siteConfig'
import { saveDetailBook } from '@/utils/bookDetail'

const router = useRouter()
const bookStore = useBookStore()
const authStore = useAuthStore()

const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()
const activeCategory = ref('all')
const viewMode = ref<'grid' | 'list'>('grid')
const searchKeyword = ref('')
const siteTitle = ref('搜书网')

async function loadSiteTitle() {
  try {
    const res = unwrapResponse<any[]>(await configApi.getPublicConfigs()) || []
    const cfgMap = configsToMap(res)
    siteTitle.value = cfgMap.site_title || '搜书网'
  } catch {
    // 静默失败，保留默认值
  }
}
const showSearch = ref(false)
const showAddDialog = ref(false)
const showSettingsDialog = ref(false)
const legadoAppUrl = ref('')
const testingApp = ref(false)
const savingApp = ref(false)
const searchInput = ref('')
const searchDone = ref(false)
const addBookUrl = ref('')
const addSourceUrl = ref('')
const addingBook = ref(false)
const searchResultsEl = ref<HTMLElement | null>(null)

const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzQwOUVGRiIvPjx0ZXh0IHg9IjYwIiB5PSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iNDAiPvCfk6E8L3RleHQ+PC9zdmc+'

const categoryTitle = computed(() => {
  const map: Record<string, string> = {
    all: '全部书籍',
    recent: '最近阅读',
    finished: '已读完',
  }
  return map[activeCategory.value] || '全部书籍'
})

const filteredBooks = computed(() => {
  let books = bookStore.shelf
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    books = books.filter(
      (b) =>
        b.name?.toLowerCase().includes(kw) ||
        b.author?.toLowerCase().includes(kw)
    )
  }
  return books
})

function onSearchScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
    if (bookStore.hasMoreSources && !bookStore.loading) {
      bookStore.continueSearch()
    }
  }
}

function handleCategoryChange(index: string) {
  activeCategory.value = index
}

function openBook(book: Book) {
  if (!book.bookUrl) return
  bookStore.setCurrentBook(book)
  router.push({
    name: 'BookDetail',
    query: {
      bookUrl: book.bookUrl,
      name: book.name || '',
      author: book.author || '',
      coverUrl: book.coverUrl || '',
      intro: book.intro || '',
      sourceUrl: book.origin || '',
      sourceName: book.originName || '',
    },
  })
}

function confirmRemoveBook(book: Book) {
  ElMessageBox.confirm(`确定将《${book.name}》移出书架？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await bookStore.removeBook(book.bookUrl!)
      ElMessage.success('已移出书架')
    } catch {
      ElMessage.error('操作失败')
    }
  }).catch(() => {})
}

async function handleSearch() {
  if (!searchInput.value.trim()) return
  if (bookStore.loading) {
    ElMessage.warning('正在搜索中，请稍后')
    return
  }
  if (!authStore.isLoggedIn) {
    ElMessageBox.confirm('请先登录后再搜索书籍', '提示', {
      confirmButtonText: '去登录',
      cancelButtonText: '取消',
      type: 'info',
    }).then(() => {
      showSearch.value = false
      router.push('/login')
    }).catch(() => {})
    return
  }
  searchDone.value = false
  await bookStore.search(searchInput.value)
  searchDone.value = true
}

async function openSettingsDialog() {
  try {
    const res: any = await settingsApi.getAppSettings()
    legadoAppUrl.value = res.data?.legadoAppUrl || ''
  } catch {
    legadoAppUrl.value = ''
  }
  showSettingsDialog.value = true
}

async function testAppConnection() {
  if (!legadoAppUrl.value) {
    ElMessage.warning('请先输入 APP 地址')
    return
  }
  testingApp.value = true
  try {
    const resp = await fetch(legadoAppUrl.value.replace(/\/$/, '') + '/getSources', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    if (resp.ok) {
      ElMessage.success('连接成功！阅读 APP 可用')
    } else {
      ElMessage.error(`连接失败：HTTP ${resp.status}`)
    }
  } catch {
    ElMessage.error('连接失败，请检查地址是否正确，APP 是否开启了 Web 服务')
  } finally {
    testingApp.value = false
  }
}

async function saveAppSettings() {
  savingApp.value = true
  try {
    await settingsApi.setAppSettings({ legadoAppUrl: legadoAppUrl.value })
    ElMessage.success('设置已保存')
    showSettingsDialog.value = false
  } catch {
    ElMessage.error('保存失败')
  } finally {
    savingApp.value = false
  }
}

// 规范化作者字段
function normalizeAuthor(raw: string | undefined | null): string {
  if (!raw) return ''
  let s = String(raw).trim()
  if (!s || s.length > 80 || /[\n\r\t]/.test(s)) return ''
  s = s.replace(/^作\s*者\s*[:：\-=\s]+/, '').trim()
  s = s.replace(/^author\s*[:：\-=\s]+/i, '').trim()
  s = s.replace(/[，。,;；\s]+$/g, '').trim()
  return s
}

// 规范化书名
function normalizeBookName(raw: string | undefined | null): string {
  if (!raw) return ''
  return String(raw).trim()
    .replace(/[《》<>〈〉【】\[\]「」『』]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase()
}

// 判断书籍是否已在书架中（按书名+作者规范化匹配
function isBookInShelf(name: string | undefined | null, author: string | undefined | null): boolean {
  return bookStore.isInShelf({ name: name || '', author: author || '' } as any)
}

async function addFromSearch(item: SearchResult) {
  try {
    await bookStore.addBook(item.bookUrl, item.sourceUrl, {
      name: item.name,
      author: item.author,
      coverUrl: item.coverUrl,
      intro: item.intro,
      originName: item.sourceName
    })
    ElMessage.success('已添加到书架')
    showSearch.value = false
  } catch {
    ElMessage.error('添加失败')
  }
}

function goToDetail(item: SearchResult) {
  if (!item.bookUrl) return
  saveDetailBook(item)
  showSearch.value = false
  router.push({
    name: 'BookDetail',
    query: {
      bookUrl: item.bookUrl,
    },
  })
}

async function handleAddBook() {
  if (!addBookUrl.value.trim()) {
    ElMessage.warning('请输入书籍URL')
    return
  }
  addingBook.value = true
  try {
    await bookStore.addBook(addBookUrl.value, addSourceUrl.value || undefined)
    ElMessage.success('添加成功')
    showAddDialog.value = false
    addBookUrl.value = ''
    addSourceUrl.value = ''
  } catch {
    ElMessage.error('添加失败，请检查URL是否正确')
  } finally {
    addingBook.value = false
  }
}

onMounted(async () => {
  await loadSiteTitle()
  bookStore.loadShelf()
})
</script>

<style scoped lang="scss">
.bookshelf-page {
  display: flex;
  gap: 20px;
  height: calc(100vh - 100px);
  width: 100%;
  max-width: var(--app-content-width);
  margin: 0 auto;
}

.shelf-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;

  .sidebar-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    padding: 8px 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .el-menu {
    border-right: none;

    .el-menu-item {
      height: 40px;
      line-height: 40px;
      border-radius: 8px;
      margin-bottom: 2px;
    }
  }

  .sidebar-btn {
    width: 100%;
    margin-left: 0 !important;
    margin-bottom: 8px;
    justify-content: flex-start !important;
    text-align: left !important;
    height: 38px;

    :deep(span) {
      flex: 1;
      text-align: left !important;
      justify-content: flex-start !important;
    }

    :deep(.el-icon) {
      margin-right: 6px;
    }
  }
}

.shelf-content {
  flex: 1;
  overflow-y: auto;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .search-input {
      width: 240px;
    }
  }
}

.book-grid {
  display: grid;
  gap: 20px;

  &.grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  &.list {
    grid-template-columns: 1fr;

    .book-card {
      flex-direction: row;
      height: auto;
      padding: 12px;

      .book-cover {
        width: 80px;
        height: 110px;
        margin-right: 16px;
        flex-shrink: 0;
      }

      .book-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .book-actions {
        position: static;
        opacity: 1;
        align-self: center;
      }
    }
  }
}

.book-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

    .book-actions {
      opacity: 1;
    }
  }

  .book-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;

    .el-image {
      width: 100%;
      height: 100%;
    }

    .book-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 4px 8px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      color: white;
      font-size: 11px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #409eff, #67c23a);
    color: white;
    font-size: 32px;
    font-weight: 700;

    &.small {
      font-size: 18px;

      .el-icon {
        display: none;
      }
    }
  }

  .book-info {
    padding: 10px 12px;

    .book-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 4px;
    }

    .book-author {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .book-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0.6;
    transition: opacity 0.2s;
    z-index: 1;
  }
}

:deep(.el-dialog__body) {
  text-align: left;
}

.search-results {
  margin-top: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.continue-search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin: 12px 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);

  &.searching {
    justify-content: center;
    gap: 8px;
    color: var(--el-color-primary);
  }
}

.search-done-bar {
  text-align: center;
  padding: 12px;
  color: var(--el-color-success);
  font-size: 13px;
  background: var(--el-color-success-light-9);
  border-radius: 8px;
  margin-top: 12px;
}

.search-result-item.search-result-item-new {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-fill-color-light);
  }

  .result-cover-wrap {
    flex-shrink: 0;
    width: 70px;
    height: 96px;

    .result-cover-img {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);

      :deep(.el-image) {
        width: 100%;
        height: 100%;
      }
    }
  }

  .result-info {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .result-name-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .result-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .result-kind-tag {
        flex-shrink: 0;
      }
    }

    .result-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      .result-author,
      .result-source,
      .result-wordcount {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }

      .result-meta-dot {
        color: var(--el-border-color);
      }
    }

    .result-intro {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }

    .result-latest {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 2px;

      .result-latest-label {
        color: var(--el-color-primary);
      }

      .result-latest-text {
        color: var(--el-text-color-regular);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .result-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;

    .btn-detail {
      flex: 1;
      min-width: 90px;
      background: #fff;
      color: var(--el-color-danger);
      border: 1px solid var(--el-color-danger);
      padding: 8px 12px;
      font-size: 12px;

      &:hover {
        background: var(--el-color-danger);
        color: #fff;
      }
    }

    .btn-add {
      flex: 1;
      min-width: 90px;
      background: #fff;
      color: var(--el-color-primary);
      border: 1px solid var(--el-color-primary);
      padding: 8px 12px;
      font-size: 12px;

      &:hover {
        background: var(--el-color-primary);
        color: #fff;
      }
    }

    .btn-added {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
      border-color: var(--el-border-color);
      cursor: not-allowed;

      &:hover {
        background: var(--el-fill-color-light);
        color: var(--el-text-color-regular);
      }
    }
  }
}

.cover-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #409eff, #67c23a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 24px;
  border-radius: 4px;
}

:deep(.el-form-item__label) {
  text-align: left;
}

// 响应式
@media (max-width: 1024px) {
  .bookshelf-page {
    flex-direction: column;
    height: auto;
    gap: 12px;
  }

  .shelf-sidebar {
    display: none;
  }

  .mobile-hidden-empty-search {
    display: none;
  }

  .book-grid.grid {
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 12px;
  }

  .book-grid.list {
    .book-card {
      align-items: flex-start;

      .book-cover {
        width: 68px;
        height: 92px;
        margin-right: 12px;
      }
    }
  }

  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-actions {
      width: 100%;
      flex-wrap: wrap;

      .search-input {
        flex: 1;
        min-width: 180px;
      }
    }
  }
}

@media (max-width: 480px) {
  .book-grid.grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-header .header-actions {
    :deep(.el-button-group),
    > .el-button {
      width: 100%;
    }
  }
}
.search-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  gap: 12px;

  .el-icon {
    font-size: 24px;
  }
}
</style>
