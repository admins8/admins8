import { getAllSiteConfigs } from '../repositories/siteConfigRepository'

export interface SearchSwitchSettings {
  searchVerifyToc: boolean
  searchSourceConcurrency: number
  searchSourceTimeoutMs: number
  searchTocTimeoutMs: number
  sourceSwitchConcurrency: number
  sourceSwitchTimeoutMs: number
  sourceSwitchTocTimeoutMs: number
  alternateSourceCacheTtlSeconds: number
  searchRequestUserAgents: string
  searchRequestProxy: string
}

export const SEARCH_SWITCH_DEFAULTS: SearchSwitchSettings = {
  searchVerifyToc: false,
  searchSourceConcurrency: 50,
  searchSourceTimeoutMs: 15000,
  searchTocTimeoutMs: 10000,
  sourceSwitchConcurrency: 50,
  sourceSwitchTimeoutMs: 8000,
  sourceSwitchTocTimeoutMs: 10000,
  alternateSourceCacheTtlSeconds: 3600,
  searchRequestUserAgents: '',
  searchRequestProxy: '',
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function normalizeSearchSwitchSettings(configMap: Record<string, unknown>): SearchSwitchSettings {
  return {
    searchVerifyToc: toBool(configMap.search_verify_toc, SEARCH_SWITCH_DEFAULTS.searchVerifyToc),
    searchSourceConcurrency: toInt(configMap.search_source_concurrency, SEARCH_SWITCH_DEFAULTS.searchSourceConcurrency, 1, 50),
    searchSourceTimeoutMs: toInt(configMap.search_source_timeout_ms, SEARCH_SWITCH_DEFAULTS.searchSourceTimeoutMs, 1000, 30000),
    searchTocTimeoutMs: toInt(configMap.search_toc_timeout_ms, SEARCH_SWITCH_DEFAULTS.searchTocTimeoutMs, 1000, 30000),
    sourceSwitchConcurrency: toInt(configMap.source_switch_concurrency, SEARCH_SWITCH_DEFAULTS.sourceSwitchConcurrency, 1, 80),
    sourceSwitchTimeoutMs: toInt(configMap.source_switch_timeout_ms, SEARCH_SWITCH_DEFAULTS.sourceSwitchTimeoutMs, 1000, 30000),
    sourceSwitchTocTimeoutMs: toInt(configMap.source_switch_toc_timeout_ms, SEARCH_SWITCH_DEFAULTS.sourceSwitchTocTimeoutMs, 1000, 30000),
    alternateSourceCacheTtlSeconds: toInt(configMap.alternate_source_cache_ttl_seconds, SEARCH_SWITCH_DEFAULTS.alternateSourceCacheTtlSeconds, 0, 86400),
    searchRequestUserAgents: String(configMap.search_request_user_agents ?? SEARCH_SWITCH_DEFAULTS.searchRequestUserAgents).trim(),
    searchRequestProxy: String(configMap.search_request_proxy ?? SEARCH_SWITCH_DEFAULTS.searchRequestProxy).trim(),
  }
}

export async function getSearchSwitchSettings(): Promise<SearchSwitchSettings> {
  const configs = await getAllSiteConfigs()
  const map: Record<string, string> = {}
  for (const item of configs) {
    map[item.config_key] = item.config_value
  }
  return normalizeSearchSwitchSettings(map)
}
