import test from 'node:test';
import assert from 'node:assert/strict';
import { isKnownUnreadableSearchCandidate } from './searchController';

test('搜索结果过滤 QQ 阅读私有接口，避免展示必然无法加载目录的结果', () => {
  assert.equal(isKnownUnreadableSearchCandidate({
    book_source_name: 'QQ阅读',
    book_source_url: 'https://detailadr.reader.qq.com',
  }, {
    bookUrl: 'https://detailadr.reader.qq.com/v7_8_7/nativepage/book/detail?bid=26530091',
  }), true);

  assert.equal(isKnownUnreadableSearchCandidate({
    book_source_name: '小说-松鹤阅读',
    book_source_url: 'https://novel.html5.qq.com',
  }, {
    bookUrl: 'https://novel.html5.qq.com/qbread/api/novel/bookInfo?resourceId=26530091',
  }), true);

  assert.equal(isKnownUnreadableSearchCandidate({
    book_source_name: '普通笔趣阁',
    book_source_url: 'https://www.biquge55.net',
  }, {
    bookUrl: 'https://www.biquge55.net/book/info4715/',
  }), false);
});
