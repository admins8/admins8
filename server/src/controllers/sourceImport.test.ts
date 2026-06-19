import test from 'node:test'
import assert from 'node:assert/strict'
import { detectSourceCollectionUrlType, normalizeImportPayload } from './sourceController'

test('normalizeImportPayload accepts an array of sources', () => {
  const payload = [{ bookSourceUrl: 'https://a.example', bookSourceName: 'A' }]
  assert.deepEqual(normalizeImportPayload(payload), payload)
})

test('normalizeImportPayload accepts a single source object', () => {
  const payload = { bookSourceUrl: 'https://a.example', bookSourceName: 'A' }
  assert.deepEqual(normalizeImportPayload(payload), [payload])
})

test('normalizeImportPayload accepts JSON string arrays', () => {
  const payload = '[{"bookSourceUrl":"https://a.example","bookSourceName":"A"}]'
  assert.deepEqual(normalizeImportPayload(payload), [
    { bookSourceUrl: 'https://a.example', bookSourceName: 'A' },
  ])
})

test('normalizeImportPayload rejects invalid JSON strings', () => {
  assert.throws(
    () => normalizeImportPayload('{bad json'),
    /书源导入内容不是有效 JSON/
  )
})

test('normalizeImportPayload rejects unsupported payloads', () => {
  assert.throws(
    () => normalizeImportPayload(123),
    /书源导入内容必须是对象、数组或 JSON 字符串/
  )
})

test('detectSourceCollectionUrlType identifies yck book source collection urls', () => {
  assert.equal(
    detectSourceCollectionUrlType('https://www.yck2026.top/yuedu/shuyuans/json/id/1158.json'),
    'bookSourceCollection'
  )
})

test('detectSourceCollectionUrlType identifies yck single book source urls', () => {
  assert.equal(
    detectSourceCollectionUrlType('https://www.yck2026.top/yuedu/shuyuan/json/id/7249.json'),
    'bookSource'
  )
})

test('detectSourceCollectionUrlType identifies yck rss source collection urls', () => {
  assert.equal(
    detectSourceCollectionUrlType('https://www.yck2026.top/yuedu/rsss/json/id/195.json'),
    'rssSourceCollection'
  )
})

test('detectSourceCollectionUrlType rejects legado aoaostar advanced source collections', () => {
  assert.equal(
    detectSourceCollectionUrlType('https://legado.aoaostar.com/sources/71e56d4f.json'),
    'unsupportedAdvancedLegadoCollection'
  )
})
