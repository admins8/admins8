export interface SimpleStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}

export interface CacheStorageLike {
  keys(): Promise<string[]>
  delete(key: string): Promise<boolean>
}

export interface LocationLike {
  href: string
  assign(url: string): void
}

export interface ClearAdminRuntimeCacheEnv {
  localStorage: SimpleStorageLike
  sessionStorage: SimpleStorageLike
  caches?: CacheStorageLike
  location: LocationLike
  now: () => number
}

export interface ClearAdminRuntimeCacheResult {
  deletedCacheCount: number
  refreshUrl: string
}

export function buildCacheRefreshUrl(href: string, timestamp: number): string {
  const url = new URL(href)
  url.searchParams.delete('__cache_clear')
  url.searchParams.append('__cache_clear', String(timestamp))
  return url.toString()
}

export async function clearAdminRuntimeCache(env?: Partial<ClearAdminRuntimeCacheEnv>): Promise<ClearAdminRuntimeCacheResult> {
  const runtimeEnv: ClearAdminRuntimeCacheEnv = {
    localStorage: env?.localStorage || window.localStorage,
    sessionStorage: env?.sessionStorage || window.sessionStorage,
    caches: env?.caches || (typeof window !== 'undefined' ? window.caches : undefined),
    location: env?.location || window.location,
    now: env?.now || (() => Date.now()),
  }

  runtimeEnv.sessionStorage.clear()

  let deletedCacheCount = 0
  if (runtimeEnv.caches) {
    const keys = await runtimeEnv.caches.keys()
    await Promise.all(keys.map(async (key) => {
      const deleted = await runtimeEnv.caches!.delete(key)
      if (deleted) deletedCacheCount += 1
    }))
  }

  const refreshUrl = buildCacheRefreshUrl(runtimeEnv.location.href, runtimeEnv.now())
  runtimeEnv.location.assign(refreshUrl)
  return { deletedCacheCount, refreshUrl }
}
