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
              <el-image
                :src="getItemCover(currentSlide)"
                :alt="currentSlide.title"
                fit="cover"
                class="slider-img"
                @error="() => onBookCoverError(currentSlide.cover_url, currentSlide.title)"
              />
              <div class="slider-overlay">
                <h2 v-if="text(currentSlide.title)">{{ currentSlide.title }}</h2>
                <p v-if="text(currentSlide.intro)">{{ truncateIntro(currentSlide.intro) }}</p>
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
              <button v-if="canShiftEditor" type="button" @click="shiftEditor">换一换</button>
            </div>
            <a
              v-for="item in editorItems"
              :key="item.id"
              class="editor-item"
              :href="itemHref(item)"
              @click="handleItemClick($event, item)"
            >
              <el-image
                :src="getItemCover(item)"
                :alt="item.title"
                fit="cover"
                class="editor-cover"
                @error="() => onBookCoverError(item.cover_url, item.title)"
              />
              <div class="editor-info">
                <strong v-if="text(item.title)">{{ item.title }}</strong>
                <em v-if="text(item.author)">{{ item.author }}</em>
                <p v-if="text(item.intro)">{{ truncateIntro(item.intro, 46) }}</p>
              </div>
            </a>
          </div>
        </section>

        <section class="zbWrap">
          <FeaturePanel class="lf" :title="sectionTitle('chief_recommend', '主编推荐')" :items="items('chief_recommend')" />
          <CategoryPanel :section="section('fantasy_romance')" fallback-title="幻情" />
          <CategoryPanel :section="section('xianxia')" fallback-title="仙侠" />
        </section>

        <section class="xbWrap">
          <FeaturePanel class="lf" :title="sectionTitle('editor_force', '小编力荐')" :items="items('editor_force')" />
          <CategoryPanel :section="section('youth')" fallback-title="青春" />
          <CategoryPanel :section="section('game')" fallback-title="游戏" />
        </section>

        <section class="xsWrap">
          <FeaturePanel class="lf" :title="sectionTitle('rising_new', '晋级新书')" :items="items('rising_new')" />
          <CategoryPanel :section="section('ancient_romance')" fallback-title="古言" />
          <CategoryPanel :section="section('modern_romance')" fallback-title="现言" />
        </section>

        <section class="xsWrap">
          <FeaturePanel class="lf" :title="sectionTitle('new_debut', '新书首秀')" :items="items('new_debut')" />
          <CategoryPanel :section="section('sci_fi')" fallback-title="科幻" />
          <CategoryPanel :section="section('mystery')" fallback-title="悬疑" />
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
            lazy
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
import { ElMessage, ElMessageBox, ElImage } from 'element-plus'
import { CircleCheck, Loading, Plus, Search } from '@element-plus/icons-vue'
import { configApi, pageApi, type PageChannel, type PageChannelItem, type PageChannelSection, type SearchResult } from '@/api'
import { useAuthStore } from '@/store/auth'
import { useBookStore } from '@/store/book'
import { configsToMap } from '@/utils/siteConfig'
import { saveDetailBook } from '@/utils/bookDetail'
import { useBookCover, resolveBookCover } from '@/utils/bookCover'

const loading = ref(false)
const channel = ref<PageChannel | null>(null)
const sliderIndex = ref(0)
const editorIndex = ref(0)
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

function truncateIntro(value: unknown, maxLen: number = 50) {
  const s = text(value)
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + '…'
}

const editorItems = computed(() => {
  const all = items('editor_recommend')
  const start = editorIndex.value * 2
  return all.slice(start, start + 2)
})

const canShiftEditor = computed(() => items('editor_recommend').length > 2)

function shiftEditor() {
  const all = items('editor_recommend')
  const maxIndex = Math.max(1, Math.ceil(all.length / 3))
  editorIndex.value = (editorIndex.value + 1) % maxIndex
}

function hasCover(item: PageChannelItem) {
  return !!text(item.cover_url)
}

function getItemCover(item: PageChannelItem): string {
  const title = text(item.title)
  const author = text(item.author)
  const cover = text(item.cover_url)
  return getBookCover(cover || undefined, title, author, '搜猫阅读')
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

function isPlaceholderItem(item: PageChannelItem) {
  const t = text(item.title)
  const a = text(item.author)
  const i = text(item.intro)
  return t.includes('推荐书籍') || t.includes('示例书籍') || a === '示例作者' || i.includes('后台可编辑')
}

const CategoryPanel = defineComponent({
  props: {
    section: Object as () => PageChannelSection | undefined,
    fallbackTitle: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const items = (props.section?.items || []).filter(item => !isPlaceholderItem(item)).slice(0, 5)
      const nodes: any[] = [
        h('div', { class: 'block-title' }, [
          h('h1', text(props.section?.title) || props.fallbackTitle),
          props.section?.more_link ? h('a', { href: props.section.more_link }, '更多') : null,
        ]),
      ]
      // 数据不足2条时留空，不渲染内容
      if (items.length >= 2) {
        // 第1-2本：小封面+文字
        for (let i = 0; i < Math.min(items.length, 2); i++) {
          const item = items[i]
          nodes.push(h('a', { class: 'book-line', href: itemHref(item), key: item.id, onClick: (event: MouseEvent) => handleItemClick(event, item) }, [
            h(ElImage, {
              src: getBookCover(item.cover_url, item.title, item.author, '搜猫阅读'),
              alt: item.title,
              fit: 'cover',
              class: 'book-line-cover',
              onError: () => onBookCoverError(item.cover_url, item.title),
            }),
            h('div', [
              text(item.title) ? h('h2', item.title) : null,
              text(item.author) ? h('span', item.author) : null,
              text(item.intro) ? h('p', truncateIntro(item.intro, 40)) : null,
            ]),
          ]))
        }
        // 后3本：文字链接
        if (items.length > 2) {
          nodes.push(h('div', { class: 'link-list' },
            items.slice(2, 5).map((item) => h('a', { class: 'link-sm', href: itemHref(item), key: item.id, onClick: (event: MouseEvent) => handleItemClick(event, item) }, [
              text(item.title) ? h('strong', item.title) : null,
              text(item.author) ? h('em', item.author) : null,
            ]))
          ))
        }
      }
      return h('div', { class: 'block-card category-panel' }, nodes)
    }
  },
})

const FeaturePanel = defineComponent({
  props: {
    title: { type: String, required: true },
    items: { type: Array as () => PageChannelItem[], required: true },
  },
  setup(props) {
    const idx = ref(0)
    let timer: number | undefined
    const items = computed(() => props.items || [])
    const total = computed(() => items.value.length)

    function startTimer() {
      if (timer) clearInterval(timer)
      timer = window.setInterval(() => {
        if (total.value > 1) {
          idx.value = (idx.value + 1) % total.value
        }
      }, 5000)
    }

    onMounted(startTimer)
    onUnmounted(() => { if (timer) clearInterval(timer) })

    function getItemStyle(i: number) {
      const current = idx.value
      let diff = i - current
      // Normalize diff to shortest path
      if (diff > total.value / 2) diff -= total.value
      if (diff < -total.value / 2) diff += total.value

      // Only show center + 2 side items
      if (Math.abs(diff) > 1) {
        return {
          transform: 'scale(0.5)',
          opacity: 0,
          zIndex: 0,
        }
      }

      const isCenter = diff === 0
      const scale = isCenter ? 1 : 0.625
      const opacity = isCenter ? 1 : 0.6
      const translateX = isCenter ? 0 : (diff > 0 ? 55 : -55)
      const translateY = isCenter ? 0 : 15
      const zIndex = isCenter ? 100 : 50

      return {
        transform: `translateX(${translateX}px) translateY(${translateY}px) scale(${scale})`,
        opacity,
        zIndex,
      }
    }

    return () => h('div', { class: 'block-card feature-panel' }, [
      h('div', { class: 'block-title' }, [
        h('h1', props.title),
        items.value.length > 1 ? h('div', { class: 'feature-dots' },
          items.value.map((_, i) =>
            h('i', { class: i === idx.value ? 'active' : '', onClick: () => { idx.value = i; startTimer() } })
          )
        ) : null,
      ]),
      h('div', { class: 'roundabout-wrapper' }, [
        h('div', { class: 'roundabout-stage' },
          items.value.map((item, i) =>
            h('a', {
              class: 'roundabout-item',
              href: itemHref(item),
              key: item.id,
              style: getItemStyle(i),
              onClick: (event: MouseEvent) => handleItemClick(event, item)
            }, [
              h(ElImage, {
                src: getBookCover(item.cover_url, item.title, item.author, '搜猫阅读'),
                alt: item.title,
                fit: 'cover',
                class: 'roundabout-cover',
                onError: () => onBookCoverError(item.cover_url, item.title),
              }),
            ])
          )
        ),
      ]),
      items.value[idx.value] ? h('div', { class: 'roundabout-info' }, [
        h('a', { href: itemHref(items.value[idx.value]), class: 'bkName', onClick: (event: MouseEvent) => handleItemClick(event, items.value[idx.value]) },
          text(items.value[idx.value].title)
        ),
        text(items.value[idx.value].author) ? h('p', { class: 'author' }, text(items.value[idx.value].author) + '/著') : null,
        text(items.value[idx.value].intro) ? h('p', { class: 'itdt' }, truncateIntro(items.value[idx.value].intro, 60)) : null,
        h('a', { href: itemHref(items.value[idx.value]), class: 'rdNow', onClick: (event: MouseEvent) => handleItemClick(event, items.value[idx.value]) }, '立即阅读'),
      ]) : null,
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
  width: 100%;
  max-width: var(--app-content-width);
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
  grid-template-columns: 800px 1fr;
  grid-template-rows: 320px;
  gap: 20px;
  margin-bottom: 20px;
  align-items: stretch;
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

.feature-dots {
  display: flex;
  gap: 4px;
  align-items: center;

  i {
    display: inline-block;
    width: 16px;
    height: 4px;
    background: #ddd;
    border-radius: 99px;
    cursor: pointer;
    transition: background 0.3s;
  }

  .active {
    background: #d9468f;
  }
}

.editor-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 320px;
}

.editor-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid #f4f4f4;
  gap: 10px;
  flex: 1;
  min-height: 0;

  .editor-cover,
  .editor-cover :deep(.el-image__inner) {
    width: 70px;
    height: 93px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .editor-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    em {
      display: block;
      color: #999;
      font-size: 11px;
      font-style: normal;
      margin-bottom: 4px;
    }

    strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 600;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: #222;
    }

    p {
      margin: 0;
      color: #666;
      line-height: 1.4;
      font-size: 11px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.notice-panel {
  height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .notice-item {
    display: block;
    padding: 8px 12px;
    color: #555;
    text-decoration: none;
    border-bottom: 1px dashed #eee;
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    i {
      display: inline-block;
      width: 4px;
      height: 4px;
      background: #d9468f;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }
  }

  .notice-empty {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 12px;
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

  .slider-img,
  .slider-img :deep(.el-image__inner) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    opacity: 1;
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

.zbWrap,
.xbWrap,
.xsWrap {
  display: grid;
  grid-template-columns: 281px repeat(2, 1fr);
  grid-template-rows: 400px;
  gap: 20px;
  margin-bottom: 20px;
  align-items: stretch;
}

.update-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 20px;
}

:deep(.category-panel) {
  height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .book-line {
    flex: none;
    min-height: 0;
  }

  .book-line:last-of-type {
    border-bottom: none;
  }
}

:deep(.feature-panel) {
  height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.book-line) {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #f5f5f5;
  min-height: 0;
  overflow: hidden;

  .book-line-cover {
    display: block;
    flex: none;
    width: 80px;
    height: 107px;
    overflow: hidden;
    border-radius: 4px;
  }

  .book-line-cover :deep(.el-image__inner) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    display: block;
    border-radius: 4px;
  }

  h2 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  p {
    margin: 0 0 6px;
    color: #666;
    line-height: 1.6;
    font-size: 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  span {
    color: #999;
    font-size: 12px;
  }

  > div {
    flex: 3;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

:deep(.link-list) {
  padding: 6px 10px;

  .link-sm {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 5px 0;
    color: inherit;
    text-decoration: none;
    border-bottom: 1px dashed #eee;
    font-size: 12px;
    overflow: hidden;

    em {
      color: #999;
      font-size: 11px;
      font-style: normal;
      flex-shrink: 0;
    }

    strong {
      font-weight: 500;
      color: #333;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
  }
}

:deep(.book-card) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #f5f5f5;
  overflow: hidden;

  .book-card-cover,
  .book-card-cover :deep(.el-image__inner) {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
    display: block;
  }

  .book-card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    h2 {
      margin: 0 0 2px;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    em {
      display: block;
      color: #999;
      font-size: 11px;
      font-style: normal;
      margin-bottom: 2px;
    }

    p {
      margin: 0;
      color: #666;
      line-height: 1.4;
      font-size: 11px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

:deep(.roundabout-wrapper) {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 8px 0;
}

:deep(.roundabout-stage) {
  position: relative;
  width: 90px;
  height: 120px;
}

:deep(.roundabout-item) {
  position: absolute;
  width: 90px;
  height: 120px;
  left: 0;
  top: 0;
  transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  text-decoration: none;
  color: inherit;

  .roundabout-cover,
  .roundabout-cover :deep(.el-image__inner) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    display: block;
  }
}

:deep(.roundabout-info) {
  text-align: center;
  padding: 6px 12px;

  .bkName {
    font-size: 14px;
    color: #333;
    font-weight: 600;
    display: block;
    margin-bottom: 2px;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      color: #d9468f;
    }
  }

  .author {
    font-size: 11px;
    color: #999;
    margin: 2px 0;
  }

  .itdt {
    font-size: 11px;
    color: #666;
    line-height: 1.4;
    margin: 2px 0;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rdNow {
    display: inline-block;
    margin-top: 4px;
    padding: 4px 16px;
    background: #d9468f;
    color: #fff;
    border-radius: 999px;
    text-decoration: none;
    font-size: 11px;
    transition: background 0.3s;

    &:hover {
      background: #c23a7e;
    }
  }
}

:deep(.feature-main) {
  display: flex;
  gap: 8px;
  padding: 6px 10px;
  color: inherit;
  text-decoration: none;
  overflow: hidden;

  .feature-main-cover,
  .feature-main-cover :deep(.el-image__inner),
  img {
    width: 30px;
    height: 40px;
    object-fit: cover;
    flex-shrink: 0;
  }

  h2 {
    margin: 0 0 2px;
    font-size: 13px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .author {
    display: block;
    margin-bottom: 2px;
    color: #999;
    font-size: 11px;
  }

  p {
    margin: 0;
    color: #777;
    line-height: 1.4;
    font-size: 11px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  > div {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
}

:deep(.feature-mini) {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 12px;
  color: inherit;
  text-decoration: none;
  border-top: 1px solid #f5f5f5;
  overflow: hidden;

  strong {
    font-weight: 500;
    font-size: 12px;
    flex-shrink: 0;
    max-width: 80px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .author {
    color: #999;
    font-size: 11px;
    flex-shrink: 0;
  }

  p {
    margin: 0;
    color: #999;
    font-size: 11px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

:deep(.update-line) {
  display: grid;
  grid-template-columns: 68px 1fr auto;
  gap: 6px;
  padding: 8px 12px;
  color: #555;
  text-decoration: none;
  border-bottom: 1px dashed #eee;
  align-items: baseline;

  span {
    color: #d9468f;
    font-size: 11px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  b {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 500;
    color: #333;
    font-size: 12px;
    min-width: 0;
  }

  em {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #999;
    font-style: normal;
    font-size: 11px;
    max-width: 90px;
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

/* ===== 平板适配 (<=1024px) ===== */
@media (max-width: 1024px) {
  .female-channel {
    padding: 12px 0 24px;
  }

  .channel-container {
    width: 100% !important;
    min-width: 0 !important;
    padding: 0 8px;
    box-sizing: border-box;
  }

  .hero-row {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 12px;
  }

  .slider-panel,
  .slider-card {
    height: 240px;
  }

  .slider-overlay {
    left: 24px;
    bottom: 24px;
    width: 60%;

    h2 {
      font-size: 22px;
      margin: 10px 0;
    }

    p {
      font-size: 12px;
    }
  }

  .slider-dots {
    left: 24px;
    bottom: 16px;
  }

  .editor-panel {
    height: auto;
  }

  .editor-item {
    padding: 8px;
    gap: 8px;

    .editor-cover,
    .editor-cover :deep(.el-image__inner) {
      width: 60px;
      height: 80px;
    }

    .editor-info strong {
      font-size: 13px;
    }

    .editor-info p {
      -webkit-line-clamp: 2;
    }
  }

  .zbWrap,
  .xbWrap,
  .xsWrap {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 12px;
  }

  .update-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  :deep(.roundabout-wrapper) {
    height: 170px;
  }

  :deep(.roundabout-stage) {
    width: 100px;
    height: 133px;
  }

  :deep(.roundabout-item) {
    width: 100px;
    height: 133px;
  }

  :deep(.book-card) {
    .book-card-cover,
    .book-card-cover :deep(.el-image__inner) {
      width: 100%;
      height: 120px;
    }
  }

  :deep(.update-line) {
    grid-template-columns: 60px 1fr auto;

    em {
      max-width: 70px;
    }
  }
}

/* ===== 手机适配 (<=768px) ===== */
@media (max-width: 768px) {
  .channel-container {
    width: 100% !important;
    min-width: 0 !important;
    padding: 0 6px;
    box-sizing: border-box;
  }

  .state-card {
    padding: 30px 16px;
    font-size: 14px;
  }

  .hero-row {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 10px;
    margin-bottom: 12px;
  }

  .slider-panel,
  .slider-card {
    height: 180px;
  }

  .slider-overlay {
    left: 12px;
    bottom: 12px;
    width: 80%;
    padding-right: 12px;

    span {
      font-size: 12px;
      letter-spacing: 2px;
    }

    h2 {
      font-size: 17px;
      margin: 6px 0;
    }

    p {
      font-size: 11px;
      -webkit-line-clamp: 2;
    }

    b {
      display: none;
    }
  }

  .slider-dots {
    left: 12px;
    bottom: 6px;

    i {
      width: 16px;
      height: 4px;
      margin-right: 5px;
    }
  }

  .block-title {
    height: 36px;
    padding: 0 10px;

    h1 {
      font-size: 14px;
    }
  }

  .editor-panel {
    height: auto;
  }

  .editor-item {
    padding: 8px;
    gap: 8px;

    .editor-cover,
    .editor-cover :deep(.el-image__inner) {
      width: 55px;
      height: 73px;
    }

    .editor-info strong {
      font-size: 13px;
      margin-bottom: 2px;
    }

    .editor-info em {
      font-size: 10px;
      margin-bottom: 2px;
    }

    .editor-info p {
      font-size: 11px;
      -webkit-line-clamp: 2;
      margin: 0;
    }
  }

  .zbWrap,
  .xbWrap,
  .xsWrap {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 10px;
    margin-bottom: 12px;
  }

  .update-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  :deep(.category-panel),
  :deep(.feature-panel) {
    min-height: 160px;
  }

  :deep(.roundabout-wrapper) {
    height: 150px;
    margin: 6px 0;
  }

  :deep(.roundabout-stage) {
    width: 90px;
    height: 120px;
  }

  :deep(.roundabout-item) {
    width: 90px;
    height: 120px;
  }

  :deep(.roundabout-info) {
    padding: 6px 10px;

    .bkName {
      font-size: 14px;
    }

    .author {
      font-size: 11px;
    }

    .itdt {
      font-size: 11px;
      -webkit-line-clamp: 2;
    }
  }

  :deep(.book-card) {
    padding: 8px;
    gap: 8px;

    .book-card-cover,
    .book-card-cover :deep(.el-image__inner) {
      width: 100%;
      height: 100px;
    }

    .book-card-info h2 {
      font-size: 13px;
      margin-bottom: 4px;
    }

    .book-card-info em {
      font-size: 10px;
    }

    .book-card-info p {
      font-size: 11px;
      -webkit-line-clamp: 2;
    }
  }

  :deep(.update-line) {
    grid-template-columns: auto 1fr auto;
    gap: 4px;
    padding: 6px 10px;
    font-size: 11px;

    span {
      font-size: 10px;
    }

    b {
      font-size: 12px;
    }

    em {
      max-width: 60px;
      font-size: 10px;
    }
  }
}

/* ===== 极小屏适配 (<=480px) ===== */
@media (max-width: 480px) {
  .female-channel {
    padding: 8px 0 16px;
  }

  .channel-container {
    padding: 0 4px;
  }

  .hero-row {
    grid-template-rows: auto;
    gap: 8px;
    margin-bottom: 10px;
  }

  .slider-panel,
  .slider-card {
    height: 160px;
  }

  .slider-overlay {
    left: 10px;
    bottom: 10px;
    width: 85%;

    h2 {
      font-size: 15px;
      margin: 4px 0;
    }

    p {
      font-size: 10px;
      -webkit-line-clamp: 2;
    }
  }

  .slider-dots {
    left: 10px;
    bottom: 4px;
  }

  .block-title {
    height: 32px;

    h1 {
      font-size: 13px;
    }
  }

  .editor-item {
    padding: 6px;
    gap: 6px;

    .editor-cover,
    .editor-cover :deep(.el-image__inner) {
      width: 50px;
      height: 67px;
    }
  }

  .zbWrap,
  .xbWrap,
  .xsWrap {
    grid-template-rows: auto;
    gap: 8px;
    margin-bottom: 10px;
  }

  :deep(.roundabout-wrapper) {
    height: 130px;
  }

  :deep(.roundabout-stage) {
    width: 80px;
    height: 107px;
  }

  :deep(.roundabout-item) {
    width: 80px;
    height: 107px;
  }

  :deep(.book-card) {
    padding: 6px;
    gap: 6px;

    .book-card-cover,
    .book-card-cover :deep(.el-image__inner) {
      width: 100%;
      height: 90px;
    }
  }
}
</style>
