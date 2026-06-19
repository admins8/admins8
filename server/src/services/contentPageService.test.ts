import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeContentPagePayload, STATIC_PAGE_DEFAULTS } from './contentPageService'

test('STATIC_PAGE_DEFAULTS contains required legal and contact pages', () => {
  assert.deepEqual(
    STATIC_PAGE_DEFAULTS.map(page => page.slug),
    ['about', 'contact', 'agreement', 'privacy']
  )
})

test('normalizeContentPagePayload trims title and keeps rich content', () => {
  const payload = normalizeContentPagePayload({
    title: ' 关于我们 ',
    content: '<p>平台介绍</p>',
    is_active: 1,
    seo_title: ' 关于我们 SEO ',
  })

  assert.equal(payload.title, '关于我们')
  assert.equal(payload.content, '<p>平台介绍</p>')
  assert.equal(payload.is_active, 1)
  assert.equal(payload.seo_title, '关于我们 SEO')
})
