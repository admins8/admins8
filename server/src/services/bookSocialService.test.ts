import test from 'node:test'
import assert from 'node:assert/strict'
import { getBookLikeTargetId, normalizeCommentContent, normalizeSocialBookInput } from './bookSocialService'

test('getBookLikeTargetId creates stable short ids for long book urls', () => {
  const url = 'https://example.com/book/' + 'a'.repeat(300)
  const first = getBookLikeTargetId(url)
  const second = getBookLikeTargetId(url)

  assert.equal(first, second)
  assert.equal(first.length, 40)
})

test('normalizeCommentContent trims content and rejects empty comments', () => {
  assert.equal(normalizeCommentContent('  很好看  '), '很好看')
  assert.throws(() => normalizeCommentContent('   '), /评论内容不能为空/)
})

test('normalizeSocialBookInput requires bookUrl and keeps name author', () => {
  const input = normalizeSocialBookInput({
    bookUrl: ' book://1 ',
    name: ' 小说 ',
    author: ' 作者 ',
  })

  assert.deepEqual(input, {
    bookUrl: 'book://1',
    name: '小说',
    author: '作者',
  })
  assert.throws(() => normalizeSocialBookInput({}), /缺少书籍地址/)
})
