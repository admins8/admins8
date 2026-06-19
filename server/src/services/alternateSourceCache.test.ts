import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAlternateSourceCacheKey, getAlternateSourceCache, setAlternateSourceCache } from './alternateSourceCache'

test('buildAlternateSourceCacheKey is stable for same book context', () => {
  const first = buildAlternateSourceCacheKey({
    bookUrl: 'https://book.example/a',
    name: '仙工开物',
    author: '蛊真人',
    sourceUrl: 'https://source.example',
    chapterIndex: 3,
  })
  const second = buildAlternateSourceCacheKey({
    bookUrl: 'https://book.example/a',
    name: '仙工开物',
    author: '蛊真人',
    sourceUrl: 'https://source.example',
    chapterIndex: 3,
  })

  assert.equal(first, second)
  assert.match(first, /^legado:alternate-sources:/)
})

test('alternate source cache writes and reads JSON with ttl', async () => {
  let savedKey = ''
  let savedValue = ''
  let savedTtl = 0
  const redis: any = {
    async setEx(key: string, ttl: number, value: string) {
      savedKey = key
      savedTtl = ttl
      savedValue = value
    },
    async get(key: string) {
      assert.equal(key, savedKey)
      return savedValue
    },
  }

  const key = buildAlternateSourceCacheKey({ bookUrl: 'book', name: '书', author: '作者' })
  await setAlternateSourceCache(key, [{ bookUrl: 'book2' }], 3600, async () => redis)
  const cached = await getAlternateSourceCache(key, async () => redis)

  assert.equal(savedTtl, 3600)
  assert.deepEqual(cached, [{ bookUrl: 'book2' }])
})
