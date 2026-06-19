<template>
  <div class="reader-page">
    <!-- 顶部栏 -->
    <div class="reader-header" :class="{ 'header-hidden': !showHeader }">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <span class="book-title">{{ bookStore.currentBook?.name || '阅读' }}</span>
      </div>
      <div class="header-right">
        <span class="chapter-title">{{ bookStore.currentChapter?.title || '' }}</span>
        <el-button :icon="Search" circle title="正文搜索" @click.stop="openSearch" />
        <el-button :icon="Switch" circle title="换源" @click.stop="openSwitchSource" />
        <el-button :icon="Setting" circle title="阅读设置" @click.stop="showSettings = true" />
        <el-button :icon="List" circle @click="showCatalog = true" />
      </div>
    </div>

    <!-- 阅读内容区 -->
    <div
      ref="readerContentRef"
      class="reader-content"
      :class="[
        `reading-mode-${readerSettings.readingMode}`,
        `page-animation-${readerSettings.pageAnimation}`,
        { 'is-page-animating': isPageAnimating },
      ]"
      :style="readerContentStyle"
      @click="handleReaderClick"
      @scroll.passive="handleReaderScroll"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <ad-slot position="reader_top" class="reader-ad reader-ad-top" />
      <div v-if="bookStore.loading" class="content-loading">
        <el-icon :size="32" class="loading-icon"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="hasReadableContent" class="content-text">
        <h2
          v-if="readerSettings.titleMode !== 'hide'"
          class="content-title"
          :class="{ 'title-center': readerSettings.titleMode === 'center' }"
        >
          {{ bookStore.currentChapter?.title || '' }}
        </h2>
        <ad-slot position="reader_middle" class="reader-ad reader-ad-middle" />
        <div
          class="content-body"
          :style="contentBodyStyle"
          v-html="formattedContent"
        />
        <ad-slot position="reader_bottom" class="reader-ad reader-ad-bottom" />
      </div>
      <el-empty v-else-if="requiresLoginToContinue" description="登录后继续阅读">
        <template #description>
          <div class="login-required">
            <div>未登录用户最多可阅读前 {{ guestReadChapterLimitText }} 章。</div>
            <div>登录后可以继续阅读后续章节。</div>
          </div>
        </template>
        <el-button type="primary" @click.stop="goLogin">去登录</el-button>
      </el-empty>
      <el-empty v-else description="无法加载内容">
        <el-button v-if="authStore.isLoggedIn" type="primary" @click.stop="openSwitchSource">换源试试</el-button>
      </el-empty>
    </div>

    <!-- 底部控制栏 -->
    <div class="reader-footer" :class="{ 'footer-hidden': !showHeader }">
      <el-button :icon="DArrowLeft" @click="prevChapter" :disabled="!hasPrev">
        上一章
      </el-button>
      <div class="footer-center">
        <el-button-group>
          <el-button :icon="ZoomOut" size="small" @click="decreaseFont" />
          <el-button disabled size="small">{{ readerSettings.fontSize }}px</el-button>
          <el-button :icon="ZoomIn" size="small" @click="increaseFont" />
        </el-button-group>
        <el-button-group>
          <el-button size="small" :icon="FullScreen" @click="toggleNativeFullscreen">
            {{ isNativeFullscreen ? '退出全屏' : '全屏阅读' }}
          </el-button>
        </el-button-group>
        <el-button-group class="listen-controls">
          <el-button size="small" :disabled="!speechSupported || !hasReadableContent" @click="toggleSpeech">
            {{ speechButtonText }}
          </el-button>
          <el-button size="small" :disabled="!speechSupported || (!isSpeaking && !isPaused)" @click="stopSpeech">
            停止
          </el-button>
        </el-button-group>
      </div>
      <el-button @click="nextChapter" :disabled="!hasNext">
        下一章<el-icon><DArrowRight /></el-icon>
      </el-button>
    </div>

    <!-- 目录侧边栏 -->
    <el-drawer
      v-model="showCatalog"
      title="目录"
      direction="ltr"
      size="320px"
    >
      <div class="catalog-list">
        <div
          v-for="chapter in bookStore.chapters"
          :key="chapter.url"
          :class="['catalog-item', { active: isCurrentChapter(chapter) }]"
          @click="jumpToChapter(chapter)"
        >
          <span class="chapter-index">{{ chapter.index + 1 }}</span>
          <span class="chapter-name">{{ chapter.title }}</span>
        </div>
      </div>
    </el-drawer>

    <!-- 换源抽屉 -->
    <el-drawer
      v-model="showSourceDrawer"
      title="换源"
      direction="rtl"
      size="380px"
      @closed="stopSwitchSourceSearch"
    >
      <div class="source-switch-panel">
        <el-alert
          title="选择其它书源后，会保留当前阅读章节序号并重新加载目录。"
          type="info"
          show-icon
          :closable="false"
        />
        <div v-if="sourceLoading && alternateSources.length === 0" class="source-loading">
          <el-icon class="loading-icon"><Loading /></el-icon>
          <span>正在搜索其它书源...</span>
        </div>
        <el-empty v-else-if="!sourceLoading && alternateSources.length === 0" description="暂无可用其它书源" />
        <div v-else class="alternate-source-list" @scroll.passive="handleSourceListScroll">
          <div
            v-for="source in visibleAlternateSources"
            :key="`${source.sourceUrl || ''}-${source.bookUrl}`"
            class="alternate-source-item"
            :class="{ 'is-current-source': source.isCurrentSource }"
            @click="switchToSource(source)"
          >
            <div class="source-main">
              <div class="source-title">{{ source.name }}</div>
              <div class="source-tags">
                <el-tag v-if="source.isCurrentSource" size="small" type="primary">当前阅读</el-tag>
                <el-tag v-if="(source as any)._local" size="small" type="warning">已缓存</el-tag>
                <el-tag v-else-if="(source as any)._cached" size="small" type="info">缓存中</el-tag>
                <el-tag size="small" :type="source.isCurrentSource ? 'info' : 'success'">{{ source.sourceName || '未知书源' }}</el-tag>
              </div>
            </div>
            <div class="source-meta">
              <span>{{ source.author || '未知作者' }}</span>
            </div>
            <div v-if="source.intro" class="source-intro">{{ source.intro }}</div>
          </div>
          <div class="source-list-footer">
            <span v-if="visibleAlternateSources.length < alternateSources.length">
              向下滚动加载更多，已显示 {{ visibleAlternateSources.length }} / {{ alternateSources.length }}
            </span>
            <span v-else-if="sourceLoading">
              <el-icon class="loading-icon"><Loading /></el-icon>
              正在继续搜索，已找到 {{ alternateSources.length }} 个
            </span>
            <span v-else>已显示全部 {{ alternateSources.length }} 个候选源</span>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 阅读设置抽屉 -->
    <el-drawer
      v-model="showSettings"
      title="阅读设置"
      direction="rtl"
      size="360px"
    >
      <div class="reader-settings-panel">
        <section class="setting-section">
          <div class="setting-title">字体大小</div>
          <el-slider
            v-model="readerSettings.fontSize"
            :min="14"
            :max="32"
            :step="1"
            show-input
            @change="syncFontSize"
          />
        </section>

        <section class="setting-section">
          <div class="setting-title">行高</div>
          <el-radio-group v-model="readerSettings.lineHeight">
            <el-radio-button :label="1.6">紧凑</el-radio-button>
            <el-radio-button :label="1.8">舒适</el-radio-button>
            <el-radio-button :label="2.1">宽松</el-radio-button>
          </el-radio-group>
        </section>

        <section class="setting-section">
          <div class="setting-title">阅读背景</div>
          <el-radio-group v-model="readerSettings.theme" class="theme-options">
            <el-radio-button label="paper">米黄</el-radio-button>
            <el-radio-button label="white">白色</el-radio-button>
            <el-radio-button label="green">护眼</el-radio-button>
            <el-radio-button label="gray">灰色</el-radio-button>
            <el-radio-button label="dark">深色</el-radio-button>
          </el-radio-group>
        </section>

        <section class="setting-section">
          <div class="setting-title">内容宽度</div>
          <el-radio-group v-model="readerSettings.contentWidth">
            <el-radio-button label="narrow">窄</el-radio-button>
            <el-radio-button label="standard">标准</el-radio-button>
            <el-radio-button label="wide">宽</el-radio-button>
          </el-radio-group>
        </section>

        <section class="setting-section">
          <div class="setting-title">翻页方式</div>
          <div class="setting-title sub-title">阅读模式</div>
          <el-radio-group v-model="readerSettings.readingMode">
            <el-radio-button label="scroll">滚动</el-radio-button>
            <el-radio-button label="pagination">分页</el-radio-button>
          </el-radio-group>
          <div class="setting-title sub-title">翻页动画</div>
          <el-radio-group v-model="readerSettings.pageAnimation">
            <el-radio-button label="none">无</el-radio-button>
            <el-radio-button label="slide">左右滑动</el-radio-button>
            <el-radio-button label="simulation">仿真翻页</el-radio-button>
          </el-radio-group>
          <div class="setting-row header-footer-switch">
            <span>滚动到底自动下一章</span>
            <el-switch v-model="readerSettings.autoNextChapterOnScroll" />
          </div>
          <div class="setting-row">
            <span>自动翻页</span>
            <el-switch v-model="readerSettings.autoPageEnabled" />
          </div>
          <div class="setting-title sub-title">自动翻页间隔 {{ readerSettings.autoPageInterval }} 秒</div>
          <el-slider v-model="readerSettings.autoPageInterval" :min="3" :max="30" :step="1" />
          <div class="setting-row">
            <span>点击左右区域翻章</span>
            <el-switch v-model="readerSettings.tapTurnPage" />
          </div>
          <div class="setting-row">
            <span>音量键翻章</span>
            <el-switch v-model="readerSettings.volumeTurnPage" />
          </div>
          <div class="setting-row">
            <span>保持屏幕常亮</span>
            <el-switch v-model="readerSettings.keepScreenOn" />
          </div>
          <div class="setting-tip">部分手机/平板浏览器不会把音量键开放给网页，如果系统不支持则不会触发。</div>
        </section>

        <section class="setting-section">
          <div class="setting-title">阅读排版</div>
          <div class="setting-title sub-title">字距 {{ readerSettings.letterSpacing.toFixed(2) }}em</div>
          <el-slider v-model="readerSettings.letterSpacing" :min="0" :max="0.2" :step="0.01" />
          <div class="setting-title sub-title">段距 {{ readerSettings.paragraphSpacing.toFixed(1) }}em</div>
          <el-slider v-model="readerSettings.paragraphSpacing" :min="0.2" :max="2" :step="0.1" />
          <div class="setting-title sub-title">首行缩进 {{ readerSettings.textIndent.toFixed(1) }}em</div>
          <el-slider v-model="readerSettings.textIndent" :min="0" :max="3" :step="0.5" />
          <div class="setting-title sub-title">页边距 {{ readerSettings.pagePadding }}px</div>
          <el-slider v-model="readerSettings.pagePadding" :min="12" :max="56" :step="2" />
          <div class="setting-title sub-title">标题显示</div>
          <el-radio-group v-model="readerSettings.titleMode">
            <el-radio-button label="show">显示</el-radio-button>
            <el-radio-button label="center">居中</el-radio-button>
            <el-radio-button label="hide">隐藏</el-radio-button>
          </el-radio-group>
          <div class="setting-row header-footer-switch">
            <span>页眉页脚</span>
            <el-switch v-model="readerSettings.showHeaderFooter" @change="handleHeaderFooterToggle" />
          </div>
        </section>

        <section class="setting-section">
          <div class="setting-title">九宫格点击动作</div>
          <div class="tap-zone-grid">
            <div v-for="zone in TAP_ZONE_KEYS" :key="zone" class="tap-zone-config">
              <span>{{ TAP_ZONE_LABELS[zone] }}</span>
              <el-select v-model="readerSettings.tapZoneActions[zone]" size="small">
                <el-option
                  v-for="action in TAP_ZONE_ACTION_OPTIONS"
                  :key="action.value"
                  :label="action.label"
                  :value="action.value"
                />
              </el-select>
            </div>
          </div>
        </section>

        <section class="setting-section">
          <div class="setting-title">浏览器听书</div>
          <el-alert
            v-if="!speechSupported"
            title="当前浏览器不支持听书功能"
            type="warning"
            :closable="false"
            show-icon
          />
          <template v-else>
            <el-select v-model="selectedVoiceName" placeholder="选择声音" filterable clearable>
              <el-option
                v-for="voice in availableVoices"
                :key="voice.name"
                :label="`${voice.name}（${voice.lang}）`"
                :value="voice.name"
              />
            </el-select>
            <div class="setting-title sub-title">语速 {{ speechRate.toFixed(1) }}</div>
            <el-slider v-model="speechRate" :min="0.6" :max="1.8" :step="0.1" />
            <div class="setting-title sub-title">音调 {{ speechPitch.toFixed(1) }}</div>
            <el-slider v-model="speechPitch" :min="0.6" :max="1.6" :step="0.1" />
            <div class="speech-actions">
              <el-button :disabled="!hasReadableContent" @click="jumpSpeechSentence(-1)">上一句</el-button>
              <el-button type="primary" :disabled="!hasReadableContent" @click="toggleSpeech">{{ speechButtonText }}</el-button>
              <el-button :disabled="!hasReadableContent" @click="jumpSpeechSentence(1)">下一句</el-button>
              <el-button :disabled="!isSpeaking && !isPaused" @click="stopSpeech">停止</el-button>
            </div>
          </template>
        </section>
      </div>
    </el-drawer>

    <!-- 正文搜索 -->
    <el-drawer
      v-model="showSearch"
      title="正文搜索"
      direction="rtl"
      size="320px"
    >
      <div class="reader-search-panel">
        <el-input
          v-model="searchKeyword"
          placeholder="输入要搜索的正文"
          clearable
          @keyup.enter="goNextSearchResult"
        />
        <div class="search-meta">
          <span v-if="searchKeyword">共找到 {{ searchMatches.length }} 处</span>
          <span v-else>输入关键词后会在正文中高亮显示</span>
        </div>
        <div class="search-actions">
          <el-button :disabled="searchMatches.length === 0" @click="goPrevSearchResult">上一处</el-button>
          <el-button type="primary" :disabled="searchMatches.length === 0" @click="goNextSearchResult">下一处</el-button>
        </div>
      </div>
    </el-drawer>

    <reader-popup-ad />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { findSwitchedChapterPosition, getCurrentChapterPosition, useBookStore } from '@/store/book'
import { useAuthStore } from '@/store/auth'
import { ElMessage } from 'element-plus'
import AdSlot from '@/components/AdSlot.vue'
import ReaderPopupAd from '@/components/ReaderPopupAd.vue'
import {
  ArrowLeft, List, Loading, DArrowLeft, DArrowRight,
  ZoomIn, ZoomOut, Switch, Setting, FullScreen, Search,
} from '@element-plus/icons-vue'
import { configApi, type AlternateSource, type Chapter } from '@/api'
import { cleanReaderContent } from '@/utils/contentCleaner'
import { loadDetailBook, saveDetailBook } from '@/utils/bookDetail'
import { configsToMap } from '@/utils/siteConfig'
import { applySeo, defaultSeoTemplates } from '@/utils/seo'

type ReaderTheme = 'paper' | 'white' | 'green' | 'gray' | 'dark'
type ContentWidth = 'narrow' | 'standard' | 'wide'
type ReadingMode = 'scroll' | 'pagination'
type PageAnimation = 'none' | 'slide' | 'simulation'
type TapZoneKey = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
type TapZoneAction = 'menu' | 'prev' | 'next' | 'catalog' | 'settings' | 'bookmark' | 'listen' | 'none'
type TitleMode = 'show' | 'center' | 'hide'

const TAP_ZONE_KEYS: TapZoneKey[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']
const TAP_ZONE_LABELS: Record<TapZoneKey, string> = {
  tl: '左上',
  tc: '中上',
  tr: '右上',
  ml: '左中',
  mc: '中间',
  mr: '右中',
  bl: '左下',
  bc: '中下',
  br: '右下',
}
const TAP_ZONE_ACTION_OPTIONS: Array<{ label: string; value: TapZoneAction }> = [
  { label: '菜单', value: 'menu' },
  { label: '上一页/章', value: 'prev' },
  { label: '下一页/章', value: 'next' },
  { label: '目录', value: 'catalog' },
  { label: '设置', value: 'settings' },
  { label: '书签', value: 'bookmark' },
  { label: '听书', value: 'listen' },
  { label: '无动作', value: 'none' },
]
const DEFAULT_TAP_ZONE_ACTIONS: Record<TapZoneKey, TapZoneAction> = {
  tl: 'prev',
  tc: 'menu',
  tr: 'next',
  ml: 'prev',
  mc: 'menu',
  mr: 'next',
  bl: 'prev',
  bc: 'menu',
  br: 'next',
}

interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: ReaderTheme
  contentWidth: ContentWidth
  readingMode: ReadingMode
  pageAnimation: PageAnimation
  autoNextChapterOnScroll: boolean
  autoPageEnabled: boolean
  autoPageInterval: number
  tapTurnPage: boolean
  volumeTurnPage: boolean
  keepScreenOn: boolean
  letterSpacing: number
  paragraphSpacing: number
  textIndent: number
  pagePadding: number
  titleMode: TitleMode
  showHeaderFooter: boolean
  tapZoneActions: Record<TapZoneKey, TapZoneAction>
}

const READER_SETTINGS_KEY = 'reader_settings_v1'

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'paper',
  contentWidth: 'standard',
  readingMode: 'scroll',
  pageAnimation: 'slide',
  autoNextChapterOnScroll: true,
  autoPageEnabled: false,
  autoPageInterval: 8,
  tapTurnPage: true,
  volumeTurnPage: true,
  keepScreenOn: true,
  letterSpacing: 0,
  paragraphSpacing: 0.75,
  textIndent: 2,
  pagePadding: 24,
  titleMode: 'center',
  showHeaderFooter: true,
  tapZoneActions: { ...DEFAULT_TAP_ZONE_ACTIONS },
}

const READER_THEMES: Record<ReaderTheme, { background: string; text: string; panel: string }> = {
  paper: { background: '#f5ecd8', text: '#3f3424', panel: 'rgba(255, 250, 240, 0.92)' },
  white: { background: '#ffffff', text: '#222222', panel: 'rgba(255, 255, 255, 0.94)' },
  green: { background: '#dfeedd', text: '#273b2a', panel: 'rgba(246, 255, 245, 0.94)' },
  gray: { background: '#edf0f2', text: '#2f3437', panel: 'rgba(248, 250, 251, 0.94)' },
  dark: { background: '#15171a', text: '#d6d0c4', panel: 'rgba(30, 32, 36, 0.94)' },
}

const CONTENT_WIDTHS: Record<ContentWidth, string> = {
  narrow: '680px',
  standard: '820px',
  wide: '1040px',
}

const router = useRouter()
const route = useRoute()
const bookStore = useBookStore()
const authStore = useAuthStore()

const showHeader = ref(true)
const showCatalog = ref(false)
const showSourceDrawer = ref(false)
const showSettings = ref(false)
const showSearch = ref(false)
const sourceLoading = ref(false)
const alternateSources = ref<AlternateSource[]>([])
const autoRecommendSourceRunning = ref(false)
const visibleSourceCount = ref(10)
const targetChapterIndexAfterSwitch = ref(0)
const chapterBeforeSwitch = ref<{ title: string; index: number; url?: string } | null>(null)
const chaptersBeforeSwitch = ref<Chapter[]>([])
const readerSettings = ref<ReaderSettings>({ ...DEFAULT_READER_SETTINGS })
const readerContentRef = ref<HTMLElement | null>(null)
const speechSupported = ref(false)
const isSpeaking = ref(false)
const isPaused = ref(false)
const speechRate = ref(1)
const speechPitch = ref(1)
const selectedVoiceName = ref('')
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const spokenCharIndex = ref(-1)
const siteConfigMap = ref<Record<string, string>>({})
const isNativeFullscreen = ref(false)
const wakeLockSupported = ref(false)
const searchKeyword = ref('')
const currentSearchIndex = ref(-1)
const touchStartX = ref(0)
const touchStartY = ref(0)
const isPageAnimating = ref(false)
const isLoadingNextByScroll = ref(false)
let wakeLockSentinel: any = null
let autoPageTimer: number | null = null

const bookUrl = computed(() => {
  return decodeURIComponent((route.params.bookUrl as string) || '')
})

const readerBookInfo = computed(() => {
  return bookStore.currentBook || loadDetailBook(bookUrl.value)
})

const formattedContent = computed(() => {
  const content = cleanReaderContent(bookStore.currentChapter?.content || '')
  let cursor = 0
  return content.split('\n').map((line) => {
    const start = cursor
    const end = cursor + line.length
    cursor = end + 1
    const active = (isSpeaking.value || isPaused.value) && spokenCharIndex.value >= start && spokenCharIndex.value <= end
    const html = highlightSearchHtml(escapeHtml(line || ' '))
      .replace(/\s{2,}/g, '&nbsp;&nbsp;')
    return `<p class="reader-paragraph${active ? ' speaking' : ''}">${html}</p>`
  }).join('')
})

const searchMatches = computed(() => {
  const keyword = searchKeyword.value.trim()
  const content = bookStore.currentChapter?.content || ''
  if (!keyword || !content) return []
  const regex = new RegExp(escapeRegExp(keyword), 'gi')
  return Array.from(content.matchAll(regex)).map(match => match.index ?? 0)
})

const hasReadableContent = computed(() => {
  return !!bookStore.currentChapter?.content?.trim()
})

const requiresLoginToContinue = computed(() => {
  return !authStore.isLoggedIn && bookStore.contentAccessError?.data?.requiresLogin
})

const guestReadChapterLimitText = computed(() => {
  const limit = Number(bookStore.contentAccessError?.data?.guestReadChapterLimit ?? 0)
  return Number.isFinite(limit) && limit > 0 ? String(limit) : '0'
})

const currentChapterIndex = computed(() => {
  return bookStore.currentChapter?.index ?? -1
})

const currentChapterPosition = computed(() => {
  return getCurrentChapterPosition(bookStore.chapters, bookStore.currentChapter)
})

const hasPrev = computed(() => currentChapterPosition.value > 0)
const hasNext = computed(() => {
  return currentChapterPosition.value < bookStore.chapters.length - 1
})

const visibleAlternateSources = computed(() => {
  return alternateSources.value.slice(0, visibleSourceCount.value)
})

const activeTheme = computed(() => READER_THEMES[readerSettings.value.theme] || READER_THEMES.paper)

const readerContentStyle = computed(() => ({
  fontSize: `${readerSettings.value.fontSize}px`,
  lineHeight: String(readerSettings.value.lineHeight),
  background: activeTheme.value.background,
  color: activeTheme.value.text,
  '--reader-page-padding': `${readerSettings.value.pagePadding}px`,
  '--reader-letter-spacing': `${readerSettings.value.letterSpacing}em`,
  '--reader-paragraph-spacing': `${readerSettings.value.paragraphSpacing}em`,
  '--reader-text-indent': `${readerSettings.value.textIndent}em`,
  '--reader-content-width': CONTENT_WIDTHS[readerSettings.value.contentWidth],
}))

const contentBodyStyle = computed(() => ({
  maxWidth: CONTENT_WIDTHS[readerSettings.value.contentWidth],
  color: activeTheme.value.text,
}))

const speechButtonText = computed(() => {
  if (isPaused.value) return '继续'
  if (isSpeaking.value) return '暂停'
  return '听书'
})

const speechContentOffset = computed(() => {
  const title = bookStore.currentChapter?.title || ''
  return title ? title.length + 1 : 0
})

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightSearchHtml(html: string) {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return html
  const escapedKeyword = escapeHtml(keyword)
  return html.replace(new RegExp(escapeRegExp(escapedKeyword), 'gi'), '<mark class="reader-search-hit">$&</mark>')
}

function loadReaderSettings() {
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<ReaderSettings>
    readerSettings.value = {
      ...DEFAULT_READER_SETTINGS,
      ...saved,
      fontSize: Number(saved.fontSize || DEFAULT_READER_SETTINGS.fontSize),
      lineHeight: Number(saved.lineHeight || DEFAULT_READER_SETTINGS.lineHeight),
      letterSpacing: Number(saved.letterSpacing ?? DEFAULT_READER_SETTINGS.letterSpacing),
      paragraphSpacing: Number(saved.paragraphSpacing ?? DEFAULT_READER_SETTINGS.paragraphSpacing),
      textIndent: Number(saved.textIndent ?? DEFAULT_READER_SETTINGS.textIndent),
      pagePadding: Number(saved.pagePadding ?? DEFAULT_READER_SETTINGS.pagePadding),
      tapZoneActions: {
        ...DEFAULT_TAP_ZONE_ACTIONS,
        ...(saved.tapZoneActions || {}),
      },
    }
  } catch {
    readerSettings.value = { ...DEFAULT_READER_SETTINGS }
  }
}

function saveReaderSettings() {
  localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(readerSettings.value))
}

function syncFontSize() {
  bookStore.setFontSize(readerSettings.value.fontSize)
}

function isReaderCompactViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches
}

function toggleHeader() {
  showHeader.value = !showHeader.value
}

function handleHeaderFooterToggle(value: boolean | string | number) {
  if (!value) {
    showHeader.value = false
  }
}

function handleReaderClick(event: MouseEvent) {
  if (!readerSettings.value.tapTurnPage) {
    toggleHeader()
    return
  }
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const zone = getTapZoneKey(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height)
  runTapZoneAction(readerSettings.value.tapZoneActions[zone] || DEFAULT_TAP_ZONE_ACTIONS[zone])
}

function getTapZoneKey(x: number, y: number, width: number, height: number): TapZoneKey {
  const col = x < width / 3 ? 'l' : x < width * 2 / 3 ? 'c' : 'r'
  const row = y < height / 3 ? 't' : y < height * 2 / 3 ? 'm' : 'b'
  return `${row}${col}` as TapZoneKey
}

function runTapZoneAction(action: TapZoneAction) {
  switch (action) {
    case 'menu':
      toggleHeader()
      break
    case 'prev':
      prevPageOrChapter()
      break
    case 'next':
      nextPageOrChapter()
      break
    case 'catalog':
      showHeader.value = true
      showCatalog.value = true
      break
    case 'settings':
      showHeader.value = true
      showSettings.value = true
      break
    case 'bookmark':
      addBookmark()
      break
    case 'listen':
      toggleSpeech()
      break
    case 'none':
    default:
      break
  }
}

function goBack() {
  router.back()
}

function goLogin() {
  router.push({ name: 'Login', query: { redirect: route.fullPath } })
}

function isCurrentChapter(chapter: Chapter) {
  if (!bookStore.currentChapter) return false
  return getCurrentChapterPosition(bookStore.chapters, chapter) === currentChapterPosition.value
}

async function jumpToChapter(chapter: Chapter) {
  if (isCurrentChapter(chapter)) {
    showCatalog.value = false
    return
  }
  showCatalog.value = false
  await loadChapterContent(chapter)
}

async function prevChapter() {
  if (!hasPrev.value) return
  const chapter = bookStore.chapters[currentChapterPosition.value - 1]
  if (chapter) await loadChapterContent(chapter)
}

async function nextChapter() {
  if (!hasNext.value) return
  const chapter = bookStore.chapters[currentChapterPosition.value + 1]
  if (chapter) await loadChapterContent(chapter)
}

function resetReaderViewport() {
  readerContentRef.value?.scrollTo({ top: 0, behavior: 'auto' })
  currentSearchIndex.value = -1
  isLoadingNextByScroll.value = false
}

function runPageAnimation() {
  if (readerSettings.value.pageAnimation === 'none') return
  isPageAnimating.value = true
  window.setTimeout(() => {
    isPageAnimating.value = false
  }, 260)
}

async function goNextPage() {
  const el = readerContentRef.value
  if (!el) {
    await nextChapter()
    return
  }
  const pageHeight = Math.max(el.clientHeight - 24, 120)
  const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
  if (reachedBottom) {
    await nextChapter()
    return
  }
  runPageAnimation()
  el.scrollTo({ top: Math.min(el.scrollTop + pageHeight, el.scrollHeight), behavior: 'smooth' })
}

async function goPrevPage() {
  const el = readerContentRef.value
  if (!el) {
    await prevChapter()
    return
  }
  const pageHeight = Math.max(el.clientHeight - 24, 120)
  if (el.scrollTop <= 8) {
    await prevChapter()
    return
  }
  runPageAnimation()
  el.scrollTo({ top: Math.max(el.scrollTop - pageHeight, 0), behavior: 'smooth' })
}

function nextPageOrChapter() {
  if (readerSettings.value.readingMode === 'pagination') {
    goNextPage()
  } else {
    nextChapter()
  }
}

function prevPageOrChapter() {
  if (readerSettings.value.readingMode === 'pagination') {
    goPrevPage()
  } else {
    prevChapter()
  }
}

async function handleReaderScroll(event: Event) {
  if (readerSettings.value.readingMode !== 'scroll' || !readerSettings.value.autoNextChapterOnScroll) return
  const el = event.target as HTMLElement
  if (!hasNext.value || isLoadingNextByScroll.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
    isLoadingNextByScroll.value = true
    await nextChapter()
  }
}

function handleTouchStart(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
}

function handleTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (!touch) return
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
  if (deltaX < 0) {
    nextPageOrChapter()
  } else {
    prevPageOrChapter()
  }
}

function getBookmarkStorageKey() {
  return `reader_bookmarks_${bookUrl.value}`
}

function addBookmark() {
  const bookmark = {
    chapterTitle: bookStore.currentChapter?.title || '',
    chapterIndex: currentChapterPosition.value,
    createdAt: new Date().toISOString(),
  }
  const raw = localStorage.getItem(getBookmarkStorageKey())
  const list = raw ? JSON.parse(raw) : []
  list.push(bookmark)
  localStorage.setItem(getBookmarkStorageKey(), JSON.stringify(list))
  ElMessage.success('书签已添加')
}

async function loadChapterContent(chapter: Chapter) {
  try {
    stopSpeech()
    await bookStore.loadContent(bookUrl.value, chapter.url, readerBookInfo.value?.sourceUrl)
    applyReaderSeo()
    resetReaderViewport()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    ElMessage.warning('当前书源正文加载失败，正在查找可读换源')
    recommendReadableSourceAfterContentFailure()
  }
}

function recommendReadableSourceAfterContentFailure() {
  if (autoRecommendSourceRunning.value) return
  autoRecommendSourceRunning.value = true
  openSwitchSource()
  setTimeout(() => {
    autoRecommendSourceRunning.value = false
  }, 15000)
}

function applyReaderSeo() {
  const bookInfo = readerBookInfo.value
  applySeo(siteConfigMap.value, {
    titleKey: 'reader_title_template',
    keywordsKey: 'reader_keywords_template',
    descriptionKey: 'reader_description_template',
    fallbackTitle: defaultSeoTemplates.reader_title_template,
    fallbackKeywords: defaultSeoTemplates.reader_keywords_template,
    fallbackDescription: defaultSeoTemplates.reader_description_template,
  }, {
    bookName: bookInfo?.name || bookStore.currentBook?.name || '',
    author: bookInfo?.author || bookStore.currentBook?.author || '',
    intro: bookInfo?.intro || bookStore.currentBook?.intro || '',
    category: bookInfo?.kind || '',
    latestChapter: bookInfo?.latestChapterTitle || '',
    chapterTitle: bookStore.currentChapter?.title || '',
    sourceName: bookInfo?.sourceName || '',
  })
}

async function openSwitchSource() {
  showHeader.value = true
  showSourceDrawer.value = true
  sourceLoading.value = true
  alternateSources.value = []
  visibleSourceCount.value = 10
  const bookInfo = readerBookInfo.value
  bookStore.streamAlternateSources(
    bookUrl.value,
    {
      name: bookInfo?.name || '',
      author: bookInfo?.author || '',
      sourceUrl: bookInfo?.sourceUrl || bookInfo?.originName || '',
      chapterIndex: Math.max(currentChapterPosition.value, 0),
    },
    (source) => {
      if (!alternateSources.value.some(item => item.bookUrl === source.bookUrl)) {
        alternateSources.value.push(source)
      }
    },
    () => {},
    () => {
      sourceLoading.value = false
      if (alternateSources.value.length === 0) {
        ElMessage.info('暂时没有找到其它可用书源')
      }
    },
    (msg) => {
      sourceLoading.value = false
      if (alternateSources.value.length === 0) {
        if (msg.includes('登录')) {
          ElMessage.warning(msg)
          goLogin()
        } else {
          ElMessage.error('搜索其它书源失败: ' + msg)
        }
      }
    }
  )
}

function stopSwitchSourceSearch() {
  bookStore.stopAlternateSourceSearch()
  sourceLoading.value = false
}

function handleSourceListScroll(event: Event) {
  const el = event.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
    visibleSourceCount.value = Math.min(visibleSourceCount.value + 10, alternateSources.value.length)
  }
}

async function switchToSource(source: AlternateSource) {
  if (source.isCurrentSource) {
    ElMessage.info('当前已经在使用这个书源')
    return
  }
  const currentPosition = Math.max(currentChapterPosition.value, 0)
  targetChapterIndexAfterSwitch.value = currentPosition
  chapterBeforeSwitch.value = bookStore.currentChapter
    ? {
        title: bookStore.currentChapter.title,
        index: bookStore.currentChapter.index,
        url: bookStore.currentChapter.url,
      }
    : null
  chaptersBeforeSwitch.value = bookStore.chapters.slice()
  sourceLoading.value = true
  bookStore.stopAlternateSourceSearch()
  try {
    const newBookUrl = await bookStore.switchSource(bookUrl.value, source, currentPosition)
    showSourceDrawer.value = false
    ElMessage.success('换源成功')

    // 保存新书源信息到 sessionStorage，确保详情页能显示最新书源信息
    const switchedBook = {
      bookUrl: newBookUrl,
      name: source.name || bookStore.currentBook?.name || '',
      author: source.author || bookStore.currentBook?.author || '',
      coverUrl: source.coverUrl || bookStore.currentBook?.coverUrl || '',
      intro: source.intro || bookStore.currentBook?.intro || '',
      sourceUrl: source.sourceUrl,
      sourceName: source.sourceName,
      kind: (source as any).kind || '',
      latestChapterTitle: (source as any).latestChapterTitle || '',
      wordCount: (source as any).wordCount || '',
    }
    saveDetailBook(switchedBook)
    bookStore.setCurrentBook(switchedBook as any)

    await router.replace(`/read/${encodeURIComponent(newBookUrl)}`)
    await bookStore.loadChapters(newBookUrl, source.sourceUrl)
    const targetPosition = findSwitchedChapterPosition(
      chaptersBeforeSwitch.value,
      chapterBeforeSwitch.value,
      bookStore.chapters
    )
    await loadFirstAvailableChapter(targetPosition)
  } catch (e: any) {
    ElMessage.error('换源失败: ' + (e.response?.data?.msg || e.message || ''))
  } finally {
    sourceLoading.value = false
  }
}

async function loadFirstAvailableChapter(preferredIndex = 0) {
  if (bookStore.chapters.length === 0) return
  const index = Math.min(Math.max(preferredIndex, 0), bookStore.chapters.length - 1)
  const chapter = bookStore.chapters[index] || bookStore.chapters[0]
  if (chapter) await loadChapterContent(chapter)
}

function increaseFont() {
  readerSettings.value.fontSize = Math.min(readerSettings.value.fontSize + 2, 32)
  syncFontSize()
}

function decreaseFont() {
  readerSettings.value.fontSize = Math.max(readerSettings.value.fontSize - 2, 14)
  syncFontSize()
}

function loadVoices() {
  if (!speechSupported.value) return
  const voices = window.speechSynthesis.getVoices()
  availableVoices.value = voices
  if (!selectedVoiceName.value) {
    const chineseVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('zh'))
    selectedVoiceName.value = chineseVoice?.name || voices[0]?.name || ''
  }
}

function getSpeechText() {
  const title = bookStore.currentChapter?.title || ''
  const content = bookStore.currentChapter?.content || ''
  return title ? `${title}\n${content}` : content
}

function startSpeech() {
  if (!speechSupported.value) {
    ElMessage.warning('当前浏览器不支持听书功能')
    return
  }
  const text = getSpeechText()
  if (!text) {
    ElMessage.warning('当前章节没有可朗读内容')
    return
  }
  window.speechSynthesis.cancel()
  spokenCharIndex.value = -1
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = availableVoices.value.find(item => item.name === selectedVoiceName.value)
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang || 'zh-CN'
  utterance.rate = speechRate.value
  utterance.pitch = speechPitch.value
  utterance.onboundary = (event) => {
    const index = Number(event.charIndex) - speechContentOffset.value
    spokenCharIndex.value = index >= 0 ? index : -1
  }
  utterance.onend = () => {
    isSpeaking.value = false
    isPaused.value = false
    spokenCharIndex.value = -1
  }
  utterance.onerror = () => {
    isSpeaking.value = false
    isPaused.value = false
    spokenCharIndex.value = -1
  }
  window.speechSynthesis.speak(utterance)
  isSpeaking.value = true
  isPaused.value = false
}

function toggleSpeech() {
  if (!speechSupported.value) return
  if (isPaused.value) {
    window.speechSynthesis.resume()
    isPaused.value = false
    isSpeaking.value = true
    return
  }
  if (isSpeaking.value) {
    window.speechSynthesis.pause()
    isPaused.value = true
    isSpeaking.value = false
    return
  }
  startSpeech()
}

function stopSpeech() {
  if (!speechSupported.value) return
  window.speechSynthesis.cancel()
  isSpeaking.value = false
  isPaused.value = false
  spokenCharIndex.value = -1
}

function jumpSpeechSentence(direction: -1 | 1) {
  const content = bookStore.currentChapter?.content || ''
  if (!content) return
  const sentences = content
    .split(/(?<=[。！？!?；;])\s*/)
    .map(item => item.trim())
    .filter(Boolean)
  if (sentences.length === 0) return
  const current = Math.max(spokenCharIndex.value, 0)
  let cursor = 0
  let index = 0
  for (let i = 0; i < sentences.length; i += 1) {
    const nextCursor = cursor + sentences[i].length
    if (current <= nextCursor) {
      index = i
      break
    }
    cursor = nextCursor + 1
  }
  const target = Math.min(Math.max(index + direction, 0), sentences.length - 1)
  spokenCharIndex.value = content.indexOf(sentences[target])
  window.speechSynthesis.cancel()
  const text = sentences.slice(target).join('\n')
  if (text) {
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = availableVoices.value.find(item => item.name === selectedVoiceName.value)
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || 'zh-CN'
    utterance.rate = speechRate.value
    utterance.pitch = speechPitch.value
    window.speechSynthesis.speak(utterance)
    isSpeaking.value = true
    isPaused.value = false
  }
}

function openSearch() {
  showHeader.value = true
  showSearch.value = true
}

function scrollToSearchResult(index: number) {
  currentSearchIndex.value = index
  requestAnimationFrame(() => {
    const hits = readerContentRef.value?.querySelectorAll('.reader-search-hit')
    const target = hits?.[index] as HTMLElement | undefined
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function goNextSearchResult() {
  if (searchMatches.value.length === 0) return
  const next = (currentSearchIndex.value + 1) % searchMatches.value.length
  scrollToSearchResult(next)
}

function goPrevSearchResult() {
  if (searchMatches.value.length === 0) return
  const prev = currentSearchIndex.value <= 0 ? searchMatches.value.length - 1 : currentSearchIndex.value - 1
  scrollToSearchResult(prev)
}

function startAutoPage() {
  stopAutoPage()
  if (!readerSettings.value.autoPageEnabled) return
  autoPageTimer = window.setInterval(() => {
    nextPageOrChapter()
  }, Math.max(readerSettings.value.autoPageInterval, 3) * 1000)
}

function stopAutoPage() {
  if (autoPageTimer != null) {
    window.clearInterval(autoPageTimer)
    autoPageTimer = null
  }
}

// 键盘快捷键
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prevPageOrChapter()
  } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault()
    nextPageOrChapter()
  } else if (readerSettings.value.volumeTurnPage && ['AudioVolumeUp', 'VolumeUp', 'MediaTrackNext'].includes(e.key)) {
    nextPageOrChapter()
  } else if (readerSettings.value.volumeTurnPage && ['AudioVolumeDown', 'VolumeDown', 'MediaTrackPrevious'].includes(e.key)) {
    prevPageOrChapter()
  }
}

async function toggleNativeFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    const target = document.documentElement
    if (!target.requestFullscreen) {
      ElMessage.info('当前浏览器不支持真正全屏，已使用网页全屏模式')
      showHeader.value = false
      return
    }

    await target.requestFullscreen()
    showHeader.value = false
  } catch {
    ElMessage.info('当前浏览器不支持真正全屏，已使用网页全屏模式')
    showHeader.value = false
  }
}

function syncNativeFullscreenState() {
  isNativeFullscreen.value = !!document.fullscreenElement
  if (isNativeFullscreen.value && isReaderCompactViewport()) {
    showHeader.value = false
  }
}

async function requestWakeLock() {
  const wakeLock = (navigator as any).wakeLock
  wakeLockSupported.value = !!wakeLock?.request
  if (!readerSettings.value.keepScreenOn || !wakeLockSupported.value || document.visibilityState !== 'visible') return
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen')
    wakeLockSentinel.addEventListener?.('release', () => {
      wakeLockSentinel = null
    })
  } catch {
    wakeLockSentinel = null
  }
}

async function releaseWakeLock() {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release?.()
    wakeLockSentinel = null
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    requestWakeLock()
  }
}

onMounted(async () => {
  loadReaderSettings()
  syncFontSize()
  wakeLockSupported.value = !!(navigator as any).wakeLock?.request
  requestWakeLock()
  if (isReaderCompactViewport()) {
    showHeader.value = false
  }
  speechSupported.value = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  if (speechSupported.value) {
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', syncNativeFullscreenState)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  try {
    const res = await configApi.getPublicConfigs()
    siteConfigMap.value = configsToMap(res.data || [])
  } catch {
    siteConfigMap.value = {}
  }

  if (!bookUrl.value) {
    router.push('/')
    return
  }

  const cachedBook = loadDetailBook(bookUrl.value)
  if (!bookStore.currentBook && cachedBook) {
    bookStore.setCurrentBook(cachedBook as any)
  }

  // 加载章节列表
  await bookStore.loadChapters(bookUrl.value, readerBookInfo.value?.sourceUrl)

  const queryChapterIndex = Number(route.query.chapter)
  if (Number.isFinite(queryChapterIndex) && queryChapterIndex >= 0 && queryChapterIndex < bookStore.chapters.length) {
    const chapter = bookStore.chapters[queryChapterIndex]
    if (chapter) {
      await loadChapterContent(chapter)
      return
    }
  }

  // 如果有上次阅读的章节，跳转到该章节
  const book = bookStore.currentBook
  if (book?.durChapterIndex != null && book.durChapterIndex < bookStore.chapters.length) {
    const chapter = bookStore.chapters[book.durChapterIndex]
    if (chapter) {
      await loadChapterContent(chapter)
      return
    }
  }

  // 否则加载第一章
  await loadFirstAvailableChapter(0)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', syncNativeFullscreenState)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  releaseWakeLock()
  if (speechSupported.value) {
    window.speechSynthesis.onvoiceschanged = null
  }
  stopSpeech()
  stopAutoPage()
})

watch(readerSettings, () => {
  syncFontSize()
  saveReaderSettings()
  if (readerSettings.value.keepScreenOn) {
    requestWakeLock()
  } else {
    releaseWakeLock()
  }
  startAutoPage()
}, { deep: true })

watch(searchKeyword, () => {
  currentSearchIndex.value = -1
})

// 监听路由变化
watch(
  () => route.params.bookUrl,
  async (newUrl) => {
    if (newUrl) {
      const cachedBook = loadDetailBook(decodeURIComponent(newUrl as string))
      if (cachedBook) {
        bookStore.setCurrentBook(cachedBook as any)
      }
      await bookStore.loadChapters(decodeURIComponent(newUrl as string), cachedBook?.sourceUrl || bookStore.currentBook?.sourceUrl)
      const targetPosition = findSwitchedChapterPosition(
        chaptersBeforeSwitch.value,
        chapterBeforeSwitch.value,
        bookStore.chapters
      )
      await loadFirstAvailableChapter(targetPosition || targetChapterIndexAfterSwitch.value)
      targetChapterIndexAfterSwitch.value = 0
      chapterBeforeSwitch.value = null
      chaptersBeforeSwitch.value = []
    }
  }
)
</script>

<style scoped lang="scss">
.reader-page {
  position: relative;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
}

.reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  transition: transform 0.3s ease;
  z-index: 10;

  &.header-hidden {
    transform: translateY(-100%);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .book-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .chapter-title {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 300px;
    }
  }
}

.reader-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--reader-page-padding, 40px);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  scroll-behavior: smooth;

  &.reading-mode-pagination {
    overflow-y: hidden;
    scroll-snap-type: y mandatory;
  }

  &.page-animation-slide.is-page-animating .content-text {
    animation: readerPageSlide 0.26s ease;
  }

  &.page-animation-simulation.is-page-animating .content-text {
    animation: readerPageSimulation 0.32s ease;
    transform-origin: right center;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 3px;
  }

  .content-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--el-text-color-secondary);

    .loading-icon {
      animation: rotate 1.5s linear infinite;
    }
  }

  .login-required {
    line-height: 1.8;
    color: var(--el-text-color-regular);
  }

  .content-text {
    max-width: none;
    margin: 0 auto;

    .content-title {
      text-align: center;
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 32px;
      color: currentColor;

      &.title-center {
        text-align: center;
      }
    }

    .content-body {
      margin: 0 auto;
      word-wrap: break-word;
      transition: max-width 0.2s ease;

      :deep(.reader-paragraph) {
        margin: 0 0 var(--reader-paragraph-spacing, 0.75em);
        padding: 0.15em 0.45em;
        border-radius: 8px;
        letter-spacing: var(--reader-letter-spacing, 0);
        text-indent: var(--reader-text-indent, 2em);
        transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      }

      :deep(.reader-paragraph.speaking) {
        color: #d97706;
        background: rgba(245, 158, 11, 0.18);
        box-shadow: inset 4px 0 0 rgba(245, 158, 11, 0.75);
      }

      :deep(.reader-search-hit) {
        padding: 0 2px;
        border-radius: 3px;
        color: #7c2d12;
        background: #fde68a;
      }
    }

    .reader-ad {
      max-width: var(--reader-content-width, 820px);
      margin-left: auto;
      margin-right: auto;
    }

    .reader-ad-top {
      margin-bottom: 16px;
    }

    .reader-ad-middle {
      margin-bottom: 20px;
    }

    .reader-ad-bottom {
      margin-top: 24px;
    }
  }
}

.reader-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
  transition: transform 0.3s ease;
  z-index: 10;

  &.footer-hidden {
    transform: translateY(100%);
  }

  .footer-center {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .listen-controls {
    margin-left: 0;
  }
}

.reader-settings-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-section {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.setting-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  &.sub-title {
    margin-top: 14px;
    margin-bottom: 4px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
}

.setting-tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.speech-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.reader-search-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.search-meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.search-actions {
  display: flex;
  gap: 10px;
}

.header-footer-switch {
  margin-top: 14px;
}

.tap-zone-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.tap-zone-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.catalog-list {
  .catalog-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      font-weight: 500;

      .chapter-index {
        background: var(--el-color-primary);
        color: white;
      }
    }

    .chapter-index {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: var(--el-fill-color);
      color: var(--el-text-color-secondary);
      margin-right: 12px;
      flex-shrink: 0;
    }

    .chapter-name {
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.source-switch-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.source-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  color: var(--el-text-color-secondary);

  .loading-icon {
    animation: rotate 1.5s linear infinite;
  }
}

.alternate-source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-right: 4px;
}

.alternate-source-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.is-current-source {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    cursor: default;
  }

  .source-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .source-title {
    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .source-meta {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }

  .source-intro {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.source-list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  font-size: 12px;
  color: var(--el-text-color-secondary);

  .loading-icon {
    animation: rotate 1.5s linear infinite;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes readerPageSlide {
  from { transform: translateX(16px); opacity: 0.88; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes readerPageSimulation {
  from {
    transform: perspective(900px) rotateY(-8deg);
    filter: brightness(0.96);
  }
  to {
    transform: perspective(900px) rotateY(0);
    filter: brightness(1);
  }
}

// 响应式
@media (max-width: 1024px) {
  .reader-page {
    position: fixed;
    inset: 0;
    height: 100dvh;
    width: 100vw;
    z-index: 2000;
    border-radius: 0;
    background: inherit;
  }

  .reader-content {
    height: 100dvh;
    padding-top: calc(var(--reader-page-padding, 24px) + env(safe-area-inset-top));
    padding-right: calc(var(--reader-page-padding, 24px) + env(safe-area-inset-right));
    padding-bottom: calc(var(--reader-page-padding, 24px) + env(safe-area-inset-bottom));
    padding-left: calc(var(--reader-page-padding, 24px) + env(safe-area-inset-left));
    flex: none;
  }

  .reader-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2010;
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-left: calc(20px + env(safe-area-inset-left));
    padding-right: calc(20px + env(safe-area-inset-right));
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    .header-left .book-title {
      max-width: 180px;
    }

    .header-right .chapter-title {
      max-width: 220px;
    }
  }

  .reader-footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2010;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    padding-left: calc(20px + env(safe-area-inset-left));
    padding-right: calc(20px + env(safe-area-inset-right));
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
  }
}

@media (max-width: 768px) {
  .reader-page {
    border-radius: 0;
  }

  .reader-content {
    padding-top: calc(var(--reader-page-padding, 20px) + env(safe-area-inset-top));
    padding-right: calc(var(--reader-page-padding, 16px) + env(safe-area-inset-right));
    padding-bottom: calc(var(--reader-page-padding, 20px) + env(safe-area-inset-bottom));
    padding-left: calc(var(--reader-page-padding, 16px) + env(safe-area-inset-left));

    .content-text .content-title {
      font-size: 1.15em;
      margin-bottom: 22px;
    }
  }

  .reader-header {
    padding-top: calc(8px + env(safe-area-inset-top));
    padding-right: calc(12px + env(safe-area-inset-right));
    padding-bottom: 8px;
    padding-left: calc(12px + env(safe-area-inset-left));
    gap: 8px;

    :deep(.el-button.is-circle) {
      width: 30px;
      height: 30px;
    }

    .header-left .book-title {
      max-width: 120px;
      font-size: 14px;
    }

    .header-right .chapter-title {
      display: none;
    }
  }

  .reader-footer {
    padding-top: 10px;
    padding-right: calc(12px + env(safe-area-inset-right));
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    padding-left: calc(12px + env(safe-area-inset-left));
    gap: 8px;
    flex-wrap: wrap;

    > .el-button {
      flex: 1;
      min-width: 96px;
    }

    .footer-center {
      order: 3;
      width: 100%;
    }
  }
}

@media (max-width: 480px) {
  .reader-header {
    .header-left {
      gap: 8px;
    }

    .header-left .book-title {
      max-width: 90px;
    }

    .header-right {
      gap: 6px;
    }
  }

  .reader-content {
    padding-top: calc(var(--reader-page-padding, 18px) + env(safe-area-inset-top));
    padding-right: calc(var(--reader-page-padding, 14px) + env(safe-area-inset-right));
    padding-bottom: calc(var(--reader-page-padding, 18px) + env(safe-area-inset-bottom));
    padding-left: calc(var(--reader-page-padding, 14px) + env(safe-area-inset-left));
  }
}
</style>
