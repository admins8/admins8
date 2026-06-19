import { config } from '../config';
import { closeSharedRedisClient, getSharedRedisClient } from './redisClient';

export interface SearchCacheOptions {
  enabled: boolean;
  ttlSeconds: number;
}

export interface SearchCacheClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
}

export function normalizeSearchKeyword(keyword: string): string {
  return String(keyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildSearchCacheKey(keyword: string): string {
  return `legado:search:v2:${normalizeSearchKeyword(keyword)}`;
}

export class SearchCache {
  constructor(
    private readonly client: SearchCacheClient | null,
    private readonly options: SearchCacheOptions
  ) {}

  async get<T = any[]>(keyword: string): Promise<T | null> {
    if (!this.options.enabled || !this.client) return null;
    const normalized = normalizeSearchKeyword(keyword);
    if (!normalized) return null;

    try {
      const raw = await this.client.get(buildSearchCacheKey(normalized));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      console.warn('[Redis] 读取搜索缓存失败:', err?.message || err);
      return null;
    }
  }

  async set(keyword: string, results: any[]): Promise<void> {
    if (!this.options.enabled || !this.client) return;
    const normalized = normalizeSearchKeyword(keyword);
    if (!normalized) return;

    try {
      await this.client.setEx(
        buildSearchCacheKey(normalized),
        this.options.ttlSeconds,
        JSON.stringify(results || [])
      );
    } catch (err: any) {
      console.warn('[Redis] 写入搜索缓存失败:', err?.message || err);
    }
  }
}

async function getRedisClient(): Promise<SearchCacheClient | null> {
  return getSharedRedisClient();
}

export async function getSearchCache(): Promise<SearchCache> {
  const client = await getRedisClient();
  return new SearchCache(client, {
    enabled: config.redis.enabled,
    ttlSeconds: config.redis.searchTtlSeconds,
  });
}

export async function closeRedis(): Promise<void> {
  await closeSharedRedisClient();
}
