<template>
  <div class="home-page">
    <ad-slot position="home_top" class="home-ad home-ad-top" />
    <!-- 搜索区域 -->
    <div class="search-section">
      <h1 class="site-title">{{ siteTitle }}</h1>
      <p class="site-subtitle">{{ siteSubtitle }}</p>
      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="请输入关键词进行搜索"
          size="large"
          clearable
          @keyup.enter="handleSearch"
        />
        <el-button
          type="primary"
          size="large"
          :icon="Search"
          :loading="bookStore.loading"
          :disabled="bookStore.loading"
          @click="handleSearch"
        >
          搜索
        </el-button>
      </div>
      <div v-if="hotSearchTags.length > 0" class="hot-search-tags">
        <span class="hot-search-label">热门搜索：</span>
        <el-tag
          v-for="tag in hotSearchTags"
          :key="tag.name"
          class="hot-tag"
          :type="tag.type"
          effect="plain"
          @click="searchKeyword = tag.name; handleSearch()"
        >
          {{ tag.name }}
        </el-tag>
      </div>
    </div>

    <ad-slot position="home_middle" class="home-ad home-ad-middle" />

    <!-- 两栏内容区 -->
    <div class="content-section">
      <!-- 排行榜 -->
      <div class="content-column main-column">
        <div class="rank-header">
          <h3 class="column-title no-border">排行榜</h3>
          <router-link to="/ranking" class="rank-more">更多</router-link>
        </div>
        <div class="rank-list">
          <div
            v-for="(book, index) in hotRankings.slice(0, 5)"
            :key="index"
            class="rank-item"
            @click="goToDetail(book)"
          >
            <div class="rank-cover">
              <span class="rank-num" :class="{ top: index < 3 }">{{ index + 1 }}</span>
              <el-image
                :src="getBookCover(book.coverUrl, book.name, book.author, siteTitle)"
                fit="cover"
                lazy
                class="rank-cover-img"
                @error="() => onBookCoverError(book.coverUrl, book.name)"
              />
            </div>
            <div class="rank-info">
              <div class="rank-name">{{ book.name }}</div>
              <div class="rank-author">作者：{{ book.author || '未知作者' }}</div>
              <div class="rank-intro" v-if="book.intro">{{ book.intro }}</div>
            </div>
            <div class="rank-hot">
              <div class="hot-icon">
                <el-icon><ArrowDown /></el-icon>
              </div>
              <div class="hot-count">{{ book.downloadCount || 0 }}</div>
              <div class="hot-label">热搜指数</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 热门标签 -->
      <div class="content-column side-column">
        <div class="ranking-entry">
          <div class="ranking-entry-header">
            <h3 class="column-title no-border">新书榜</h3>
            <router-link to="/ranking" class="ranking-more">查看全部</router-link>
          </div>
          <div v-if="topRankings.length === 0" class="ranking-empty">
            暂无榜单数据
          </div>
          <ul v-else class="ranking-mini-list">
            <li
              v-for="(book, idx) in topRankings.slice(0, 5)"
              :key="book.id || idx"
              class="ranking-mini-item"
              @click="goRankingDetail(book)"
            >
              <span class="rank-no" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
              <span class="rank-title">{{ book.name }}</span>
              <span class="rank-author">{{ book.author || '佚名' }}</span>
            </li>
          </ul>
        </div>

        <h3 class="column-title">热门标签</h3>
        <div class="tag-cloud">
          <el-tag
            v-for="tag in hotTags"
            :key="tag"
            class="cloud-tag"
            effect="plain"
            @click="searchKeyword = tag; handleSearch()"
          >
            {{ tag }}
          </el-tag>
        </div>
      </div>
    </div>

    <ad-slot position="home_bottom" class="home-ad home-ad-bottom" />

    <!-- 搜索结果弹窗 -->
    <el-dialog v-model="showSearchDialog" title="搜索结果" width="700px" destroy-on-close @close="bookStore.stopSearch()">
      <div v-if="bookStore.searchResults.length > 0" class="search-results" ref="searchResultsEl" @scroll="onSearchScroll">
        <div v-if="bookStore.exactSearchResults.length > 0" class="search-section-title exact">
          精确匹配（{{ bookStore.exactSearchResults.length }}）
        </div>
        <div
          v-for="(item, index) in bookStore.exactSearchResults"
          :key="'exact-' + item.bookUrl + '-' + index"
          class="search-result-item"
          @click="goToDetail(item)"
        >
          <el-image
                :src="getBookCover(item.coverUrl, item.name, item.author, siteTitle)"
                fit="cover"
                lazy
                class="result-cover"
                @error="() => onBookCoverError(item.coverUrl, item.name)"
              />
          <div class="result-info">
            <div class="result-header">
              <div class="result-name">{{ item.name }}</div>
              <span class="exact-match-wrap">
                <el-tag size="small" type="success" class="result-kind">{{ item._matchLabel || '精确匹配' }}</el-tag>
              </span>
              <el-tag v-if="item._local" size="small" type="warning" class="result-kind">已缓存</el-tag>
              <el-tag v-else-if="item._cached" size="small" type="info" class="result-kind">缓存中</el-tag>
              <el-tag v-if="item.kind" size="small" type="danger" class="result-kind">{{ item.kind }}</el-tag>
            </div>
            <div class="result-author">{{ item.author || '未知作者' }}</div>
            <div v-if="item.latestChapterTitle" class="result-latest">最新：{{ item.latestChapterTitle }}</div>
            <div v-if="item.intro" class="result-intro">{{ item.intro }}</div>
            <div class="result-source">{{ item.sourceName || '未知来源' }}</div>
          </div>
          <el-tooltip
            v-if="bookStore.isInShelf(item as any)"
            content="已加入书架"
            placement="left"
          >
            <el-button
              type="success"
              size="small"
              :icon="CircleCheck"
              circle
              disabled
              class="btn-added-circle"
              @click.stop
            />
          </el-tooltip>
          <el-button
            v-else
            type="primary"
            size="small"
            :icon="Plus"
            circle
            title="加入书架"
            @click.stop="addFromSearch(item)"
          />
        </div>
        <div v-if="bookStore.relatedSearchResults.length > 0" class="search-section-title related">
          相关结果（{{ bookStore.relatedSearchResults.length }}）
        </div>
        <div
          v-for="(item, index) in bookStore.relatedSearchResults"
          :key="'related-' + item.bookUrl + '-' + index"
          class="search-result-item related-result"
          @click="goToDetail(item)"
        >
          <el-image
                :src="getBookCover(item.coverUrl, item.name, item.author, siteTitle)"
                fit="cover"
                lazy
                class="result-cover"
                @error="() => onBookCoverError(item.coverUrl, item.name)"
              />
          <div class="result-info">
            <div class="result-header">
              <div class="result-name">{{ item.name }}</div>
              <el-tag size="small" type="info" class="result-kind">{{ item._matchLabel || '相关结果' }}</el-tag>
              <el-tag v-if="item._local" size="small" type="warning" class="result-kind">已缓存</el-tag>
              <el-tag v-else-if="item._cached" size="small" type="info" class="result-kind">缓存中</el-tag>
              <el-tag v-if="item.kind" size="small" type="danger" class="result-kind">{{ item.kind }}</el-tag>
            </div>
            <div class="result-author">{{ item.author || '未知作者' }}</div>
            <div v-if="item.latestChapterTitle" class="result-latest">最新：{{ item.latestChapterTitle }}</div>
            <div v-if="item.intro" class="result-intro">{{ item.intro }}</div>
            <div class="result-source">{{ item.sourceName || '未知来源' }}</div>
          </div>
          <el-tooltip
            v-if="bookStore.isInShelf(item as any)"
            content="已加入书架"
            placement="left"
          >
            <el-button
              type="success"
              size="small"
              :icon="CircleCheck"
              circle
              disabled
              class="btn-added-circle"
              @click.stop
            />
          </el-tooltip>
          <el-button
            v-else
            type="primary"
            size="small"
            :icon="Plus"
            circle
            title="加入书架"
            @click.stop="addFromSearch(item)"
          />
        </div>
        <!-- 分批搜索：继续搜索提示 -->
        <div v-if="bookStore.hasMoreSources && !bookStore.loading" class="continue-search-bar">
          <span>已搜索 {{ bookStore.searchProgress?.searched || bookStore.nextSearchStart }}/{{ bookStore.searchProgress?.total || 0 }} 个书源，找到 {{ bookStore.searchResults.length }} 条结果</span>
          <el-button type="primary" :icon="Search" @click="bookStore.continueSearch()">
            继续搜索下一批（剩余书源）
          </el-button>
        </div>
        <div v-else-if="bookStore.loading && bookStore.searchResults.length > 0" class="continue-search-bar searching">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="search-loading-title">正在搜索《{{ searchKeyword.trim() }}》</span>
          <span class="search-loading-hint">当前搜索人数较多，正在努力搜索中...</span>
        </div>
        <!-- 全部搜索完的提示 -->
        <div v-else-if="!bookStore.hasMoreSources && bookStore.searchResults.length > 0 && !bookStore.loading" class="search-done-bar">
          <span>✓ 已搜索完全部书源，共找到 {{ bookStore.searchResults.length }} 条结果</span>
        </div>
      </div>
      <div v-else-if="bookStore.loading && bookStore.searchResults.length === 0" class="search-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span class="search-loading-title">正在搜索《{{ searchKeyword.trim() }}》</span>
        <span class="search-loading-hint">当前搜索人数较多，正在努力搜索中...</span>
        <span v-if="bookStore.searchProgress">
          正在搜索... 已搜索 {{ bookStore.searchProgress.searched }}/{{ bookStore.searchProgress.total }} 个书源，找到 {{ bookStore.searchResults.length }} 条结果
        </span>
      </div>
      <!-- 第一批无结果但还有剩余书源时，显示继续搜索 -->
      <div v-else-if="bookStore.hasMoreSources && !bookStore.loading" class="search-empty-continue">
        <el-empty description="暂未找到相关书籍" :image-size="100" />
        <div class="continue-search-bar center">
          <span>已搜索 {{ bookStore.searchProgress?.searched || bookStore.nextSearchStart }}/{{ bookStore.searchProgress?.total || 0 }} 个书源，暂未找到结果</span>
          <el-button type="primary" :icon="Search" @click="bookStore.continueSearch()">
            继续搜索下一批（剩余书源）
          </el-button>
        </div>
      </div>
      <el-empty v-else description="未找到相关书籍" :image-size="100" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBookStore } from '@/store/book'
import { useAuthStore } from '@/store/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Loading, ArrowDown, CircleCheck } from '@element-plus/icons-vue'
import { homeApi, configApi } from '@/api'
import type { SearchResult } from '@/api'
import { configsToMap } from '@/utils/siteConfig'
import { applySeo, defaultSeoTemplates } from '@/utils/seo'
import { saveDetailBook } from '@/utils/bookDetail'
import { coverForSearch, useBookCover } from '@/utils/bookCover'
import AdSlot from '@/components/AdSlot.vue'

const router = useRouter()
const route = useRoute()
const bookStore = useBookStore()
const authStore = useAuthStore()

const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()
const searchKeyword = ref('')
const showSearchDialog = ref(false)
const siteTitle = ref('搜书网')
const siteSubtitle = ref('搜书网，图片格式，由网站管理员后台上传')
const homeTitle = ref('')
const guestSearchEnabled = ref(true)
const siteConfigMap = ref<Record<string, string>>({})
const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzQwOUVGRiIvPjx0ZXh0IHg9IjYwIiB5PSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iNDAiPvCfk6E8L3RleHQ+PC9zdmc+'
const searchResultsEl = ref<HTMLElement | null>(null)

function onSearchScroll(e: Event) {
  const target = e.target as HTMLElement
  if (!target) return
  // 距离底部 50px 内视为滚到底
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
    if (bookStore.hasMoreSources && !bookStore.loading) {
      bookStore.continueSearch()
    }
  }
}

// 热门搜索标签
const hotSearchTags = ref<any[]>([])

// 热门排行榜
const hotRankings = ref<any[]>([])

// 热门标签
const hotTags = ref<string[]>([])

// 榜单 Top 5（首页右侧入口卡片用）
const topRankings = ref<any[]>([])

// 加载首页数据
async function loadHomeData() {
  try {
    const [searchesRes, rankingsRes, tagsRes, configsRes, topRankRes] = await Promise.all([
      homeApi.getHotSearches(),
      homeApi.getHotRankings({ limit: 5 }).catch(() => ({ data: [] })),
      homeApi.getHotTags(),
      configApi.getPublicConfigs().catch(() => ({ data: [] })),
      homeApi.getHotRankings({ type: 'new', limit: 5 }).catch(() => ({ data: [] })),
    ])
    const configMap = configsToMap(configsRes.data || [])
    siteConfigMap.value = configMap
    siteTitle.value = configMap.site_title || '搜书网'
    siteSubtitle.value = configMap.site_subtitle || '搜书网，图片格式，由网站管理员后台上传'
    const homeSeo = applySeo(configMap, {
      titleKey: 'home_title',
      keywordsKey: 'home_keywords',
      descriptionKey: 'home_description',
      fallbackTitle: defaultSeoTemplates.home_title,
      fallbackKeywords: defaultSeoTemplates.home_keywords,
      fallbackDescription: defaultSeoTemplates.home_description,
    })
    homeTitle.value = homeSeo.title
    guestSearchEnabled.value = configMap.guest_search_enabled !== '0'
    hotSearchTags.value = (searchesRes.data || []).map((item: any) => ({
      name: item.name,
      count: item.count,
      type: item.tag_type || 'primary',
    }))
    hotRankings.value = (rankingsRes.data || []).map((item: any) => ({
      name: item.name,
      author: item.author,
      downloadCount: item.download_count || 0,
      rating: item.rating || '0.0',
      intro: item.intro,
      coverUrl: item.cover_url,
      bookUrl: item.book_url,
    }))
    hotTags.value = (tagsRes.data || []).map((item: any) => item.name)
    topRankings.value = ((topRankRes as any).data || []).slice(0, 5)
  } catch (e) {
    console.error('加载首页数据失败', e)
  }
}

function handleSearch() {
  if (!searchKeyword.value.trim()) return
  if (bookStore.loading) {
    ElMessage.warning('正在搜索中，请稍后')
    return
  }
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
  showSearchDialog.value = true
  applySeo(siteConfigMap.value, {
    titleKey: 'search_title_template',
    keywordsKey: 'search_keywords_template',
    descriptionKey: 'search_description_template',
    fallbackTitle: defaultSeoTemplates.search_title_template,
    fallbackKeywords: defaultSeoTemplates.search_keywords_template,
    fallbackDescription: defaultSeoTemplates.search_description_template,
  }, {
    keyword: searchKeyword.value.trim(),
  })
  if (authStore.isLoggedIn && bookStore.shelf.length === 0) {
    bookStore.loadShelf()
  }
  bookStore.search(searchKeyword.value)
}

async function addFromSearch(item: SearchResult) {
  try {
    await bookStore.addBook(item.bookUrl, item.sourceUrl, {
      name: item.name,
      author: item.author,
      coverUrl: item.coverUrl,
      intro: item.intro,
      originName: item.sourceName,
    })
    ElMessage.success('已添加到书架')
    showSearchDialog.value = false
  } catch {
    ElMessage.error('添加失败')
  }
}

function goToDetail(item: any) {
  const bookUrl = item.bookUrl || item.book_url
  if (bookUrl) {
    saveDetailBook({
      bookUrl,
      name: item.name || '',
      author: item.author || '',
      coverUrl: item.coverUrl || item.cover_url || '',
      intro: item.intro || '',
      sourceUrl: item.sourceUrl || item.source_url || '',
      sourceName: item.sourceName || item.source_name || '',
    })
    bookStore.stopSearch()
    showSearchDialog.value = false
    router.push({
      name: 'BookDetail',
      query: { bookUrl },
    })
  } else {
    // 没有 bookUrl，搜索书名
    searchKeyword.value = item.name || ''
    handleSearch()
  }
}

function goRankingDetail(book: any) {
  const bookUrl = book.bookUrl || book.book_url
  if (bookUrl) {
    saveDetailBook({
      bookUrl,
      name: book.name || '',
      author: book.author || '',
      coverUrl: book.coverUrl || book.cover_url || '',
      intro: book.intro || '',
      sourceUrl: book.sourceUrl || book.source_url || '',
      sourceName: book.sourceName || book.source_name || '',
    })
    router.push({ name: 'BookDetail', query: { bookUrl } })
  } else {
    // 没有 bookUrl，弹出搜索
    searchKeyword.value = book.name || ''
    handleSearch()
  }
}

onMounted(async () => {
  await loadHomeData()
  if (authStore.isLoggedIn) {
    bookStore.loadShelf()
  }
  // 支持通过 URL ?keyword=xxx 自动触发搜索（例如从排行榜页跳过来搜索某本书）
  const kw = (route.query.keyword as string) || ''
  if (kw.trim()) {
    searchKeyword.value = kw.trim()
    await nextTick()
    handleSearch()
  }
})

onUnmounted(() => {
  bookStore.stopSearch()
})
</script>

<style scoped lang="scss">
.home-page {
  max-width: var(--app-content-width);
  margin: 0 auto;
  padding: 40px var(--app-content-padding-x);
}

// 搜索区域
.search-section {
  text-align: center;
  margin-bottom: 60px;

  .site-title {
    font-size: 48px;
    font-weight: 700;
    color: var(--el-color-primary);
    margin: 0 0 12px;
    letter-spacing: 4px;
  }

  .site-subtitle {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0 0 32px;
  }

  .search-box {
    display: flex;
    max-width: 600px;
    margin: 0 auto;
    gap: 0;

    :deep(.el-input__wrapper) {
      border-radius: 4px 0 0 4px;
      box-shadow: 0 0 0 1px var(--el-border-color) inset;
    }

    .el-button {
      border-radius: 0 4px 4px 0;
      padding: 0 32px;
    }
  }
}

// 广告位
.home-ad {
  max-width: var(--app-content-width);
  margin-left: auto;
  margin-right: auto;
}

.home-ad-top {
  margin-bottom: 16px;
}

.home-ad-middle {
  margin-top: 24px;
  margin-bottom: 24px;
}

.home-ad-bottom {
  margin-top: 32px;
}

// 两栏内容区
.content-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 40px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

.content-column {
  .column-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-color-primary);
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--el-color-primary-light-8);

    &.no-border {
      border-bottom: none;
      padding-bottom: 0;
      margin: 0;
    }
  }
}

// 热门搜索标签
.hot-search-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  max-width: 600px;
  margin: 14px auto 0;

  .hot-search-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .hot-tag {
    cursor: pointer;
    font-size: 13px;
    padding: 4px 10px;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
}

// 热门排行榜
.rank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--el-color-primary-light-8);
}

.rank-list {
  .rank-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
      margin: 0 -8px;
      padding-left: 8px;
      padding-right: 8px;
      border-radius: 6px;
    }

    &:last-child {
      border-bottom: none;
    }
  }

  .rank-cover {
    flex-shrink: 0;
    position: relative;

    .rank-num {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      min-width: 22px;
      height: 22px;
      text-align: center;
      line-height: 22px;
      border-radius: 4px 0 4px 0;

      &.top {
        background: var(--el-color-danger);
      }
    }

    .rank-cover-img {
      width: 60px;
      height: 80px;
      border-radius: 4px;
      overflow: hidden;
    }
  }

  .rank-info {
    flex: 1;
    min-width: 0;
  }

  .rank-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 6px;
  }

  .rank-author {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .rank-intro {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.5;
  }

  .rank-hot {
    flex-shrink: 0;
    text-align: center;
    min-width: 80px;
    padding: 0 8px;

    .hot-icon {
      color: var(--el-color-success);
      font-size: 20px;
      margin-bottom: 4px;
    }

    .hot-count {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 2px;
    }

    .hot-label {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }
}

// 排行榜「更多」按钮
.rank-more {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.ranking-entry {
  padding: 0 2px;
  margin-bottom: 24px;

  .ranking-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--el-color-primary-light-8);

    .column-title.no-border {
      border-bottom: none;
      padding-bottom: 0;
      margin: 0;
    }

    .ranking-more {
      font-size: 12px;
      color: var(--el-color-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .ranking-empty {
    text-align: center;
    color: var(--el-text-color-placeholder);
    font-size: 13px;
    padding: 16px 0;
  }

  .ranking-mini-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;

    .ranking-mini-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      cursor: pointer;
      border-bottom: 1px dashed var(--el-border-color-lighter);
      transition: background 0.2s;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: rgba(64, 158, 255, 0.06);
        border-radius: 4px;
      }

      .rank-no {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-dark);
        border-radius: 3px;

        &.top {
          color: #fff;
          background: var(--el-color-danger);
        }
      }

      .rank-title {
        flex: 1;
        min-width: 0;
        font-size: 13px;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rank-author {
        flex-shrink: 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .ranking-cta {
    display: block;
    text-align: center;
    font-size: 13px;
    color: var(--el-color-primary);
    text-decoration: none;
    padding: 8px 0;
    border-top: 1px solid var(--el-border-color-lighter);

    &:hover {
      background: rgba(64, 158, 255, 0.06);
      border-radius: 4px;
    }
  }
}

// 热门标签云
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .cloud-tag {
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
    transition: all 0.2s;

    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
      transform: translateY(-1px);
    }
  }
}

// 搜索结果
.search-results {
  max-height: 500px;
  overflow-y: auto;
}

.search-section-title {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px;
  margin: 4px 0 6px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: var(--el-bg-color);

  &.exact {
    color: var(--el-color-success);
    border-left: 3px solid var(--el-color-success);
  }

  &.related {
    color: var(--el-text-color-secondary);
    border-left: 3px solid var(--el-border-color);
  }
}

// 搜索结果弹窗中的继续搜索栏样式
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

  &.center {
    flex-direction: column;
    gap: 10px;
    text-align: center;
    margin-top: 16px;
  }
}

.search-empty-continue {
  padding: 20px 0;
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

// 搜索结果可滚动
:deep(.search-results) {
  max-height: 50vh;
  overflow-y: auto;
  padding: 8px 0;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.related-result {
    opacity: 0.92;
  }

  .result-cover {
    width: 70px;
    height: 95px;
    border-radius: 6px;
    flex-shrink: 0;
    margin-right: 12px;
  }

  .result-info {
    flex: 1;
    min-width: 0;

    .result-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .result-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-kind {
      flex-shrink: 0;
    }

    .exact-match-wrap {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .source-count-badge {
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      border-radius: 999px;
      background: #fff5f5;
      color: #f56c6c;
      border: 1px solid #f56c6c;
      font-size: 10px;
      line-height: 13px;
      font-weight: 700;
      text-align: center;
      box-shadow: 0 1px 2px rgba(245, 108, 108, 0.12);
    }

    .result-author {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 2px;
    }

    .result-latest {
      font-size: 11px;
      color: var(--el-color-primary);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-intro {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-source {
      font-size: 11px;
      color: var(--el-text-color-placeholder);
    }
  }
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: white;
  font-size: 32px;
  font-weight: 700;

  &.small {
    width: 70px;
    height: 95px;
    font-size: 18px;
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

@media (max-width: 768px) {
  .home-page {
    padding: 28px 8px;
  }

  .search-section {
    margin-bottom: 36px;

    .site-title {
      font-size: 34px;
      letter-spacing: 2px;
    }

    .site-subtitle {
      margin-bottom: 22px;
      line-height: 1.6;
    }

    .search-box {
      flex-direction: column;
      gap: 10px;

      :deep(.el-input__wrapper) {
        border-radius: 8px;
      }

      .el-button {
        width: 100%;
        border-radius: 8px;
      }
    }
  }

  .content-section {
    gap: 24px;
  }

  .rank-list {
    .rank-item {
      gap: 10px;
    }

    .rank-hot {
      display: none;
    }
  }

  .search-result-item {
    padding: 10px 0;

    .result-cover {
      width: 56px;
      height: 76px;
    }
  }
}

@media (max-width: 480px) {
  .search-section .site-title {
    font-size: 30px;
  }

  .rank-list .rank-cover .rank-cover-img {
    width: 48px;
    height: 66px;
  }
}
</style>
