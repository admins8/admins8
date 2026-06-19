import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNextContentUrls } from './contentPagination';

test('正文下一页链接会转成绝对地址并去重', () => {
  const urls = normalizeNextContentUrls(['/p2.html', '/p2.html', 'https://a.test/p3.html'], 'https://a.test/book/p1.html');

  assert.deepEqual(urls, [
    'https://a.test/p2.html',
    'https://a.test/p3.html',
  ]);
});

test('正文下一页链接会过滤空值和当前页', () => {
  const urls = normalizeNextContentUrls(['', 'https://a.test/book/p1.html', './p2.html'], 'https://a.test/book/p1.html');

  assert.deepEqual(urls, ['https://a.test/book/p2.html']);
});
