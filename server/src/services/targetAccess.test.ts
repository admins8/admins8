import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJinaMarkdownSnapshotUrl,
  buildTargetAccessAttempts,
  extractJinaMarkdownLinks,
  extractJinaMarkdownText,
  isJinaMarkdownSnapshot,
  shouldUseJinaSnapshot,
} from './targetAccess';

test('目标站访问层会为泡书系 GET 请求生成快照兜底地址', () => {
  const url = 'https://www.ipaoshuba.net/Book/31693/';

  assert.equal(shouldUseJinaSnapshot(url, { method: 'GET' }), true);
  assert.deepEqual(buildTargetAccessAttempts(url, { targetAccessMode: 'snapshot-fallback' }), [
    'https://www.ipaoshuba.net/Book/31693/',
    'https://r.jina.ai/http://r.jina.ai/http://https://www.ipaoshuba.net/Book/31693/',
  ]);
});

test('目标站访问层支持快照优先，避免先等待主站超时', () => {
  const url = 'https://www.ipaoshuba.net/Partlist/31693/';

  assert.deepEqual(buildTargetAccessAttempts(url, { targetAccessMode: 'snapshot-first' }), [
    'https://r.jina.ai/http://r.jina.ai/http://https://www.ipaoshuba.net/Partlist/31693/',
    'https://www.ipaoshuba.net/Partlist/31693/',
  ]);
});

test('目标站访问层不会给 POST 请求生成 Jina 快照地址', () => {
  const url = 'https://www.ipaoshuba.net/search.php';

  assert.equal(shouldUseJinaSnapshot(url, { method: 'POST' }), false);
  assert.deepEqual(buildTargetAccessAttempts(url, { method: 'POST', targetAccessMode: 'snapshot-fallback' }), [url]);
});

test('Jina Markdown 工具能识别快照并提取链接和正文', () => {
  const html = `Title: 道诡异仙

URL Source: https://www.ipaoshuba.net/Partlist/31693/

Markdown Content:
# 道诡异仙

[第1章 师傅](https://www.ipaoshuba.net/Partlist/31693/123828192.shtml)

正文第一段。`;

  assert.equal(isJinaMarkdownSnapshot(html), true);
  assert.equal(buildJinaMarkdownSnapshotUrl('https://www.ipaoshuba.net/Book/31693/'), 'https://r.jina.ai/http://r.jina.ai/http://https://www.ipaoshuba.net/Book/31693/');
  assert.deepEqual(extractJinaMarkdownLinks(html), [
    { title: '第1章 师傅', url: 'https://www.ipaoshuba.net/Partlist/31693/123828192.shtml' },
  ]);
  assert.match(extractJinaMarkdownText(html), /正文第一段/);
});
