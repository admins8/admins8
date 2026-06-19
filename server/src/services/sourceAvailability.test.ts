import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAvailableChapters, isUsableChapter } from './sourceAvailability';

test('目录返回至少 10 个有效章节时视为可显示', async () => {
  const engine = {
    async getChapterList() {
      return Array.from({ length: 10 }, (_, index) => ({
        index,
        title: `第${index + 1}章`,
        url: `https://example.com/${index + 1}`,
      }));
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, true);
});

test('目录不足 10 章时跳过该书源（2 章不展示）', async () => {
  const engine = {
    async getChapterList() {
      return [
        { index: 0, title: '第一章', url: 'https://example.com/1' },
        { index: 1, title: '第二章', url: 'https://example.com/2' },
      ];
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, false);
});

test('章节标题为空字符串的不计入有效章节', async () => {
  const engine = {
    async getChapterList() {
      return [
        { index: 0, title: '', url: 'https://example.com/1' },
        { index: 1, title: '  ', url: 'https://example.com/2' },
        { index: 2, title: '第二章', url: 'https://example.com/3' },
      ];
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, false);
});

test('目录为空时不显示搜索结果', async () => {
  const engine = {
    async getChapterList() {
      return [];
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, false);
});

test('目录请求超时时不显示搜索结果', async () => {
  const engine = {
    async getChapterList() {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [{ index: 0, title: '第一章', url: 'https://example.com/1' }];
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 10);

  assert.equal(ok, false);
});

test('目录请求报错时不显示搜索结果', async () => {
  const engine = {
    async getChapterList() {
      throw new Error('toc failed');
    },
  };

  const ok = await hasAvailableChapters(engine, {}, { bookUrl: 'https://example.com/book' }, 1000);

  assert.equal(ok, false);
});

test('导航链接和空链接不算有效章节', () => {
  assert.equal(isUsableChapter({ title: '首页', url: 'https://example.com/' }), false);
  assert.equal(isUsableChapter({ title: '书库', url: 'https://example.com/sort/' }), false);
  assert.equal(isUsableChapter({ title: '第一章 正文', url: '' }), false);
  assert.equal(isUsableChapter({ title: '第一章 正文', url: 'https://example.com/1.html' }), true);
});
