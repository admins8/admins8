import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalBookResult, isSameLocalBook } from './localBookPriority';

test('本地书籍搜索结果标记为本地书库并可排在网络书源前', () => {
  const result = buildLocalBookResult({
    bookUrl: 'local://book/1',
    name: '测试小说',
    author: '张三',
    sourceName: '',
    sourceUrl: 'https://example.com',
    coverUrl: 'cover.jpg',
    intro: '简介',
    kind: '玄幻',
    latestChapterTitle: '第20章',
    wordCount: '10万字',
    type: 0,
  }, {
    matchLevel: 'exact',
    matchLabel: '本地匹配',
    matchScore: 100,
  });

  assert.equal(result.sourceName, '本地书库');
  assert.equal(result._local, true);
  assert.equal(result._readable, true);
  assert.equal(result._tocVerified, true);
  assert.equal(result.sources[0].sourceName, '本地书库');
});

test('同名同作者视为同一本本地书', () => {
  assert.equal(isSameLocalBook({ name: ' 测试 小说 ', author: '张三' }, { name: '测试小说', author: '张三' }), true);
  assert.equal(isSameLocalBook({ name: '测试小说', author: '李四' }, { name: '测试小说', author: '张三' }), false);
});
