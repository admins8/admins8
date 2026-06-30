const RELOAD_FLAG = 'legado-router-chunk-reload'

export interface ChunkReloadStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ChunkReloadLocation {
  reload(): void
}

export function isDynamicImportLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(message)
}

export function clearDynamicImportReloadFlag(storage: ChunkReloadStorage = window.sessionStorage): void {
  storage.removeItem(RELOAD_FLAG)
}

export function recoverFromDynamicImportLoadError(
  error: unknown,
  storage: ChunkReloadStorage = window.sessionStorage,
  locationRef: ChunkReloadLocation = window.location,
): boolean {
  if (!isDynamicImportLoadError(error)) return false
  if (storage.getItem(RELOAD_FLAG) === '1') return false
  storage.setItem(RELOAD_FLAG, '1')
  locationRef.reload()
  return true
}
