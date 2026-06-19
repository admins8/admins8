import test from 'node:test'
import assert from 'node:assert/strict'
import { filterVisibleFriendlyLinks, normalizeFriendlyLinkPayload } from './friendlyLinkService'

test('filterVisibleFriendlyLinks respects global switch, active flag and time range', () => {
  const now = new Date('2026-06-13T12:00:00Z')
  const links = filterVisibleFriendlyLinks([
    { id: 1, name: '可见', url: 'https://a.example', is_active: 1, start_at: null, end_at: null, sort_order: 1 },
    { id: 2, name: '关闭', url: 'https://b.example', is_active: 0, start_at: null, end_at: null, sort_order: 2 },
    { id: 3, name: '未开始', url: 'https://c.example', is_active: 1, start_at: '2026-06-14T00:00:00Z', end_at: null, sort_order: 3 },
    { id: 4, name: '已结束', url: 'https://d.example', is_active: 1, start_at: null, end_at: '2026-06-12T00:00:00Z', sort_order: 4 },
  ], true, now)

  assert.deepEqual(links.map(link => link.name), ['可见'])
  assert.deepEqual(filterVisibleFriendlyLinks(links, false, now), [])
})

test('normalizeFriendlyLinkPayload normalizes switch and empty time fields', () => {
  const payload = normalizeFriendlyLinkPayload({
    name: ' 搜猫 ',
    url: ' https://soumal.example ',
    description: ' 小说站 ',
    is_active: true,
    sort_order: '3',
    start_at: '',
    end_at: '',
  })

  assert.equal(payload.name, '搜猫')
  assert.equal(payload.url, 'https://soumal.example')
  assert.equal(payload.description, '小说站')
  assert.equal(payload.is_active, 1)
  assert.equal(payload.sort_order, 3)
  assert.equal(payload.start_at, null)
  assert.equal(payload.end_at, null)
})
