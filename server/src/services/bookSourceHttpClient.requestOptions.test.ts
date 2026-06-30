import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchRequestOptions,
  normalizeProxyUrl,
  parseProxyConfig,
  parseProxyList,
  parseUserAgentList,
  pickRandomProxy,
  pickRandomUserAgent,
  testSearchProxyConnection,
} from './bookSourceHttpClient'

test('parseUserAgentList parses newline UA list and ignores blank rows', () => {
  assert.deepEqual(parseUserAgentList('UA-A\n\n UA-B '), ['UA-A', 'UA-B'])
})

test('pickRandomUserAgent falls back to built-in UA list when custom list is empty', () => {
  const ua = pickRandomUserAgent([])

  assert.equal(typeof ua, 'string')
  assert.ok(ua.length > 20)
})

test('buildSearchRequestOptions keeps UA and proxy independent', () => {
  const options = buildSearchRequestOptions({
    searchRequestUserAgents: 'UA-A',
    searchRequestProxy: 'http://user:pass@127.0.0.1:7890',
  })

  assert.deepEqual(options.simulatedUserAgents, ['UA-A'])
  assert.equal(options.forceRandomUserAgent, true)
  assert.equal(options.proxy, 'http://user:pass@127.0.0.1:7890')
})

test('parseProxyList parses newline proxy pool and ignores blank rows', () => {
  assert.deepEqual(parseProxyList('http://127.0.0.1:7890\n\n socks5://127.0.0.1:1080 '), [
    'http://127.0.0.1:7890',
    'socks5://127.0.0.1:1080',
  ])
})

test('normalizeProxyUrl defaults bare host port to http and keeps socks5', () => {
  assert.equal(normalizeProxyUrl('127.0.0.1:7890'), 'http://127.0.0.1:7890')
  assert.equal(normalizeProxyUrl('socks5://user:pass@127.0.0.1:1080'), 'socks5://user:pass@127.0.0.1:1080')
})

test('pickRandomProxy chooses one normalized proxy from pool', () => {
  const proxy = pickRandomProxy(['127.0.0.1:7890'])

  assert.equal(proxy, 'http://127.0.0.1:7890')
})

test('parseProxyConfig supports authenticated http proxy', () => {
  const proxy = parseProxyConfig('http://user:pass@127.0.0.1:7890')

  assert.deepEqual(proxy, {
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890,
    auth: {
      username: 'user',
      password: 'pass',
    },
  })
})

test('parseProxyConfig leaves socks5 to agent handling', () => {
  assert.equal(parseProxyConfig('socks5://127.0.0.1:1080'), undefined)
})

test('testSearchProxyConnection rejects empty proxy before network request', async () => {
  const result = await testSearchProxyConnection({ proxy: '', userAgents: '' })

  assert.equal(result.ok, false)
  assert.equal(result.error, '请先填写代理地址')
})

test('testSearchProxyConnection source includes fallback test endpoints', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve('src/services/bookSourceHttpClient.ts'), 'utf-8')

  assert.match(source, /http:\/\/httpbin\.org\/anything/)
  assert.match(source, /http:\/\/httpbingo\.org\/anything/)
  assert.match(source, /http:\/\/postman-echo\.com\/get/)
})

test('httpRequest supports per-request timeoutMs option', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve('src/services/bookSourceHttpClient.ts'), 'utf-8')

  assert.match(source, /timeoutMs\?: number/)
  assert.match(source, /timeout:\s*option\.timeoutMs\s*\|\|\s*10000/)
})

test('httpRequest supports retry zero to avoid gateway timeout on blackholed targets', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve('src/services/bookSourceHttpClient.ts'), 'utf-8')

  assert.match(source, /option\.retry\s*===\s*0/)
  assert.match(source, /profiles\.slice\(0,\s*1\)/)
})
