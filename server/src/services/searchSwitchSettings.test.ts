import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSearchSwitchSettings } from './searchSwitchSettings'

test('normalizeSearchSwitchSettings returns requested performance defaults', () => {
  const settings = normalizeSearchSwitchSettings({})

  assert.equal(settings.searchVerifyToc, false)
  assert.equal(settings.searchSourceConcurrency, 50)
  assert.equal(settings.searchSourceTimeoutMs, 5000)
  assert.equal(settings.searchTocTimeoutMs, 3000)
  assert.equal(settings.sourceSwitchConcurrency, 50)
  assert.equal(settings.sourceSwitchTimeoutMs, 5000)
  assert.equal(settings.sourceSwitchTocTimeoutMs, 3000)
  assert.equal(settings.alternateSourceCacheTtlSeconds, 3600)
  assert.equal(settings.searchRequestUserAgents, '')
  assert.equal(settings.searchRequestProxy, '')
})

test('normalizeSearchSwitchSettings clamps unsafe numeric values', () => {
  const settings = normalizeSearchSwitchSettings({
    search_source_concurrency: '999',
    search_source_timeout_ms: '100',
    alternate_source_cache_ttl_seconds: '-1',
  })

  assert.equal(settings.searchSourceConcurrency, 50)
  assert.equal(settings.searchSourceTimeoutMs, 1000)
  assert.equal(settings.alternateSourceCacheTtlSeconds, 0)
})

test('normalizeSearchSwitchSettings keeps simulated UA and search proxy text', () => {
  const settings = normalizeSearchSwitchSettings({
    search_request_user_agents: 'UA-A\nUA-B',
    search_request_proxy: 'http://127.0.0.1:7890',
  })

  assert.equal(settings.searchRequestUserAgents, 'UA-A\nUA-B')
  assert.equal(settings.searchRequestProxy, 'http://127.0.0.1:7890')
})
