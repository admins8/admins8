import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSearchResults, classifySearchResult, getAggregateKey, getSearchWindow, rankSearchResults, shouldEmitImmediateSearchResult } from './searchResultRanking';

test('搜索结果优先展示书名完全匹配的书籍', () => {
  const ranked = rankSearchResults('斗破苍穹', [
    { name: '斗破苍穹之魂玉', sourceName: '慢源' },
    { name: '斗破苍穹', sourceName: '准确源' },
    { name: '斗破苍穹之九重玄天', sourceName: '扩展源' },
  ]);

  assert.equal(ranked[0].name, '斗破苍穹');
});

test('同等匹配时小说文字源优先于漫画图片源', () => {
  const ranked = rankSearchResults('凡人修仙传', [
    { name: '凡人修仙传', author: 'HeHeX蛋糕月', sourceName: '漫蛙', kind: '热血,玄幻,漫画' },
    { name: '凡人修仙传', author: '忘语', sourceName: '小说阅读网', kind: '玄幻' },
  ]);

  assert.equal((ranked[0] as any).sourceName, '小说阅读网');
});

test('同等匹配时目录已验证结果优先于未验证结果', () => {
  const ranked = rankSearchResults('斗罗大陆', [
    { name: '斗罗大陆', author: '唐家三少', sourceName: '小说源A', _tocVerified: false },
    { name: '斗罗大陆', author: '唐家三少', sourceName: '小说源B', _tocVerified: true },
  ]);

  assert.equal((ranked[0] as any).sourceName, '小说源B');
});

test('默认搜索窗口会扫描全部剩余书源', () => {
  const sources = Array.from({ length: 1521 }, (_, index) => ({ id: index + 1 }));
  const window = getSearchWindow(sources, 0);

  assert.equal(window.totalSources, 1521);
  assert.equal(window.remainingSources.length, 1521);
  assert.equal(window.hasMore, false);
});

test('同名同作者标记为精确匹配，同人衍生书标记为相关结果', () => {
  const exact = classifySearchResult('斗破苍穹', {
    name: '斗破苍穹',
    author: '天蚕土豆',
  });
  const related = classifySearchResult('斗破苍穹', {
    name: '斗破苍穹之魂玉',
    author: '赤月之瞳',
  });

  assert.equal(exact.level, 'exact');
  assert.equal(exact.label, '精确匹配');
  assert.equal(related.level, 'related');
  assert.equal(related.label, '相关结果');
});

test('同名同作者搜索结果会合并来源并按来源数优先排序', () => {
  const aggregated = aggregateSearchResults('斗破苍穹', [
    { name: '斗破苍穹', author: '天蚕土豆', bookUrl: 'https://a/book', sourceUrl: 'https://a', sourceName: 'A源', _matchLevel: 'exact', _matchScore: 900 },
    { name: '斗破苍穹之魂玉', author: '赤月之瞳', bookUrl: 'https://c/book', sourceUrl: 'https://c', sourceName: 'C源', _matchLevel: 'related', _matchScore: 60 },
    { name: '斗破苍穹', author: '天蚕土豆', bookUrl: 'https://b/book', sourceUrl: 'https://b', sourceName: 'B源', _matchLevel: 'exact', _matchScore: 900 },
  ]);

  assert.equal(aggregated.length, 2);
  assert.equal(aggregated[0].name, '斗破苍穹');
  assert.equal(aggregated[0].sourceCount, 2);
  assert.equal(aggregated[0].sources.length, 2);
  assert.equal(aggregated[0].sources[0].sourceName, 'A源');
  assert.equal(aggregated[0].sources[1].sourceName, 'B源');
});

test('聚合键会忽略作者标点，避免本地缓存和远程聚合重复显示', () => {
  assert.equal(
    getAggregateKey({ name: '仙工开物', author: '点击次数：554' }),
    getAggregateKey({ name: '仙工开物', author: '点击次数554' })
  );
});

test('同等匹配时本地已缓存结果强制排在第一位', () => {
  const ranked = rankSearchResults('仙工开物', [
    { name: '仙工开物', author: '蛊真人', sourc