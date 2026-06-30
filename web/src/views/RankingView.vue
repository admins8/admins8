<template>
  <div class="ranking-page">
    <div class="ranking-layout">
      <!-- 左侧榜单类型 -->
      <aside class="ranking-sidebar">
        <div class="sidebar-title">排行总榜</div>
        <ul class="rank-type-list">
          <li
            class="rank-type-item"
            :class="{ active: activeType === 'all' }"
            @click="switchToAll"
          >
            总览
          </li>
          <li
            v-for="meta in rankMeta"
            :key="meta.code"
            class="rank-type-item"
            :class="{ active: activeType === meta.code }"
            @click="switchToType(meta.code)"
          >
            {{ meta.label }}
            <span class="rank-count">{{ (rankings[meta.code] || []).length }}</span>
          </li>
        </ul>
      </aside>

      <!-- 右侧主内容 -->
      <main class="ranking-main">
        <div class="ranking-header">
          <h2>排行榜</h2>
          <el-button v-if="canRefresh" type="primary" :icon="RefreshRight" :loading="refreshing" @click="autoRefresh">
            自动刷新
          </el-button>
        </div>

        <!-- 顶部分类切换 -->
        <div class="category-bar">
          <span
            v-for="cat in categories"
            :key="cat"
            class="category-chip"
            :class="{ active: activeCategory === cat }"
            @click="onCategoryChange(cat)"
          >
            {{ cat }}
          </span>
        </div>

        <!-- 总览：三栏榜单平铺 -->
        <div v-if="activeType === 'all'" v-loading="loading" class="rank-grid">
          <div
            v-for="meta in rankMeta"
            :key="meta.code"
            :id="`rank-${meta.code}`"
            class="rank-card"
          >
            <div class="rank-card-header">
              <h3>{{ meta.label }}</h3>
              <span class="rank-more" @click="switchToType(meta.code)">更多</span>
            </div>
            <div v-if="(rankings[meta.code] || []).length === 0" class="rank-empty">
              <el-empty :image-size="60" description="暂无数据" />
            </div>
            <div v-else class="rank-list rank-list-compact">
              <div
                v-for="(book, idx) in rankings[meta.code]"
                :key="book.id"
                class="rank-item rank-item-compact"
                :class="{ 'has-book-url': book.book_url }"
                @click="onBookClick(book)"
              >
                <span class="rank-num" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
                <div class="rank-info">
                  <div class="rank-name" :title="book.name">{{ book.name }}</div>
                  <div class="rank-meta">
                    <span class="rank-author">{{ normalizeAuthorDisplay(book.author) }}</span>
                    <span class="rank-dot">·</span>
                    <span class="rank-cat">{{ book.category || '全部' }}</span>
                    <span class="rank-dot">·</span>
                    <span class="rank-status" :class="{ complete: book.is_complete === 1 }">
                      {{ book.is_complete === 1 ? '完结' : '连载' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 单榜视图：点击左侧后，只展示这一个榜单 - 使用参考图样式 -->
        <div v-else v-loading="loading" class="rank-single-wrap">
          <div class="rank-card rank-card-single">
            <div class="rank-card-header">
              <h3>{{ currentMeta?.label || '榜单' }}</h3>
              <span class="rank-more" @click="switchToAll">返回总览</span>
            </div>
            <div v-if="currentList.length === 0" class="rank-empty">
              <el-empty :image-size="80" description="暂无数据，可换一个分类试试" />
            </div>
            <div v-else class="rank-list rank-list-detailed">
              <div
                v-for="(book, idx) in currentList"
                :key="book.id"
                class="rank-item rank-item-detailed"
                :class="{ 'has-book-url': book.book_url }"
              >
                <!-- 左侧：封面 + 排名徽章 -->
                <div class="rank-cover-wrap">
                  <span class="rank-badge" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
                  <div class="rank-cover-img">
                    <el-image
                      :src="getBookCover(book.cover_url, book.name, book.author, siteTitle)"
                      fit="cover"
                      @error="() => onBookCoverError(book.cover_url, book.name)"
                    >
                      <template #error>
                        <div class="cover-fallback">
                          <span>{{ book.name?.[0] }}</span>
                        </div>
                      </template>
                    </el-image>
                  </div>
                </div>

                <!-- 中间：书名 + 作者/分类/状态 + 简介 + 最新更新 -->
                <div class="rank-info rank-info-detailed" @click="onBookClick(book)">
                  <div class="rank-title" :title="book.name">
                    <span class="rank-book-name">{{ book.name }}</span>
                  </div>
                  <div class="rank-meta-row">
                    <span class="rank-author">
                      <el-icon><User /></el-icon>
                      {{ normalizeAuthorDisplay(book.author) }}
                    </span>
                    <span class="rank-meta-dot">|</span>
                    <span class="rank-cat">
                      <el-icon><Collection /></el-icon>
                      {{ book.category || '全部' }}
                    </span>
                    <span class="rank-meta-dot">|</span>
                    <span class="rank-status" :class="{ complete: book.is_complete === 1 }">
                      <el-icon><component :is="book.is_complete === 1 ? 'CircleCheck' : 'Loading'" /></el-icon>
                      {{ book.is_complete === 1 ? '完结' : '连载' }}
                    </span>
                  </div>
                  <div v-if="book.intro" class="rank-intro">{{ book.intro }}</div>
                  <div v-if="getLatestInfo(book)" class="rank-latest">
                    <span class="rank-latest-label">最新更新</span>
                    <span class="rank-latest-text">{{ getLatestInfo(book) }}</span>
                  </div>
                </div>

                <!-- 右侧：按钮（横排等宽） -->
                <div class="rank-actions" @click.stop>
                  <el-button type="danger" class="btn-detail" @click="onBookClick(book)">书籍详情</el-button>
                  <el-button
                    v-if="isBookInShelf(book.name, book.author)"
                    class="btn-add btn-added"
                    disabled
                  >已加书架</el-button>
                  <el-button v-else class="btn-add" @click="addFromRanking(book)">加入书架</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 搜索结果弹窗 -->
    <el-dialog v-model="showSearchDialog" title="搜索结果" width="760px" destroy-on-close @close="bookStore.stopSearch()">
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
          <div class="result-info" @click="onSearchResultClick(item)">
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
            <el-button type="danger" class="btn-detail" @click="onSearchResultClick(item)">书籍详情</el-button>
            <el-button
              v-if="isBookInShelf(item.name, item.author)"
              class="btn-add btn-added"
              disabled
            >已加书架</el-button>
            <el-button v-else type="primary" class="btn-add" @click="addFromSearch(item)">加入书架</el-button>
          </div>
        </div>

      <!-- 分批搜索：继续搜索提示 -->
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
      <div v-else class="search-empty">
        <el-empty description="暂无搜索结果，可换一个关键词试试" />
      </div>
    </el-dialog>
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight, Search, Plus, Loading, User, Collection, CircleCheck, Link, Document } from '@element-plus/icons-vue'
import { homeApi, configApi, unwrapResponse, type SearchResult } from '@/api'
import type { RankingItem, RankTypeMeta } from '@/api'
import { useAuthStore } from '@/store/auth'
import { useBookStore } from '@/store/book'
import { configsToMap } from '@/utils/siteConfig'
import { applySeo, defaultSeoTemplates } from '@/utils/seo'
import { saveDetailBook } from '@/utils/bookDetail'
import { coverForSearch, useBookCover } from '@/utils/bookCover'

const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()

// 默认封面 SVG
const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzQwOUVGRiIvPjx0ZXh0IHg9IjYwIiB5PSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iNDAiPvCfk6E8L3RleHQ+PC9zdmc+'

// 搜索相关
const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()
const searchKeyword = ref('')
const showSearchDialog = ref(false)
const searchResultsEl = ref<HTMLElement | null>(null)

const rankMeta = ref<RankTypeMeta[]>([])
const categories = ref<string[]>(['全部'])
const activeCategory = ref('全部')
const activeType = ref<string>('all')
const rankings = ref<Record<string, RankingItem[]>>({})

const currentMeta = computed(() => rankMeta.value.find((m) => m.code === activeType.value))
const currentList = computed<RankingItem[]>(() =>
  currentMeta.value ? rankings.value[currentMeta.value.code] || [] : []
)
const loading = ref(false)
const refreshing = ref(false)
const siteTitle = ref('')
const siteConfigMap = ref<Record<string, string>>({})
const guestSearchEnabled = ref(true)

const canRefresh = computed(() => authStore.isAdmin || authStore.isSuperAdmin)

async function loadMetaAndConfigs() {
  try {
    const [metaRes, cfgRes]: any[] = await Promise.all([
      homeApi.getRankingMeta(),
      configApi.getPublicConfigs().catch(() => ({ data: [] })),
    ])
    const meta = unwrapResponse<{ types: RankTypeMeta[]; categories: string[] }>(metaRes)
    rankMeta.value = meta?.types || []
    categories.value = meta?.categories || ['全部']
    const cfgMap = configsToMap(cfgRes.data || [])
    siteConfigMap.value = cfgMap
    siteTitle.value = cfgMap.site_title || ''
    guestSearchEnabled.value = cfgMap.guest_search_enabled !== '0'
    applyRankingSeo()
  } catch {
    // 静默失败
  }
}

// 规范化作者字段
function normalizeAuthor(raw: string | undefined | null): string {
  if (!raw) return ''
  let s = String(raw).trim()
  if (!s) return ''
  if (s.length > 80) return ''
  if (/[\n\r\t]/.test(s)) return ''
  s = s.replace(/^作\s*者\s*[:：\-=\s]+/, '')
  s = s.replace(/^author\s*[:：\-=\s]+/i, '')
  s = s.replace(/[，。,;；\s]+$/g, '')
  return s.trim()
}

// 显示用的作者（简短）
function normalizeAuthorDisplay(raw: string | undefined | null): string {
  const result = normalizeAuthor(raw)
  return result || '佚名'
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

// 客户端去重
function dedupeItems(items: any[]): any[] {
  if (!items || items.length === 0) return items
  const seenWithAuthor = new Set<string>()
  const seenByNameOnly = new Set<string>()
  const result: any[] = []
  for (const item of items) {
    const nameNorm = normalizeBookName(item.name)
    if (!nameNorm) {
      result.push(item)
      continue
    }
    const authorNorm = normalizeAuthor(item.author)

    if (authorNorm) {
      const keyFull = `${nameNorm}|${authorNorm}`
      if (seenWithAuthor.has(keyFull)) continue
      if (seenByNameOnly.has(nameNorm)) {
        for (let i = result.length - 1; i >= 0; i--) {
          const rn = normalizeBookName(result[i].name)
          const ra = normalizeAuthor(result[i].author)
          if (rn === nameNorm && !ra) {
            result.splice(i, 1)
            break
          }
        }
      }
      seenWithAuthor.add(keyFull)
      seenByNameOnly.add(nameNorm)
      result.push(item)
      continue
    }

    if (seenByNameOnly.has(nameNorm)) continue
    let dupWithAuthor = false
    for (const existing of result) {
      if (normalizeBookName(existing.name) === nameNorm && normalizeAuthor(existing.author)) {
        dupWithAuthor = true
        break
      }
    }
    if (dupWithAuthor) continue
    seenByNameOnly.add(nameNorm)
    result.push(item)
  }
  return result
}

// 获取最新更新信息（章节/字数/时间）
function getLatestInfo(book: RankingItem): string {
  // 优先使用 extra 字段（通常是最新章节时间或信息）
  const extra = book.extra || ''
  const chapterCount = book.chapter_count || 0
  const wordCount = book.word_count || 0

  // 构造显示信息
  const parts: string[] = []
  if (chapterCount > 0) parts.push(`共 ${chapterCount} 章`)
  if (wordCount > 0) parts.push(`${wordCount} 万字`)
  if (extra && extra.length >= 10) {
    // extra 格式如 2026-06-10T12:00:00.000Z，格式化一下
    try {
      const d = new Date(extra)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        parts.push(`${y}-${m}-${day} ${hh}:${mm}`)
      }
    } catch { /* ignore */ }
  }
  return parts.join(' ')
}

async function loadRankings() {
  loading.value = true
  try {
    const res: any = await homeApi.getRankingsGrouped(activeCategory.value, 20)
    const data = unwrapResponse<any>(res)
    const rawRankings = data?.rankings || {}
    const deduped: Record<string, any[]> = {}
    for (const key of Object.keys(rawRankings)) {
      deduped[key] = dedupeItems(rawRankings[key])
    }
    rankings.value = deduped
  } catch {
    ElMessage.error('加载排行榜失败')
  } finally {
    loading.value = false
  }
}

function onCategoryChange(cat: string) {
  activeCategory.value = cat
  applyRankingSeo()
  loadRankings()
}

function switchToType(typeCode: string) {
  activeType.value = typeCode
  applyRankingSeo()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function switchToAll() {
  activeType.value = 'all'
  applyRankingSeo()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyRankingSeo() {
  applySeo(siteConfigMap.value, {
    titleKey: 'ranking_title_template',
    keywordsKey: 'ranking_keywords_template',
    descriptionKey: 'ranking_description_template',
    fallbackTitle: defaultSeoTemplates.ranking_title_template,
    fallbackKeywords: defaultSeoTemplates.ranking_keywords_template,
    fallbackDescription: defaultSeoTemplates.ranking_description_template,
  }, {
    rankName: currentMeta.value?.name || '小说排行榜',
    category: activeCategory.value || '全部',
  })
}

// 判断书籍是否已在书架中（按书名+作者规范化匹配）
function isBookInShelf(name: string | undefined | null, author: string | undefined | null): boolean {
  return bookStore.isInShelf({ name: name || '', author: author || '' } as any)
}

function onBookClick(book: RankingItem) {
  const bookUrl = book.book_url
  if (bookUrl) {
    saveDetailBook({
      bookUrl,
      name: book.name || '',
      author: book.author || '',
      coverUrl: (book as any).coverUrl || book.cover_url || '',
      intro: (book as any).intro || '',
      sourceUrl: (book as any).sourceUrl || (book as any).source_url || '',
      sourceName: (book as any).sourceName || (book as any).source_name || '',
    })
    router.push({ name: 'BookDetail', query: { bookUrl } })
  } else {
    startSearch(book.name || '')
  }
}

function addFromRanking(book: RankingItem) {
  if (!authStore.isLoggedIn) {
    ElMessageBox.confirm('请先登录后再添加书籍到书架', '提示', {
      confirmButtonText: '去登录',
      cancelButtonText: '取消',
      type: 'info',
    }).then(() => {
      router.push('/login')
    }).catch(() => {})
    return
  }
  // 用书名直接搜索添加，或如果有 bookUrl 则直接加入
  if (book.book_url) {
    const bookUrl = book.book_url
    const coverUrl = (book as any).coverUrl || book.cover_url || ''
    bookStore.addBook(bookUrl!, coverUrl, {
      name: book.name,
      author: book.author,
      intro: (book as any).intro || '',
      sourceUrl: '',
      sourceName: '',
    }).then(() => {
      ElMessage.success('已添加到书架')
    }).catch((e: any) => {
      ElMessage.error(e?.message || '添加失败')
    })
  } else {
    startSearch(book.name || '')
  }
}

function goSearchByCategory() {
  if (activeCategory.value && activeCategory.value !== '全部') {
    startSearch(activeCategory.value)
  }
}

function onSearchScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
    if (bookStore.hasMoreSources && !bookStore.loading) {
      bookStore.continueSearch()
    }
  }
}

function startSearch(keyword: string) {
  if (!keyword.trim()) return
  if (!guestSearchEnabled.value && !authStore.isLoggedIn) {
    ElMessageBox.confirm('请先登录后再搜索书籍', '提示', {
      confirmButtonText: '去登录',
      cancelButtonText: '取消',
      type: 'info',
    }).then(() => {
      router.push('/login')
    }).catch(() => {})
    return
  }
  searchKeyword.value = keyword
  showSearchDialog.value = true
  bookStore.search(keyword)
}

function onSearchResultClick(item: SearchResult) {
  if (!item.bookUrl) return
  saveDetailBook({
    bookUrl: item.bookUrl,
    name: item.name || '',
    author: item.author || '',
    coverUrl: item.coverUrl || '',
    intro: item.intro || '',
    sourceUrl: item.sourceUrl || '',
    sourceName: item.sourceName || '',
  })
  bookStore.stopSearch()
  showSearchDialog.value = false
  router.push({ name: 'BookDetail', query: { bookUrl: item.bookUrl } })
}

onUnmounted(() => {
  bookStore.stopSearch()
})

function addFromSearch(item: SearchResult) {
  try {
    bookStore.addBook(item.bookUrl!, item.coverUrl || '', {
      name: item.name,
      author: item.author,
      intro: item.intro,
      origin: item.sourceUrl,
      originName: item.sourceName,
    })
    ElMessage.success('已添加到书架')
    showSearchDialog.value = false
  } catch (e: any) {
    ElMessage.error(e?.message || '添加失败')
  }
}

async function autoRefresh() {
  refreshing.value = true
  try {
    const res: any = await homeApi.refreshRankings()
    const data = unwrapResponse<any>(res)
    ElMessage.success(`已根据 ${data?.sourceCount || 0} 本书的阅读情况刷新榜单`)
    await loadRankings()
  } catch (e: any) {
    ElMessage.error(e?.message || '刷新失败')
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await loadMetaAndConfigs()
  await loadRankings()
})
</script>

<style scoped lang="scss">
.ranking-page {
  max-width: var(--app-content-width);
  margin: 0 auto;
  padding: 24px 16px;
}

.ranking-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 20px;
}

.ranking-sidebar {
  background: var(--el-bg-color);
  border-radius: 10px;
  padding: 16px 0;
  height: fit-content;
  position: sticky;
  top: 80px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);

  .sidebar-title {
    padding: 0 20px 12px;
    font-size: 16px;
    font-weight: 700;
    color: var(--el-color-primary);
    border-bottom: 1px solid var(--el-border-color-lighter);
    margin-bottom: 8px;
  }

  .rank-type-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rank-type-item {
    padding: 10px 20px;
    cursor: pointer;
    font-size: 14px;
    color: var(--el-text-color-regular);
    transition: all 0.2s;
    border-left: 3px solid transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }

    &.active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      border-left-color: var(--el-color-primary);
      font-weight: 600;
    }

    .rank-count {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      background: var(--el-fill-color-light);
      padding: 2px 10px;
      border-radius: 10px;
      font-weight: 400;
    }

    &.active .rank-count {
      color: var(--el-color-primary);
      background: #fff;
    }
  }
}

.ranking-main {
  background: var(--el-bg-color);
  border-radius: 10px;
  padding: 20px 24px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.ranking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }
}

.category-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 4px;
  background: var(--el-fill-color-light);
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 20px;

  .category-chip {
    padding: 4px 12px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;

    &:hover {
      color: var(--el-color-primary);
    }

    &.active {
      background: var(--el-color-primary);
      color: #fff;
    }
  }
}

/* ============ 总览：三栏小卡片 ============ */
.rank-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
}

.rank-card {
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 14px 16px;
  min-height: 280px;
}

.rank-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 8px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .rank-more {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

.rank-empty {
  padding: 16px 0;
}

/* 总览 - 紧凑列表 */
.rank-list-compact {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rank-item-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  .rank-num {
    flex-shrink: 0;
    width: 24px;
    text-align: center;
    font-weight: 700;
    color: var(--el-text-color-secondary);
    font-size: 14px;

    &.top {
      color: var(--el-color-danger);
    }
  }

  .rank-info {
    flex: 1;
    min-width: 0;
  }

  .rank-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 3px;

    .rank-dot {
      color: var(--el-border-color);
    }

    .rank-author {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rank-status.complete {
      color: var(--el-color-success);
    }
  }
}

/* ============ 单榜视图：详细列表（参考图样式） ============ */
.rank-single-wrap {
  display: flex;
  justify-content: center;
}

.rank-card-single {
  width: 100%;
  min-height: 400px;
}

.rank-list-detailed {
  display: flex;
  flex-direction: column;
}

.rank-item-detailed {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--el-fill-color-light);
  }

  /* 左侧：封面 + 排名 */
  .rank-cover-wrap {
    position: relative;
    flex-shrink: 0;
    width: 90px;
    height: 120px;

    .rank-badge {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      min-width: 28px;
      height: 26px;
      background: var(--el-color-primary-light-5);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      border-top-left-radius: 6px;
      border-bottom-right-radius: 10px;
      padding: 0 6px;

      &.top {
        background: var(--el-color-danger);
        color: #fff;
        box-shadow: 0 2px 6px rgba(245, 108, 108, 0.3);
      }
    }

    .rank-cover-img {
      width: 100%;
      height: 100%;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      :deep(.el-image) {
        width: 100%;
        height: 100%;
      }
    }
  }

  /* 中间：信息区 */
  .rank-info-detailed {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .rank-title {
      .rank-book-name {
        font-size: 18px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }
    }

    .rank-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--el-text-color-secondary);

      .rank-author,
      .rank-cat,
      .rank-status {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }

      .rank-meta-dot {
        color: var(--el-border-color);
      }

      .rank-status {
        color: var(--el-color-warning);

        &.complete {
          color: var(--el-color-success);
        }
      }
    }

    .rank-intro {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-top: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rank-latest {
      margin-top: 2px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--el-text-color-secondary);

      .rank-latest-label {
        color: var(--el-color-primary);
      }

      .rank-latest-text {
        color: var(--el-text-color-regular);
      }
    }
  }

  /* 右侧按钮（横排等宽） */
  .rank-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;

    .btn-detail {
      flex: 1;
      min-width: 90px;
      background: #fff;
      color: var(--el-color-danger);
      border: 1px solid var(--el-color-danger);
      padding: 8px 14px;
      font-size: 13px;

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
      padding: 8px 14px;
      font-size: 13px;

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

/* 封面占位 */
.cover-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #409eff, #67c23a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 32px;
  border-radius: 6px;

  &.cover-fallback-small {
    font-size: 24px;
  }
}

/* ============ 搜索结果弹窗：新样式 ============ */
:deep(.search-results) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.search-result-item-new {
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

:deep(.search-loading) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: var(--el-text-color-secondary);

  .is-loading {
    font-size: 32px;
    animation: rotate 1s linear infinite;
  }
}

:deep(.search-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .ranking-page {
    width: 100vw;
    max-width: 100vw;
    margin-left: -12px;
    margin-right: -12px;
    padding: 0;
  }

  .ranking-layout {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .ranking-sidebar {
    display: none;
  }

  .ranking-main {
    border-radius: 0;
    padding: 12px;
    box-shadow: none;
    min-height: calc(100vh - 108px);
  }

  .ranking-header {
    margin-bottom: 10px;
  }

  .category-bar {
    margin-bottom: 12px;
    padding: 8px;
    border-radius: 0;
  }

  .rank-grid {
    gap: 10px;
  }

  .rank-card {
    padding: 12px;
    border-radius: 8px;
    min-height: auto;
  }

  .rank-item-detailed {
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 0;

    .rank-actions {
      flex-direction: row;
      width: 100%;
      justify-content: flex-end;
    }
  }
}
</style>
