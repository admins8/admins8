import test from 'node:test'
import assert from 'node:assert/strict'
import { sortSourcesByHealth } from './sourceHealth'

test('sortSourcesByHealth puts sources with many failures behind healthy sources', async () => {
  const redis: any = {
    async hGetAll(key: string) {
      if (key.includes('slow.example')) {
        return { failureCount: '10', successCount: '1', totalTimeMs: '8000', lastFailureAt: String(Date.now()) }
      }
      if (key.includes('fast.example')) {
        return { failureCount: '0', successCount: '10', totalTimeMs: '1000', lastFailureAt: '0' }
      }
      return {}
    },
  }

  const sorted = await sortSourcesByHealth([
    { book_source_url: 'https://slow.example', weight: 100, custom_order: 0 },
    { book_source_url: 'https://fast.example', weight: 100, custom_order: 1 },
  ], async () => redis)

  assert.equal(sorted[0].book_source_url, 'https://fast.example')
  assert.equal(sorted[1].book_source_url, 'https://slow.example')
})

test('sortSourcesByHealth prioritizes validated successful sources over failed sources', async () => {
  const sorted = await sortSourcesByHealth([
    { book_source_url: 'https://failed.example', weight: 100, custom_order: 0, last_check_status: 2 },
    { book_source_url: 'https://ok.example', weight: 1, custom_order: 0, last_check_status: 1 },
    { book_source_url: 'https://unknown.example', weight: 50, custom_order: 0, last_check_status: 0 },
  ], async () => null)

  assert.equal(sorted[0].book_source_url, 'https://ok.example')
  assert.equal(sorted[2].book_source_url, 'https://failed.example')
})
