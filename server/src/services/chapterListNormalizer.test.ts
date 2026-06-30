import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChapterList } from './chapterListNormalizer';

test('目录列表会按 URL 和标题去重并重建连续序号', () => {
  const chapters = normalizeChapterList([
    { title: '第一章 开始', url: '/1.html', index: 0 },
    { title: '第一章 开始', url: '/1.html', index: 1 },
    { title: '第二章 继续', url: '/2.html', index: 2 },
    { title: '第二章 继续', url: '/2-copy.html', index: 3 },
  ]);

  assert.deepEqual(chapters.map(ch => ({ title: ch.title, url: ch.url, index: ch.index })), [
    { title: '第一章 开始', url: '/1.html', index: 0 },
    { title: '第二章 继续', url: '/2.html', index: 1 },
  ]);
});

test('目录列表会过滤无效章节', () => {
  const chapters = normalizeChapterList([
    { title: '目录', url: '/toc.html', index: 0 },
    { title: '第一章 正文', url: '/1.html', index: 1 },
    { title: '', url: '/empty.html', index: 2 },
  ]);

  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].title, '第一章 正文');
  assert.equal(chapters[0].index, 0);
});

test('采集缓存目录允许同标题不同 URL 的章节共存', () => {
  const chapters = normalizeChapterList([
    { title: '番外', url: '/extra-1.html', index: 0 },
    { title: '番外', url: '/extra-2.html', index: 1 },
    { title: '第1章 正文', url: '/1.html', index: 2 },
  ], { dedupeTitle: false });

  assert.deepEqual(chapters.map(ch => ({ title: ch.title, url: ch.url, index: ch.index })), [
    { title: '番外', url: '/extra-1.html', index: 0 },
    { title: '番外', url: '/extra-2.html', index: 1 },
    { title: '第1章 正文', url: '/1.html', index: 2 },
  ]);
});

test('目录列表保留数字顿号开头的章节标题', () => {
  const chapters = normalizeChapterList([
    { title: '65、好时光', url: '/du/78/78967/52069987.html', index: 0 },
    { title: '66、两位司曹', url: '/du/78/78967/52088598.html', index: 1 },
    { title: '目录', url: '/du/78/78967/', index: 2 },
  ], { dedupeTitle: false });

  assert.deepEqual(chapters.map(ch => ({ title: ch.title, url: ch.url, index: ch.index })), [
    { title: '65、好时光', url: '/du/78/78967/52069987.html', index: 0 },
    { title: '66、两位司曹', url: '/du/78/78967/52088598.html', index: 1 },
  ]);
});
