<template>
  <div class="book-detail-page">
    <div class="detail-main">
      <section class="hero-card">
        <div class="cover-wrap">
          <el-image
            :src="getBookCover(book.coverUrl, book.name, book.author, siteName)"
            fit="cover"
            class="book-cover"
            @error="() => onBookCoverError(book.coverUrl, book.name)"
          />
        </div>

        <div class="book-info">
          <div class="title-row">
            <h1>{{ book.name || '小说详情' }}</h1>
            <span class="author">{{ book.author || '未知作者' }} 著</span>
          </div>
          <div class="tags">
            <el-tag v-for="tag in kindTags" :key="tag" effect="plain" round>{{ tag }}</el-tag>
            <el-tag v-if="book.sourceName" type="info" effect="plain" round>{{ book.sourceName }}</el-tag>
          </div>
          <div class="stats">
            <span><b>{{ displayWordCount }}</b> 字</span>
            <span><b>{{ socialStats.likeCount }}</b> 点赞</span>
            <span><b>{{ chapters.length }}</b> 章</span>
            <span><b>{{ socialStats.commentCount }}</b> 评论</span>
            <span><b>{{ socialStats.favoriteCount }}</b> 收藏</span>
          </div>
          <div class="actions">
            <el-button type="warning" size="large" :loading="reading" @click="startReading">
              免费阅读
            </el-button>
            <el-button
              v-if="socialStats.favorited"
              size="large"
              type="success"
              plain
              :loading="adding"
              @click="removeFromShelf"
            >
              已加入书架
            </el-button>
            <el-button v-else size="large" :loading="adding" @click="addToShelf(false)">
              加入书架
            </el-button>
            <el-button :type="socialStats.liked ? 'danger' : 'default'" size="large" plain @click="toggleLike">
              {{ socialStats.liked ? '已点赞' : '点赞' }}
            </el-button>
          </div>
        </div>

        <aside class="author-card">
          <div class="author-header">
            <b>本书作者</b>
            <el-button
              type="warning"
              round
              size="small"
              :loading="followLoading"
              @click="toggleFollowAuthor"
            >
              {{ authorFollowed ? '已关注' : '关注' }}
            </el-button>
          </div>
          <div class="author-name">
            <div class="avatar">{{ book.author?.charAt(0) || '作' }}</div>
            <span>{{ book.author || '未知作者' }}</span>
          </div>
          <div class="author-stats">
            <span><b>1</b><em>作品数</em></span>
            <span><b>{{ authorFollowerCount }}</b><em>粉丝数</em></span>
            <span><b>0</b><em>收藏数</em></span>
          </div>
        </aside>
      </section>

      <section class="content-card">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="作品简介" name="intro">
            <p class="intro-text">{{ book.intro || '暂无简介' }}</p>
            <div v-if="book.latestChapterTitle" class="latest-line">
              最新章节：{{ book.latestChapterTitle }}
            </div>
          </el-tab-pane>
          <el-tab-pane :label="`目录(${chapters.length}章)`" name="chapters">
            <div v-if="chapterLoading" class="loading-line">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在加载目录...
            </div>
            <div v-else-if="chapters.length > 0" class="chapter-grid">
              <button
                v-for="chapter in chapters"
                :key="chapter.url || chapter.index"
                class="chapter-item"
                @click="readChapter(chapter.index)"
              >
                {{ chapter.title }}
              </button>
            </div>
            <el-empty v-else description="目录加载失败或暂无目录" :image-size="90" />
          </el-tab-pane>
          <el-tab-pane :label="`作品评论区(${socialStats.commentCount})`" name="comments">
            <div class="comment-editor">
              <el-input
                v-model="commentContent"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder="说说你对这本书的看法..."
              />
              <div class="comment-actions">
                <span>{{ authStore.isLoggedIn ? '文明交流，理性评论' : '登录后可以发表评论' }}</span>
                <el-button type="primary" :loading="commentSubmitting" @click="submitComment">
                  发布评论
                </el-button>
              </div>
            </div>
            <div v-if="comments.length" class="comment-list">
              <div v-for="item in comments" :key="item.id" class="comment-item">
                <div class="comment-avatar">{{ item.username?.charAt(0) || '用' }}</div>
                <div class="comment-body">
                  <div class="comment-meta">
                    <b>{{ item.username || '用户' }}</b>
                    <span>{{ formatDateTime(item.createdAt) }}</span>
                  </div>
                  <p>{{ item.content }}</p>
                  <el-button
                    v-if="String(authStore.user?.id || '') === String(item.userId)"
                    link
                    type="danger"
                    size="small"
                    @click="deleteComment(item.id)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无评论，来抢沙发吧" :image-size="90" />
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>

    <aside class="rank-side">
      <h3>人气榜</h3>
      <div v-if="rankLoading" class="rank-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      <div v-else-if="rankList.length === 0" class="rank-empty">暂无榜单数据</div>
      <div
        v-for="(item, index) in rankList"
        v-else
        :key="item.bookUrl || index"
        class="rank-item"
        @click="router.push({ name: 'BookDetail', query: { bookUrl: item.bookUrl } })"
      >
        <span class="rank-no">{{ index + 1 }}</span>
        <span class="rank-name">{{ item.name }}</span>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { bookApi, configApi, homeApi, unwrapResponse, type BookComment, type BookSocialStats, type Chapter, type SearchResult } from '@/api'
import { useBookStore } from '@/store/book'
import { useAuthStore } from '@/store/auth'
import { configsToMap } from '@/utils/siteConfig'
import {
  loadDetailBook,
  saveDetailChapters,
  loadDetailChapters,
} from '@/utils/bookDetail'
import { applySeo, defaultSeoTemplates } from '@/utils/seo'
import { resolveBookCover, useBookCover } from '@/utils/bookCover'

const route = useRoute()
const router = useRouter()
const bookStore = useBookStore()
const authStore = useAuthStore()

const { getCover: getBookCover, onCoverError: onBookCoverError } = useBookCover()

const activeTab = ref('intro')
const chapters = ref<Chapter[]>([])
const chapterLoading = ref(false)
const adding = ref(false)
const reading = ref(false)
const checkingCollectorUpdate = ref(false)
const updatingCollector = ref(false)
const commentSubmitting = ref(false)
const commentContent = ref('')
const comments = ref<BookComment[]>([])
const authorFollowed = ref(false)
const authorFollowerCount = ref(0)
const followLoading = ref(false)
const socialStats = ref<BookSocialStats>({
  commentCount: 0,
  likeCount: 0,
  favoriteCount: 0,
  liked: false,
  favorited: false,
})
const book = ref<SearchResult>({
  bookUrl: decodeURIComponent(String(route.query.bookUrl || '')),
  name: String(route.query.name || ''),
  author: String(route.query.author || ''),
  coverUrl: String(route.query.coverUrl || ''),
  intro: String(route.query.intro || ''),
  sourceUrl: String(route.query.sourceUrl || ''),
  sourceName: String(route.query.sourceName || ''),
  type: Number(route.query.type) || undefined,
})

const kindTags = computed(() => {
  const tags = String(book.value.kind || '')
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return tags.slice(0, 8)
})

const displayWordCount = computed(() => {
  const raw = String(book.value.wordCount || '').trim()
  return raw || '--'
})

// 人气榜数据（从后端同步）
const rankList = ref<any[]>([])
const rankLoading = ref(false)
const siteName = ref('搜书网')

async function loadRankings() {
  rankLoading.value = true
  try {
    const res = await homeApi.getHotRankings({ type: 'popularity', limit: 5 })
    rankList.value = (res.data || []).slice(0, 5).map((item: any) => ({
      name: item.name,
      bookUrl: item.book_url,
      author: item.author,
    }))
  } catch {
    rankList.value = []
  } finally {
    rankLoading.value = false
  }
}

async function loadBookDetail() {
  const bookUrl = book.value.bookUrl
  if (!bookUrl) {
    ElMessage.error('缺少书籍地址')
    router.push('/')
    return
  }

  const cached = loadDetailBook(bookUrl)
  if (cached) {
    book.value = { ...book.value, ...cached }
  } else if (authStore.isLoggedIn) {
    // 无缓存时，通过 API 自动获取书籍基本信息
    await fetchBookInfo()
  }

  if (authStore.isLoggedIn) {
    await bookStore.loadShelf()
  }
  await Promise.all([loadSeo(), loadChapters(), loadRankings(), loadSocialStats(), loadComments(), loadAuthorFollowStatus()])
  void checkCollectorUpdatePrompt()
}

/** 通过 API 获取书籍基本信息（用于直接通过 URL 访问时） */
async function fetchBookInfo() {
  try {
    const info = unwrapResponse(await bookApi.getBookInfo(book.value.bookUrl, book.value.sourceUrl))
    if (info) {
      book.value = {
        ...book.value,
        name: info.name || book.value.name,
        author: info.author || book.value.author,
        coverUrl: info.coverUrl || book.value.coverUrl,
        intro: info.intro || book.value.intro,
        kind: info.kind || book.value.kind,
        type: info.type ?? book.value.type,
        sourceUrl: info.sourceUrl || book.value.sourceUrl,
        sourceName: info.sourceName || book.value.sourceName,
      }
      // 缓存到 sessionStorage
      saveDetailBook(book.value)
    }
  } catch {
    // 获取失败不影响页面其他功能
  }
}

async function loadSocialStats() {
  try {
    socialStats.value = unwrapResponse<BookSocialStats>(await bookApi.getSocialStats({
      bookUrl: book.value.bookUrl,
      name: book.value.name,
      author: book.value.author,
    }))
  } catch {
    socialStats.value = {
      commentCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: bookStore.isInShelf(book.value as any),
    }
  }
}

async function loadComments() {
  try {
    comments.value = unwrapResponse<BookComment[]>(await bookApi.getComments(book.value.bookUrl)) || []
  } catch {
    comments.value = []
  }
}

async function loadSeo() {
  try {
    const res = await configApi.getPublicConfigs()
    const configMap = configsToMap(res.data || [])
    siteName.value = configMap.site_title || '搜书网'
    applySeo(configMap, {
      titleKey: 'detail_title_template',
      keywordsKey: 'detail_keywords_template',
      descriptionKey: 'detail_description_template',
      fallbackTitle: defaultSeoTemplates.detail_title_template,
      fallbackKeywords: defaultSeoTemplates.detail_keywords_template,
      fallbackDescription: defaultSeoTemplates.detail_description_template,
    }, {
      bookName: book.value.name,
      author: book.value.author,
      intro: book.value.intro,
      category: book.value.kind,
      latestChapter: book.value.latestChapterTitle,
      sourceName: book.value.sourceName,
    })
  } catch {
    document.title = `${book.value.name || '小说详情'}_${book.value.author || '未知作者'}`
  }
}

async function loadChapters() {
  chapterLoading.value = true
  try {
    // 未登录时直接通过搜索加载目录，避免401跳转打断流程
    if (!authStore.isLoggedIn) {
      if (book.value.name && book.value.author) {
        await tryLoadChaptersFromSearch()
      }
      return
    }

    // 0. 优先读取前端 sessionStorage 缓存，实现真正的秒开
    const sessionCached = loadDetailChapters(book.value.bookUrl)
    if (sessionCached && sessionCached.length > 0) {
      chapters.value = sessionCached
    }

    // 第一阶段：从后端读取本地缓存（autoSync=false，后端不会触发远程同步）
    const cached = unwrapResponse<Chapter[]>(await bookApi.getChapterList(book.value.bookUrl, book.value.sourceUrl, false)) || []
    if (cached.length > 0) {
      const mapped = cached.map((item: any) => ({
        url: item.url,
        title: item.title,
        index: item.chapter_index ?? item.index ?? 0,
      }))
      chapters.value = mapped
      saveDetailChapters(book.value.bookUrl, mapped)
    }

    // 如果本地缓存为空，尝试同步加载（首次访问或章节很少时）
    if (chapters.value.length === 0) {
      const list = unwrapResponse<Chapter[]>(await bookApi.getChapterList(book.value.bookUrl, book.value.sourceUrl, true)) || []
      if (list.length > 0) {
        const mapped = list.map((item: any) => ({
          url: item.url,
          title: item.title,
          index: item.chapter_index ?? item.index ?? 0,
        }))
        chapters.value = mapped
        saveDetailChapters(book.value.bookUrl, mapped)
      }
    }

    // 如果目录仍为空，尝试搜索同名同作者的书籍并加载其目录
    if (chapters.value.length === 0 && book.value.name && book.value.author) {
      await tryLoadChaptersFromSearch()
    }
  } catch {
    // 加载失败时保留已有章节，不清空
    if (chapters.value.length === 0 && book.value.name && book.value.author) {
      await tryLoadChaptersFromSearch()
    }
  } finally {
    chapterLoading.value = false
  }

  // 第二阶段：页面加载完成后，后台静默检测目标站是否有更新
  // 使用 setTimeout 确保不阻塞页面渲染
  if (authStore.isLoggedIn && chapters.value.length >= 100) {
    setTimeout(async () => {
      try {
        const oldCount = chapters.value.length
        const updated = unwrapResponse<Chapter[]>(await bookApi.getChapterList(book.value.bookUrl, book.value.sourceUrl, true)) || []
        if (updated.length > oldCount) {
          const mapped = updated.map((item: any) => ({
            url: item.url,
            title: item.title,
            index: item.chapter_index ?? item.index ?? 0,
          }))
          chapters.value = mapped
          saveDetailChapters(book.value.bookUrl, mapped)
          ElMessage.success(`检测到目录更新，新增 ${updated.length - oldCount} 章`)
        }
      } catch {
        // 静默失败，不影响用户当前阅读
      }
    }, 2000)
  }
}

/** 通过搜索同名同作者的书籍，找到有目录的来源并更新 */
async function tryLoadChaptersFromSearch() {
  const keyword = book.value.name
  const author = book.value.author
  if (!keyword || !author) return

  const currentBookUrl = book.value.bookUrl
  // 清理作者名中的"作者："前缀
  const cleanAuthor = (s: string) => s.replace(/^作者[:：]/, '').replace(/\s+/g, '')
  const bName = keyword.replace(/\s+/g, '')
  const bAuthor = cleanAuthor(author)

  return new Promise<void>((resolve) => {
    let resolved = false
    const es = bookApi.searchBooksSSE(
      keyword,
      async (result: SearchResult) => {
        if (resolved) return
        if (result.bookUrl === currentBookUrl) return // 跳过相同来源
        const rName = (result.name || '').replace(/\s+/g, '')
        const rAuthor = cleanAuthor(result.author || '')
        // 匹配条件：同名且（作者精确匹配 或 作者为空）
        if (rName === bName && (rAuthor === bAuthor || !rAuthor) && result.bookUrl) {
          // 尝试获取该书籍的目录，如果有章节则使用，否则继续搜索下一个
          const hasChapters = await loadChaptersFromBook(result)
          if (hasChapters) {
            resolved = true
            try { (es as any).close?.() } catch {}
            resolve()
          }
          // 没有章节则继续等待下一个匹配结果
        }
      },
      () => {},
      () => { if (!resolved) resolve() },
      () => { resolve() },
      { targetCount: 30 }
    )

    setTimeout(() => {
      if (!resolved) {
        try { (es as any).close?.() } catch {}
        resolve()
      }
    }, 20000)
  })
}

/** 从搜索结果中的书籍加载目录，返回是否有章节 */
async function loadChaptersFromBook(searchResult: SearchResult): Promise<boolean> {
  try {
    const list = unwrapResponse<Chapter[]>(
      await bookApi.getChapterList(searchResult.bookUrl, searchResult.sourceUrl)
    ) || []

    if (list.length > 0) {
      // 更新当前书籍信息
      book.value = {
        ...book.value,
        bookUrl: searchResult.bookUrl,
        sourceUrl: searchResult.sourceUrl,
        sourceName: searchResult.sourceName,
      }
      chapters.value = list.map((item: any) => ({
        url: item.url,
        title: item.title,
        index: item.chapter_index ?? item.index ?? 0,
      }))
      ElMessage.success(`已从「${searchResult.sourceName || '其他来源'}」加载目录，共 ${list.length} 章`)
      return true
    }
    return false
  } catch {
    return false
  }
}

async function checkCollectorUpdatePrompt() {
  console.log('[checkCollectorUpdatePrompt] 开始检查, bookUrl:', book.value.bookUrl, 'type:', book.value.type)
  if (!book.value.bookUrl || checkingCollectorUpdate.value || updatingCollector.value) {
    console.log('[checkCollectorUpdatePrompt] 提前返回: 缺少bookUrl或正在检查/更新中')
    return
  }
  checkingCollectorUpdate.value = true
  try {
    console.log('[checkCollectorUpdatePrompt] 调用 checkCollectorUpdate, bookUrl:', book.value.bookUrl)
    const raw = await bookApi.checkCollectorUpdate(book.value.bookUrl)
    console.log('[checkCollectorUpdatePrompt] API返回:', raw)
    const result = unwrapResponse<{ canUpdate: boolean; localChapterCount: number; remoteChapterCount: number; ruleName: string; message?: string }>(raw)
    console.log('[checkCollectorUpdatePrompt] 解析结果:', result)
    if (!result || !result.canUpdate) {
      console.log('[checkCollectorUpdatePrompt] 无需更新:', result?.message || '无结果')
      return
    }

    // 弹窗确认更新
    try {
      await ElMessageBox.confirm(
        `${result.message || '检测到目标站有章节更新'}，是否立即同步？`,
        '章节更新',
        { confirmButtonText: '立即更新', cancelButtonText: '暂不更新', type: 'info' }
      )
    } catch {
      // 用户点击取消或关闭弹窗
      return
    }

    updatingCollector.value = true
    ElMessage.info('正在更新章节目录...')
    const rawUpdated = await bookApi.updateCollectorBook(book.value.bookUrl)
    const updated = unwrapResponse<{ chapterCount: number; imported: boolean }>(rawUpdated)
    if (updated.chapterCount > 0) {
      ElMessage.success(`已更新到 ${updated.chapterCount} 章`)
      await loadChapters()
    } else {
      ElMessage.success('章节已是最新')
    }
  } catch (error: any) {
    console.warn('[BookDetail] 检查采集更新失败:', error?.message || error, 'code:', error?.code)
    // 401（未登录）等认证错误静默忽略
    if (error?.code !== 401 && error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '更新失败')
    }
  } finally {
    checkingCollectorUpdate.value = false
    updatingCollector.value = false
  }
}

async function addToShelf(silent = false) {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  if (socialStats.value.favorited || bookStore.isInShelf(book.value as any)) {
    socialStats.value.favorited = true
    if (!silent) ElMessage.info('已在书架中')
    return
  }

  adding.value = true
  try {
    await bookStore.addBook(book.value.bookUrl, book.value.sourceUrl, {
      name: book.value.name,
      author: book.value.author,
      coverUrl: book.value.coverUrl,
      intro: book.value.intro,
      originName: book.value.sourceName,
    })
    socialStats.value.favorited = true
    socialStats.value.favoriteCount += 1
    if (!silent) ElMessage.success('已添加到书架')
  } catch {
    await loadSocialStats()
    if (!silent) ElMessage.error('添加失败，可能已在书架中')
  } finally {
    adding.value = false
  }
}

async function removeFromShelf() {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  adding.value = true
  try {
    await bookStore.removeBook(book.value.bookUrl)
    socialStats.value.favorited = false
    socialStats.value.favoriteCount = Math.max(0, socialStats.value.favoriteCount - 1)
    ElMessage.success('已从书架移除')
  } catch {
    ElMessage.error('移除失败')
  } finally {
    adding.value = false
  }
}

async function toggleLike() {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  try {
    const result = unwrapResponse<{ liked: boolean }>(await bookApi.toggleLike(book.value.bookUrl))
    socialStats.value.liked = result.liked
    socialStats.value.likeCount += result.liked ? 1 : -1
    socialStats.value.likeCount = Math.max(0, socialStats.value.likeCount)
  } catch {
    ElMessage.error('操作失败')
  }
}

async function loadAuthorFollowStatus() {
  const author = book.value.author
  if (!author) return
  try {
    const data = unwrapResponse<{ followed: boolean; followerCount: number }>(
      await bookApi.getAuthorFollowStatus(author)
    )
    authorFollowed.value = data.followed
    authorFollowerCount.value = data.followerCount
  } catch { /* 静默 */ }
}

async function toggleFollowAuthor() {
  const author = book.value.author
  if (!author) return
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  followLoading.value = true
  try {
    const data = unwrapResponse<{ followed: boolean }>(await bookApi.toggleAuthorFollow(author))
    authorFollowed.value = data.followed
    if (data.followed) {
      authorFollowerCount.value += 1
      ElMessage.success('关注成功')
    } else {
      authorFollowerCount.value = Math.max(0, authorFollowerCount.value - 1)
      ElMessage.success('已取消关注')
    }
  } catch {
    ElMessage.error('操作失败')
  } finally {
    followLoading.value = false
  }
}

async function submitComment() {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  const content = commentContent.value.trim()
  if (!content) {
    ElMessage.warning('请输入评论内容')
    return
  }
  commentSubmitting.value = true
  try {
    const item = unwrapResponse<BookComment>(await bookApi.addComment({ bookUrl: book.value.bookUrl, content }))
    comments.value.unshift(item)
    socialStats.value.commentCount += 1
    commentContent.value = ''
    ElMessage.success('评论成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '评论失败')
  } finally {
    commentSubmitting.value = false
  }
}

async function deleteComment(id: number) {
  try {
    await bookApi.deleteComment(id)
    comments.value = comments.value.filter(item => item.id !== id)
    socialStats.value.commentCount = Math.max(0, socialStats.value.commentCount - 1)
    ElMessage.success('评论已删除')
  } catch {
    ElMessage.error('删除失败')
  }
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime()) ? String(dateStr) : date.toLocaleString('zh-CN')
}

async function startReading() {
  reading.value = true
  try {
    bookStore.setCurrentBook(book.value as any)
    if (authStore.isLoggedIn && !socialStats.value.favorited) {
      await addToShelf(true)
    }
    router.push(`/read/${encodeURIComponent(book.value.bookUrl)}`)
  } finally {
    reading.value = false
  }
}

async function readChapter(index: number) {
  bookStore.setCurrentBook(book.value as any)
  if (authStore.isLoggedIn && !socialStats.value.favorited) {
    await addToShelf(true)
  }
  router.push({
    path: `/read/${encodeURIComponent(book.value.bookUrl)}`,
    query: { chapter: String(index || 0) },
  })
}

onMounted(loadBookDetail)
</script>

<style scoped lang="scss">
.book-detail-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  max-width: var(--app-content-width);
  margin: 0 auto;
}

.hero-card {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 250px;
  gap: 22px;
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: 14px;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.06);
}

.book-cover {
  width: 160px;
  height: 220px;
  border-radius: 4px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.cover-placeholder {
  width: 160px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #5eb8ff, #67c23a);
  color: #fff;
  font-size: 42px;
  font-weight: 700;
}

.book-info {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  h1 {
    margin: 4px 0 12px;
    font-size: 28px;
    color: var(--el-text-color-primary);
  }
  .author {
    color: var(--el-text-color-secondary);
  }
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 26px;
}

.stats {
  display: flex;
  gap: 18px;
  margin-bottom: 24px;
  color: var(--el-text-color-regular);
  b {
    font-size: 22px;
    color: var(--el-text-color-primary);
    margin-right: 4px;
  }
}

.actions {
  display: flex;
  gap: 16px;
  :deep(.el-button) {
    min-width: 132px;
  }
}

.author-card,
.rank-side,
.content-card {
  background: var(--el-bg-color);
  border-radius: 14px;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.06);
}

.author-card {
  padding: 20px;
}

.author-header,
.author-name,
.author-stats {
  display: flex;
  align-items: center;
}

.author-header {
  justify-content: space-between;
  margin-bottom: 22px;
}

.author-name {
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #fff3e8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c56a18;
  font-weight: 700;
}

.author-stats {
  justify-content: space-around;
  padding-top: 18px;
  span {
    text-align: center;
  }
  b,
  em {
    display: block;
    font-style: normal;
  }
  em {
    margin-top: 6px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.content-card {
  margin-top: 22px;
  padding: 4px 22px 22px;
}

.intro-text {
  line-height: 2;
  color: var(--el-text-color-regular);
  white-space: pre-line;
}

.latest-line {
  margin-top: 18px;
  color: var(--el-text-color-secondary);
}

.chapter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 18px;
}

.chapter-item {
  border: none;
  background: transparent;
  text-align: left;
  color: var(--el-text-color-regular);
  padding: 8px 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
  &:hover {
    color: var(--el-color-primary);
  }
}

.loading-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  padding: 24px 0;
}

.comment-editor {
  padding: 10px 0 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 18px;
}

.comment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.comment-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9a5a11;
  background: #fff3e8;
  font-weight: 700;
}

.comment-body {
  flex: 1;
  min-width: 0;

  p {
    margin: 8px 0 0;
    line-height: 1.8;
    white-space: pre-wrap;
    color: var(--el-text-color-primary);
  }
}

.comment-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;

  b {
    color: var(--el-text-color-primary);
  }
}

.rank-side {
  padding: 22px;
  align-self: start;
  h3 {
    margin: 0 0 16px;
  }
}

.rank-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.rank-no {
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  background: var(--el-color-warning);
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}

.rank-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    color: var(--el-color-primary);
  }
}

.rank-loading,
.rank-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 980px) {
  .book-detail-page {
    grid-template-columns: 1fr;
  }
  .hero-card {
    grid-template-columns: 130px 1fr;
  }
  .author-card,
  .rank-side {
    display: none;
  }
  .book-cover,
  .cover-placeholder {
    width: 120px;
    height: 168px;
  }
}

@media (max-width: 1024px) {
  .book-detail-page {
    width: 100vw;
    max-width: 100vw;
    margin-left: -12px;
    margin-right: 0;
    padding: 0;
    gap: 14px;
  }

  .detail-main,
  .content-card,
  .comment-body {
    min-width: 0;
  }

  .book-info {
    min-width: 0;
  }

  .hero-card {
    grid-template-columns: clamp(96px, 22vw, 132px) minmax(0, 1fr);
    gap: 16px;
    padding: 16px 12px;
    border-radius: 0;
  }

  .cover-wrap {
    display: flex;
    align-items: flex-start;
  }

  .book-cover,
  .cover-placeholder {
    width: clamp(96px, 22vw, 132px);
    height: clamp(134px, 31vw, 184px);
  }

  .title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;

    h1 {
      margin: 0 0 4px;
      font-size: clamp(20px, 4.4vw, 26px);
      line-height: 1.25;
      word-break: break-word;
    }
  }

  .tags {
    gap: 6px;
    margin-bottom: 14px;
  }

  .stats {
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-bottom: 16px;

    b {
      font-size: 18px;
    }
  }

  .actions {
    flex-wrap: wrap;
    gap: 10px;

    :deep(.el-button) {
      min-width: 116px;
      margin-left: 0;
    }
  }

  .content-card {
    margin-top: 12px;
    padding: 0 12px 16px;
    border-radius: 0;
  }

  .intro-text {
    line-height: 1.8;
    word-break: break-word;
  }

  .chapter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
  }

  .comment-actions,
  .comment-meta {
    flex-wrap: wrap;
  }

  .author-card,
  .rank-side {
    display: none;
  }
}

@media (max-width: 640px) {
  .hero-card {
    grid-template-columns: 1fr;
  }

  .cover-wrap {
    justify-content: center;
  }

  .book-cover,
  .cover-placeholder {
    width: clamp(108px, 34vw, 136px);
    height: clamp(151px, 48vw, 190px);
  }

  .book-info {
    text-align: left;
  }

  .actions {
    flex-direction: column;
  }

  .actions :deep(.el-button) {
    width: 100%;
    min-width: 0;
  }

  .chapter-grid {
    grid-template-columns: 1fr;
  }
  .stats {
    flex-wrap: wrap;
  }
}
</style>
