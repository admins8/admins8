import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRssSourceUrlType,
  normalizeRssImportPayload,
  normalizeRssSourceInput,
} from './rssSourceService';

test('detectRssSourceUrlType distinguishes single and collection YCK rss links', () => {
  assert.equal(
    detectRssSourceUrlType('https://www.yck2026.top/yuedu/rss/json/id/193.json'),
    'single',
  );
  assert.equal(
    detectRssSourceUrlType('https://www.yck2026.top/yuedu/rsss/json/id/193.json'),
    'collection',
  );
  assert.equal(
    detectRssSourceUrlType('https://www.yck2026.top/yuedu/shuyuan/json/id/193.json'),
    'unknown',
  );
});

test('normalizeRssImportPayload accepts object arrays and nested data arrays', () => {
  const single = normalizeRssImportPayload({ sourceName: '单源', sourceUrl: 'https://a.example' });
  assert.equal(single.length, 1);
  assert.equal(single[0].sourceName, '单源');

  const collection = normalizeRssImportPayload({
    data: [
      { sourceName: 'A', sourceUrl: 'https://a.example' },
      { sourceName: 'B', sourceUrl: 'https://b.example' },
    ],
  });
  assert.equal(collection.length, 2);
});

test('normalizeRssSourceInput maps legado rss fields and rejects placeholder items', () => {
  const normalized = normalizeRssSourceInput({
    sourceName: '源仓库',
    sourceUrl: 'https://www.yckceo.com/',
    sourceGroup: '阅读',
    sourceIcon: 'https://www.yckceo.com/favicon.ico',
    sourceComment: '示例',
    enabled: true,
    customOrder: 2,
    articleStyle: 1,
    singleUrl: false,
    enableJs: true,
    enabledCookieJar: true,
    header: '{"User-Agent":"okhttp"}',
    sortUrl: '首页::/',
    ruleArticles: '.item',
    ruleTitle: 'a@text',
    ruleLink: 'a@href',
    ruleImage: 'img@src',
    rulePubDate: '.date@text',
    ruleContent: '.content@html',
    ruleNextPage: '.next@href',
  });

  assert.equal(normalized.sourceUrl, 'https://www.yckceo.com/');
  assert.equal(normalized.sourceName, '源仓库');
  assert.equal(normalized.sourceGroup, '阅读');
  assert.equal(normalized.ruleArticles, '.item');
  assert.equal(normalized.enableJs, true);

  assert.throws(
    () => normalizeRssSourceInput({ sourceName: '目录占位', sourceUrl: '' }),
    /缺少 sourceUrl/,
  );
});
