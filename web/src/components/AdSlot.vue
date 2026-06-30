<template>
  <div v-if="ads.length > 0" class="ad-slot" :class="`ad-slot-${position}`">
    <template v-for="ad in ads" :key="ad.id">
      <!-- 图片广告 -->
      <a
        v-if="ad.ad_type === 'image' && ad.image_url"
        class="ad-item ad-item-image"
        :href="ad.link_url || 'javascript:void(0)'"
        :target="ad.link_url ? ad.target : undefined"
        :rel="ad.target === '_blank' ? 'noopener noreferrer' : undefined"
        :title="ad.title"
      >
        <img :src="ad.image_url" :alt="ad.title" loading="lazy" />
      </a>

      <!-- 文字广告 -->
      <a
        v-else-if="ad.ad_type === 'text' && ad.content"
        class="ad-item ad-item-text"
        :href="ad.link_url || 'javascript:void(0)'"
        :target="ad.link_url ? ad.target : undefined"
        :rel="ad.target === '_blank' ? 'noopener noreferrer' : undefined"
        :title="ad.title"
      >
        <span class="ad-tag">广告</span>
        <span class="ad-text">{{ ad.content }}</span>
      </a>

      <!-- HTML/代码广告 -->
      <div
        v-else-if="ad.ad_type === 'html' && ad.content"
        class="ad-item ad-item-html"
        v-html="ad.content"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { adApi, type Advertisement } from '@/api'

const props = defineProps<{
  position: string
}>()

const ads = ref<Advertisement[]>([])

async function load() {
  if (!props.position) return
  try {
    const res: any = await adApi.getAdsByPosition(props.position)
    const list: Advertisement[] = (res?.data ?? res) || []
    ads.value = list
  } catch {
    ads.value = []
  }
}

onMounted(load)
watch(() => props.position, load)
</script>

<style scoped lang="scss">
.ad-slot {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0;

  .ad-item {
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
  }

  .ad-item-image {
    img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 8px;
    }
  }

  .ad-item-text {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 175, 64, 0.08);
    border: 1px dashed rgba(255, 140, 0, 0.4);
    border-radius: 8px;
    font-size: 14px;

    .ad-tag {
      flex-shrink: 0;
      padding: 1px 6px;
      font-size: 11px;
      background: #ff8c00;
      color: #fff;
      border-radius: 3px;
    }

    .ad-text {
      flex: 1;
      line-height: 1.5;
    }
  }

  .ad-item-html {
    width: 100%;
    overflow: hidden;
  }
}
</style>
