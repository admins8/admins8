<template>
  <el-dialog
    v-model="visible"
    class="reader-popup-ad-dialog"
    width="420px"
    append-to-body
    :show-close="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    @closed="handleClosed"
  >
    <template #header>
      <div class="popup-header">
        <span>{{ currentAd?.title || '广告' }}</span>
        <span v-if="remainingSeconds > 0" class="auto-close-tip">
          {{ remainingSeconds }} 秒后关闭
        </span>
      </div>
    </template>

    <div v-if="currentAd" class="reader-popup-ad" @click.stop>
      <a
        v-if="currentAd.ad_type === 'image' && currentAd.image_url"
        class="popup-image-link"
        :href="currentAd.link_url || 'javascript:void(0)'"
        :target="currentAd.link_url ? currentAd.target : undefined"
        :rel="currentAd.target === '_blank' ? 'noopener noreferrer' : undefined"
      >
        <img :src="currentAd.image_url" :alt="currentAd.title || '广告'" />
      </a>

      <a
        v-else-if="currentAd.ad_type === 'text' && currentAd.content"
        class="popup-text-link"
        :href="currentAd.link_url || 'javascript:void(0)'"
        :target="currentAd.link_url ? currentAd.target : undefined"
        :rel="currentAd.target === '_blank' ? 'noopener noreferrer' : undefined"
      >
        {{ currentAd.content }}
      </a>

      <div
        v-else-if="currentAd.ad_type === 'html' && currentAd.content"
        class="popup-html"
        v-html="currentAd.content"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { adApi, type Advertisement } from '@/api'

const STORAGE_PREFIX = 'reader-popup-ad-last-closed-'
const DEFAULT_INTERVAL_SECONDS = 3600
const DEFAULT_AUTO_CLOSE_SECONDS = 10

const ads = ref<Advertisement[]>([])
const visible = ref(false)
const currentIndex = ref(0)
const remainingSeconds = ref(0)

let showTimer: number | undefined
let closeTimer: number | undefined
let countdownTimer: number | undefined

const currentAd = computed(() => ads.value[currentIndex.value] || null)

function normalizeSeconds(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.floor(parsed)
}

function getStorageKey(ad: Advertisement): string {
  return `${STORAGE_PREFIX}${ad.id}`
}

function clearTimers() {
  if (showTimer) window.clearTimeout(showTimer)
  if (closeTimer) window.clearTimeout(closeTimer)
  if (countdownTimer) window.clearInterval(countdownTimer)
  showTimer = undefined
  closeTimer = undefined
  countdownTimer = undefined
}

function scheduleNextPopup() {
  clearTimers()
  const ad = currentAd.value
  if (!ad) return

  const intervalSeconds = normalizeSeconds(ad.popup_interval_seconds, DEFAULT_INTERVAL_SECONDS)
  const lastClosedAt = Number(localStorage.getItem(getStorageKey(ad)) || 0)
  const now = Date.now()
  const nextShowAt = lastClosedAt > 0 ? lastClosedAt + intervalSeconds * 1000 : now
  const waitMs = Math.max(0, nextShowAt - now)

  showTimer = window.setTimeout(() => {
    showPopup()
  }, waitMs)
}

function showPopup() {
  const ad = currentAd.value
  if (!ad) return

  visible.value = true
  const autoCloseSeconds = normalizeSeconds(ad.popup_auto_close_seconds, DEFAULT_AUTO_CLOSE_SECONDS)
  remainingSeconds.value = autoCloseSeconds

  if (autoCloseSeconds > 0) {
    countdownTimer = window.setInterval(() => {
      remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
    }, 1000)
    closeTimer = window.setTimeout(() => {
      visible.value = false
    }, autoCloseSeconds * 1000)
  }
}

function handleClosed() {
  const ad = currentAd.value
  if (!ad) return

  localStorage.setItem(getStorageKey(ad), String(Date.now()))
  currentIndex.value = (currentIndex.value + 1) % ads.value.length
  scheduleNextPopup()
}

async function loadPopupAds() {
  try {
    const res: any = await adApi.getAdsByPosition('reader_popup')
    const list: Advertisement[] = (res?.data ?? res) || []
    ads.value = list
    if (ads.value.length > 0) {
      currentIndex.value = 0
      scheduleNextPopup()
    }
  } catch {
    ads.value = []
  }
}

onMounted(() => {
  loadPopupAds()
})

onUnmounted(() => {
  clearTimers()
})
</script>

<style scoped lang="scss">
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 28px;
  font-weight: 600;

  .auto-close-tip {
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
}

.reader-popup-ad {
  text-align: center;

  .popup-image-link {
    display: block;
    line-height: 0;

    img {
      max-width: 100%;
      max-height: 70vh;
      border-radius: 8px;
      object-fit: contain;
    }
  }

  .popup-text-link {
    display: block;
    padding: 18px;
    line-height: 1.8;
    color: var(--el-text-color-primary);
    text-decoration: none;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .popup-html {
    max-width: 100%;
    overflow: hidden;
  }
}

@media (max-width: 768px) {
  :global(.reader-popup-ad-dialog) {
    width: calc(100vw - 32px) !important;
  }
}
</style>
