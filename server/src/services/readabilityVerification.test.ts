import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReadableBookCandidate, verifyReadableSwitchCandidate } from './readabilityVerification';

test('普通搜索候选只要目录可用就算可进入，不在搜索阶段请求正文', async () => {
  let contentCalls = 0;
  const result = await verifyReadableBookCandidate({
    engine: {
      getChapterList: async () => [{ title: '第一章', url: 'https://a.test/1.html', index: 0 }],
      getContent: async () => {
        contentCalls++;
        return '';
      },
    },
    source: {},
    book: { bookUrl: 'https://a.test/book' },
    timeoutMs: 100,
  });

  assert.equal(result.readable, true);
  assert.equal(result.tocVerified, true);
  assert.equal(result.contentVerified, false);
  assert.equal(result.chapter?.index, 0);
  assert.equal(contentCalls, 0);
});

test('普通搜索候选目录为空时不可进入', async () => {
  const result = await verifyReadableBookCandidate({
    engine: {
      getChapterList: async () => [],
      getContent: async () => '正文内容',
    },
    source: {},
    book: { bookUrl: 'https://a.test/book' },
    timeoutMs: 100,
  });

  assert.equal(result.readable, false);
  assert.equal(result.tocVerified, false);
  assert.equal(result.contentVerified, false);
});

test('换源候选只验证目录，不在换源列表阶段请求正文', async () => {
  let contentCalls = 0;
  const result = await verifyReadableSwitchCandidate({
    engine: {
      getChapterList: async () => [
        { title: '第一章', url: 'https://a.test/1.html', index: 0 },
        { title: '第二章', url: 'https://a.test/2.html', index: 1 },
      ],
      getContent: async () => {
        contentCalls++;
        return '';
      },
    },
    source: {},
    book: { bookUrl: 'https://a.test/book' },
    chapterIndex: 0,
    timeoutMs: 10