import { ref } from 'vue'
import { configApi } from '@/api'
import { configsToMap } from '@/utils/siteConfig'
import { setDefaultBookCoverUrl } from '@/utils/bookCover'

/** 全局站点配置（轻量单例，供各页面共享） */
export const siteConfigState = {
  siteTitle: ref('搜书网'),
  siteSubtitle: ref(''),
  siteLogo: ref(''),
  defaultBookCover: ref(''),
  webDomain: ref(''),
  wapDomain: ref(''),
  icpNumber: ref(''),
  homeTitle: ref(''),
  homeKeywords: ref(''),
  homeDescription: ref(''),
  copyright: ref(''),
  analyticsCode: ref(''),
  loaded: ref(false),
}

let loadingPromise: Promise<void> | null = null

/** 从后端加载公开配置，同步给 bookCover.ts 的默认封面与各页面使用 */
export async function loadSiteConfig(force = false): Promise<void> {
  if (siteConfigState.loaded.value && !force) return
  // 如果已有正在进行的请求，复用该 Promise，避免并发重复请求
  if (loadingPromise && !force) {
    return loadingPromise
  }
  loadingPromise = (async () => {
    try {
      const res: any = await configApi.getPublicConfigs()
      const data = Array.isArray(res) ? res : (res.data || [])
      const cfgMap = configsToMap(data)

      siteConfigState.siteTitle.value = cfgMap.site_title || '搜书网'
      siteConfigState.siteSubtitle.value = cfgMap.site_subtitle || ''
      siteConfigState.siteLogo.value = cfgMap.site_logo || ''
      siteConfigState.defaultBookCover.value = cfgMap.default_book_cover || ''
      siteConfigState.webDomain.value = cfgMap.web_domain || ''
      siteConfigState.wapDomain.value = cfgMap.wap_domain || ''
      siteConfigState.icpNumber.value = cfgMap.icp_number || ''
      siteConfigState.homeTitle.value = cfgMap.home_title || ''
      siteConfigState.homeKeywords.value = cfgMap.home_keywords || ''
      siteConfigState.homeDescription.value = cfgMap.home_description || ''
      siteConfigState.copyright.value = cfgMap.copyright || ''
      siteConfigState.analyticsCode.value = cfgMap.analytics_code || ''

      // 同步到封面生成工具
      setDefaultBookCoverUrl(siteConfigState.defaultBookCover.value)

      siteConfigState.loaded.value = true
    } catch (e) {
      console.warn('[siteConfig] 加载站点配置失败：', e)
    } finally {
      loadingPromise = null
    }
  })()
  return loadingPromise
}

/** 强制刷新（后台修改后调用） */
export async function refreshSiteConfig() {
  return loadSiteConfig(true)
}

/** 返回站点标题（响应式） */
export function useSiteTitle() {
  return siteConfigState.siteTitle
}

/** 返回默认书籍封面 URL（响应式） */
export function useDefaultBookCover() {
  return siteConfigState.defaultBookCover
}
