<template>
  <div class="female-channel">
    <div class="channel-container">
      <div v-if="loading" class="state-card">女生频道加载中...</div>
      <div v-else-if="!channel" class="state-card">女生频道暂未开放</div>
      <template v-else>
        <section class="hero-row">
          <div class="slider-panel">
            <a
              v-if="currentSlide"
              :key="currentSlide.id"
              class="slider-card"
              :href="itemHref(currentSlide)"
              @click="handleItemClick($event, currentSlide)"
            >
              <img v-if="hasCover(currentSlide)" :src="currentSlide.cover_url" :alt="currentSlide.title" />
              <div class="slider-overlay">
                <h2 v-if="text(currentSlide.title)">{{ currentSlide.title }}</h2>
                <p v-if="text(currentSlide.intro)">{{ currentSlide.intro }}</p>
              </div>
              <div class="slider-dots">
                <i
                  v-for="(_, index) in sliderItems"
                  :key="index"
                  :class="{ active: index === sliderIndex }"
                  @click.prevent="sliderIndex = index"
                ></i>
              </div>
            </a>
            <div v-if="!items('hero_slider').length" class="slider-card empty-slider">
            </div>
          </div>

          <div class="editor-panel block-card">
            <div class="block-title">
              <h1>{{ sectionTitle('editor_recommend', '编辑推荐') }}</h1>
              <button type="button" @click="loadChannel">换一换</button>
            </div>
            <a
              v-for="item in items('editor_recommend').slice(0, 4)"
              :key="item.id"
              class="editor-item"
              :href="itemHref(item)"
              @click="handleItemClick($event, item)"
            >
              <img v-if="hasCover(item)" :src="item.cover_url" :alt="item.title" />
              <div>
                <span v-if="text(item.author)" class="author">{{ item.author }}</span>
                <strong v-if="text(item.title)">{{ item.title }}</strong>
                <p v-if="text(item.intro)">{{ item.intro }}</p>
              </div>
            </a>
          </div>
        </section>

        <section class="middle-grid">
          <FeaturePanel class="left-feature" :title="sectionTitle('editor_force', '小编力荐')" :items="items('editor_force')" />
          <CategoryPanel :section="section('chief_recommend')" fallback-title="主编推荐" />
          <CategoryPanel :section="section('ancient_romance')" fallback-title="古言" />
          <CategoryPanel :section="section('modern_romance')" fallback-title="现言" />
          <CategoryPanel :section="section('fantasy_romance')" fallback-title="幻情" />
          <CategoryPanel :section="section('xianxia')" fallback-title="仙侠" />
          <CategoryPanel :section="section('youth')" fallback-title="青春" />
          <CategoryPanel :section="section('game')" fallback-title="游戏" />
          <CategoryPanel :section="section('sci_fi')" fallback-title="科幻" />
          <CategoryPanel :section="section('mystery')" fallback-title="悬疑" />
        </section>

        <section class="lower-grid">
          <FeaturePanel :title="sectionTitle('rising_new', '晋级新书')" :items="items('rising_new')" />
          <FeaturePanel :title="sectionTitle('new_debut', '新书首秀')" :items="items('new_debut')" />
        </section>

        <section class="update-grid">
          <UpdatePanel :section="section('latest_updates')" fallback-title="最新更新" />
          <UpdatePanel :section="section('latest_added')" fallback-title="最新入库" />
          <UpdatePanel :section="section('most_updated')" fallback-title="最多更新" />
        </section>
      </template>
    </div>

    <el-dialog v-model="showSearchDialog" title="搜索结果" width="700px" destroy-on-close @close="bookStore.stopSearch()">
      <div v-if="bookStore.searchResults.length > 0" class="search-results" ref="searchResultsEl" @scroll="onSearchScroll">
        <div
          v-for="(item, index) in bookStore.searchResults"
          :key="(item.bookUrl || '') + '-' + index"
          class="search-result-item"
          @click="goToDetail(item)"
        >
          <el-image
            :src="getBookCover(item.coverUrl, item.name, item.author, '搜猫阅读')"
            fit="cover"
            class="result-cover"
            @error="() => onBookCoverError(item.coverUrl, item.name)"
          />
          <div class="result-info">
            <div class="result-header">
              <div class="result-name">{{ item.name }}</div>
              <el-tag v-if="(item as any)._local" size="small" type="warning" class="result-kind">已缓存</el-tag>
              <el-tag v-else-if="(item as any)._cached" size="small" type="info" class="result-kind">缓存中</el-tag>
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
        <div v-if="bookStore.hasMoreSources && !bookStore.loading" class="continue-search-bar">
          <span>已搜索 {{ bookStore.searchProgress?.searched || bookStore.nextSearchStart }}/{{ bookStore.searchProgress?.total || 0 }} 个书源，找到 {{ bookStore.searchResults.length }} 条结果</span>
          <el-button type="primary" :icon="Search" @click="bookStore.continueSearch()">
            继续搜索下一批（剩余书源）
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
      <el-empty v-else description="未找到相关书籍" :image-size="100" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Loading, Plus, Search } from '@element-plus/icons-vue'
import { configApi, pageApi, type PageChannel, type PageChannelItem, type PageChannelSection, type SearchResult } from '@/api'
import { useAuthStore } from '@/store/auth'
import { useBookStore } from '@/store/book'
import { configsToMap } from '@/utils/siteConfig'
import { saveDetailBook } from '@/utils/bookDetail'
import { useBookCover } from '@/utils/bookCover'

const loading = ref(false)
const channel = ref<PageChannel | null>(null)
const sliderIndex = ref(0)
let sliderTimer: number | undefined
const router = useRouter()
const authStore = useAuthStore()
const bookStore = useBookStore()
const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()
const showSearchDialog = ref(false)
const guestSearchEnabled = ref(true)
const searchResultsEl = ref<HTMLElement | null>(null)

const sectionMap = computed(() => {
  const map = new Map<string, PageChannelSection>()
  channel.value?.sections?.forEach((s) => map.set(s.section_code, s))
  return map
})

function section(code: string) {
  return sectionMap.value.get(code)
}

function items(code: string) {
  return section(code)?.items || []
}

function sectionTitle(code: string, fallback: string) {
  return text(section(code)?.title) ? String(section(code)?.title) : fallback
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function hasCover(item: PageChannelItem) {
  return !!text(item.cover_url)
}

function itemHref(item: PageChannelItem) {
  return text(item.link_url) || '#'
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
  const kw = text(keyword)
  if (!kw) return
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
  if (authStore.isLoggedIn && bookStore.shelf.length === 0) {
    bookStore.loadShelf()
  }
  bookStore.search(kw)
}

function handleItemClick(event: MouseEvent, item: PageChannelItem) {
  if (text(item.link_url)) return
  event.preventDefault()
  startSearch(text(item.title))
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

function goToDetail(item: SearchResult) {
  const bookUrl = item.bookUrl || (item as any).book_url
  if (bookUrl) {
    saveDetailBook({
      bookUrl,
      name: item.name || '',
      author: item.author || '',
      coverUrl: item.coverUrl || (item as any).cover_url || '',
      intro: item.intro || '',
      sourceUrl: item.sourceUrl || (item as any).source_url || '',
      sourceName: item.sourceName || (item as any).source_name || '',
    })
    bookStore.stopSearch()
    showSearchDialog.value = false
    router.push({
      name: 'BookDetail',
      query: { bookUrl },
    })
  }
}

const sliderItems = computed(() => items('hero_slider'))
const currentSlide = computed(() => sliderItems.value[sliderIndex.value] || sliderItems.value[0])

function startSlider() {
  if (sliderTimer) window.clearInterval(sliderTimer)
  sliderTimer = window.setInterval(() => {
    const total = sliderItems.value.length
    if (total > 1) {
      sliderIndex.value = (sliderIndex.value + 1) % total
    }
  }, 4000)
}

async function loadChannel() {
  loading.value = true
  try {
    const [channelData, configsRes] = await Promise.all([
      pageApi.getChannel('female'),
      configApi.getPublicConfigs().catch(() => ({ data: [] as any[] })),
    ])
    channel.value = channelData
    const configMap = configsToMap((configsRes as any).data || [])
    guestSearchEnabled.value = configMap.guest_search_enabled !== '0'
    sliderIndex.value = 0
  } catch {
    channel.value = null
  } finally {
    loading.value = false
  }
}

const CategoryPanel = defineComponent({
  props: {
    section: Object as () => PageChannelSection | undefined,
    fallbackTitle: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'block-card category-panel' }, [
      h('div', { class: 'block-title' }, [
        h('h1', text(props.section?.title) || props.fallbackTitle),
        props.section?.more_link ? h('a', { href: props.section.more_link }, '更多') : null,
      ]),
      ...(props.section?.items || []).slice(0, 2).map((item) => h('a', { class: 'book-line', href: itemHref(item), key: item.id, onClick: (event: MouseEvent) => handleItemClick(event, item) }, [
        hasCover(item) ? h('img', { src: item.cover_url, alt: item.title }) : null,
        h('div', [
          text(item.title) ? h('h2', item.title) : null,
          text(item.intro) ? h('p', item.intro) : null,
          text(item.author) ? h('span', item.author) : null,
        ]),
      ])),
    ])
  },
})

const FeaturePanel = defineComponent({
  props: {
    title: { type: String, required: true },
    items: { type: Array as () => PageChannelItem[], required: true },
  },
  setup(props) {
    return () => h('div', { class: 'block-card feature-panel' }, [
      h('div', { class: 'block-title' }, [h('h1', props.title)]),
      ...(props.items || []).slice(0, 3).map((item, idx) => h('a', { class: idx === 0 ? 'feature-main' : 'feature-mini', href: itemHref(item), key: item.id, onClick: (event: MouseEvent) => handleItemClick(event, item) }, [
        idx === 0 && hasCover(item) ? h('img', { src: item.cover_url, alt: item.title }) : null,
        h('div', [
          text(item.title) ? h(idx === 0 ? 'h2' : 'strong', item.title) : null,
          text(item.intro) ? h('p', item.intro) : null,
          !text(item.intro) && text(item.author) ? h('p', item.author) : null,
        ]),
      ])),
    ])
  },
})

const UpdatePanel = defineComponent({
  props: {
    section: Object as () => PageChannelSection | undefined,
    fallbackTitle: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'block-card update-panel' }, [
      h('div', { class: 'block-title' }, [
        h('h1', text(props.section?.title) || props.fallbackTitle),
        props.section?.more_link ? h('a', { href: props.section.more_link }, '更多') : null,
      ]),
      ...(props.section?.items || []).slice(0, 12).map((item) => h('a', { class: 'update-line', href: itemHref(item), key: item.id, onClick: (event: MouseEvent) => handleItemClick(event, item) }, [
        text(item.category) ? h('span', `[${item.category}]`) : h('span', ''),
        text(item.title) ? h('b', item.title) : h('b', ''),
        text(item.latest_chapter) || text(item.author) ? h('em', text(item.latest_chapter) || text(item.author)) : h('em', ''),
      ])),
    ])
  },
})

onMounted(async () => {
  await loadChannel()
  startSlider()
})

onUnmounted(() => {
  bookStore.stopSearch()
  if (sliderTimer) window.clearInterval(sliderTimer)
})
</script>

<style scoped lang="scss">
.female-channel {
  min-height: 100vh;
  background: #fff;
  padding: 24px 0 42px;
  font-size: 12px;
}

.channel-container {
  width: var(--app-content-width);
  margin: 0 auto;
}

.state-card {
  padding: 60px;
  text-align: center;
  border: 1px solid #eee;
  color: #999;
}

.hero-row {
  display: grid;
  grid-template-columns: 800px 380px;
  gap: 20px;
  margin-bottom: 20px;
}

.block-card {
  border: 1px solid #eee;
  background: #fff;
}

.block-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid #eee;
  background: #fafafa;

  h1 {
    margin: 0;
    font-size: 15px;
    color: #222;
  }

  a,
  button {
    border: 0;
    background: transparent;
    color: #999;
    cursor: pointer;
    text-decoration: none;
  }
}

.editor-panel {
  min-height: 320px;
}

.editor-item {
  display: flex;
  gap: 12px;
  padding: 14px 12px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid #f4f4f4;

  img {
    width: 72px;
    height: 96px;
    object-fit: cover;
  }

  .author {
    color: #999;
    font-size: 11px;
  }

  strong {
    display: block;
    margin: 7px 0;
    font-size: 15px;
    font-weight: 500;
  }

  p {
    margin: 0;
    color: #777;
    line-height: 1.6;
    font-size: 11px;
  }
}

.slider-panel,
.slider-card {
  height: 320px;
}

.slider-card {
  position: relative;
  display: block;
  overflow: hidden;
  color: #fff;
  text-decoration: none;
  background: linear-gradient(135deg, #e85d9b, #ffc2d6);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    opacity: 0.76;
  }
}

.slider-overlay {
  position: absolute;
  left: 44px;
  top: auto;
  bottom: 38px;
  width: 55%;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.22);

  span {
    font-size: 15px;
    letter-spacing: 4px;
  }

  h2 {
    margin: 14px 0;
    font-size: 26px;
  }

  p {
    line-height: 1.8;
    font-size: 12px;
  }

  b {
    display: inline-block;
    margin-top: 10px;
    padding: 8px 18px;
    background: #fff;
    color: #d9468f;
    border-radius: 999px;
  }
}

.slider-dots {
  position: absolute;
  left: 44px;
  bottom: 28px;

  i {
    display: inline-block;
    width: 22px;
    height: 5px;
    margin-right: 7px;
    background: rgba(255,255,255,.55);
    border-radius: 99px;
  }

  .active {
    background: #fff;
  }
}

.middle-grid,
.lower-grid,
.update-grid {
  display: grid;
  grid-template-columns: 380px 390px 390px;
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

.lower-grid {
  grid-template-columns: 590px 590px;
}

.update-grid {
  grid-template-columns: 590px 285px 285px;
}

:deep(.left-feature) {
  grid-row: span 2;
}

:deep(.category-panel),
:deep(.feature-panel) {
  min-height: 220px;
}

:deep(.book-line) {
  display: flex;
  gap: 12px;
  padding: 14px 12px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #f5f5f5;

  img {
    width: 82px;
    height: 108px;
    object-fit: cover;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #333;
  }

  p {
    height: 44px;
    overflow: hidden;
    margin: 0 0 6px;
    color: #777;
    line-height: 1.6;
    font-size: 11px;
  }

  span {
    color: #999;
    font-size: 11px;
  }
}

:deep(.feature-main) {
  display: flex;
  gap: 14px;
  padding: 14px 12px;
  color: inherit;
  text-decoration: none;

  img {
    width: 92px;
    height: 124px;
    object-fit: cover;
  }

  h2 {
    margin: 0 0 10px;
    font-size: 15px;
  }

  p {
    color: #777;
    line-height: 1.7;
    font-size: 11px;
  }
}

:deep(.feature-mini) {
  display: block;
  padding: 9px 12px;
  color: inherit;
  text-decoration: none;
  border-top: 1px solid #f5f5f5;

  strong {
    font-weight: 500;
    font-size: 12px;
  }

  p {
    display: inline;
    margin-left: 8px;
    color: #999;
    font-size: 11px;
  }
}

:deep(.update-line) {
  display: grid;
  grid-template-columns: 72px 1fr 140px;
  gap: 8px;
  padding: 9px 12px;
  color: #555;
  text-decoration: none;
  border-bottom: 1px dashed #eee;

  span {
    color: #d9468f;
    font-size: 11px;
  }

  b {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 500;
    color: #333;
    font-size: 12px;
  }

  em {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #999;
    font-style: normal;
    font-size: 11px;
  }
}

.search-results {
  max-height: 520px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 14px 8px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;

  &:hover {
    background: #fafafa;
  }

  .result-cover {
    width: 72px;
    height: 96px;
    flex-shrink: 0;
    border-radius: 4px;
    overflow: hidden;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .result-name {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .result-author,
  .result-latest,
  .result-source {
    margin-top: 4px;
    font-size: 11px;
    color: #909399;
  }

  .result-intro {
    margin-top: 8px;
    color: #606266;
    font-size: 11px;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.continue-search-bar,
.search-done-bar,
.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  color: #606266;
}

.continue-search-bar {
  justify-content: space-between;
  background: #f8fbff;
  border: 1px solid #e5f0ff;
  border-radius: 8px;
  margin-top: 12px;
}

.continue-search-bar.searching,
.search-done-bar {
  justify-content: center;
}

@media (max-width: 1220px) {
  .channel-container {
    width: calc(100vw - 24px);
  }

  .hero-row,
  .middle-grid,
  .lower-grid,
  .update-grid {
    grid-template-columns: 1fr;
  }

  .slider-panel,
  .slider-card {
    aspect-ratio: 16 / 9;
    height: auto;
  }

  .slider-overlay {
    left: 14px;
    bottom: 12px;
    width: calc(100% - 28px);

    span,
    p,
    b {
      display: none;
    }

    h2 {
      margin: 0;
      padding-right: 74px;
      font-size: 15px;
      line-height: 1.35;
    }
  }

  .slider-dots {
    left: auto;
    right: 14px;
    bottom: 12px;
  }
}
</style>
