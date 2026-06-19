import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRuntimeChapterContentCache,
  getPrefetchChapterIndexes,
  getRuntimeChapterContent,
  setRuntimeChapterContent,
} from './chapterRuntimeCache';

test('阅读第十章时预取后 5 章索引', () => {
  assert.deepEqual(getPrefetchChapterIndexes(10), [11, 12, 13, 14, 15]);
});

test('运行时正文缓存命中后返回，过期后不返回', () => {
  clearRuntimeChapterContentCache();
  setRuntimeChapterContent('book-a', 11, '第十一章正文', 1000, 1000);

  assert.equal(getRuntimeChapterContent('book-a', 11, 1500), '第十一章正文');
  assert.equal(getRuntimeChapterContent('book-a', 11, 2500), null);
});
