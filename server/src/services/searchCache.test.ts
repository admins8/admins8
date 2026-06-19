import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SearchCache,
  buildSearchCacheKey,
  normalizeSearchKeyword,
} from './searchCache';

class FakeRedis {
  store = new Map<string, string>();
  ttl = new Map<string, number>();
  getCalls = 0;
  setCalls = 0;
  failGet = false;
  failSet = false;

  async get(key: string) {
    this.getCalls++;
    if (this.failGet) throw new Error('redis get failed');
    return this.store.get(key) ?? null;
  }

  async setEx(key: string, seconds: number, value: string) {
    this.setCalls++;
    if (this.failSet) throw new Error('redis set failed');
    this.store.set(key, value);
    this.ttl.set(key, seconds);
    return 'OK';
  }
}

test('normalizeSearchKeyword trims and lowercases whitespace variants', () => {
  assert.equal(normalizeSearchKeyword('  诡秘  之主  '), '诡秘 之主');
  assert.equal(normalizeSearchKeyword(' My Book '), 'my book');
});

test('buildSearchCacheKey uses normalized keyword and version prefix', () => {
  assert.equal(buildSearchCacheKey('  诡秘  之主  '), 'legado:search:v2:诡秘 之主');
});

test('SearchCache stores and reads JSON results with ttl', async () => {
  const redis = new FakeRedis();
  const cache = new SearchCache(redis, { enabled: true, ttlSeconds: 600 });
  const results = [{ name: '诡秘之主', bookUrl: 'https://example.com/book/1' }];

  await cache.set('诡秘之主', results);
  const cached = await cache.get('  诡秘之主  ');

  assert.deepEqual(cached, results);
  assert.equal(redis.ttl.get('legado:search:v2:诡秘之主'), 600);
});

test('SearchCache returns null when disabled', async () => {
  const redis = new FakeRedis();
  const cache = new SearchCache(redis, { enabled: false, ttlSeconds: 600 });

  await cache.set('诡秘之主', [{ name: '不会写入' }]);
  const cached = await cache.get('诡秘之主');

  assert.equal(cached, null);
  assert.equal(redis.getCalls, 0);
  assert.equal(redis.setCalls, 0);
});

test('SearchCache gracefully ignores Redis errors', async () => {
  const redis = new FakeRedis();
  redis.failGet = true;
  redis.failSet = true;
  const cache = new SearchCache(redis, { enabled: true, ttlSeconds: 600 });

  await cache.set('诡秘之主', [{ name: '不会抛错' }]);
  const cached = await cache.get('诡秘之主');

  assert.equal(cached, null);
});
