import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteSeo, injectSeoIntoHtml, renderSeoTemplate } from './seoHtmlService';

const configs = {
  site_title: '搜猫阅读',
  home_title: '首页-{siteName}',
  home_keywords: '首页关键词',
  home_description: '首页描述',
  detail_title_template: '{bookName}-{author}-详情-{siteName}',
  detail_keywords_template: '{bookName},{author},详情',
  detail_description_template: '{bookName}最新章节是{latestChapter}，{intro}',
  reader_title_template: '{chapterTitle}-{bookName}-阅读-{siteName}',
  reader_keywords_template: '{bookName},{chapterTitle},阅读',
  reader_description_template: '正在阅读{bookName}的{chapterTitle}',
  search_title_template: '{keyword}-搜索-{siteName}',
  search_keywords_template: '{keyword},搜索',
  search_description_template: '搜索{keyword}的结果',
  ranking_title_template: '{rankName}-{category}-{siteName}',
  ranking_keywords_template: '{rankName},{category}',
  ranking_description_template: '{siteName}的{rankName}',
  web_domain: 'https://soumal.com',
};

test('SEO 模板支持后台中文变量和英文变量', () => {
  assert.equal(renderSeoTemplate('{书名}-{author}-{网站名}', configs, {
    bookName: '赤心巡天',
    author: '情何以甚',
  }), '赤心巡天-情何以甚-搜猫阅读');
});

test('首页、搜索、详情、阅读、排行榜都按后台 SEO 配置生成源码级 TDK', () => {
  assert.equal(buildRouteSeo('/', configs).title, '首页-搜猫阅读');
  assert.equal(buildRouteSeo('/?keyword=赤心巡天', configs).title, '赤心巡天-搜索-搜猫阅读');
  assert.equal(buildRouteSeo('/book-detail?bookName=赤心巡天&author=情何以甚&latestChapter=第一章&intro=简介', configs).title, '赤心巡天-情何以甚-详情-搜猫阅读');
  assert.equal(buildRouteSeo('/read/abc?bookName=赤心巡天&chapterTitle=第一章', configs).title, '第一章-赤心巡天-阅读-搜猫阅读');
  assert.equal(buildRouteSeo('/ranking?rankName=热门榜&category=玄幻', configs).title, '热门榜-玄幻-搜猫阅读');
});

test('注入 HTML 时会替换 title、meta 和 canonical，并写入最新配置 JSON', () => {
  const html = '<html><head><title>旧标题</title><meta name="keywords" content="旧关键词" /><meta name="description" content="旧描述" /><script id="site-config-json" type="application/json">{}</script></head><body></body></html>';
  const output = injectSeoIntoHtml(html, configs, buildRouteSeo('/ranking', configs));

  assert.match(output, /<title>小说排行榜-全部-搜猫阅读<\/title>/);
  assert.match(output, /<meta name="keywords" content="小说排行榜,全部" \/>/);
  assert.match(output, /<meta name="description" content="搜猫阅读的小说排行榜" \/>/);
  assert.match(output, /<link rel="canonical" href="https:\/\/soumal\.com\/ranking" \/>/);
  assert.match(output, /"home_title":"首页-{siteName}"/);
});

test('首页源码会在 app fallback 中注入友情链接，且过滤危险链接', () => {
  const html = '<html><head><title></title></head><body><div id="app"></div><script type="module" src="/assets/index.js"></script></body></html>';
  const output = injectSeoIntoHtml(html, configs, buildRouteSeo('/', configs), [
    { name: '安全站点', url: 'https://example.com' },
    { name: '危险站点', url: 'javascript:alert(1)' },
  ]);

  assert.match(output, /<div id="app"><footer class="app-footer server-rendered-footer"/);
  assert.match(output, /友情链接：/);
  assert.match(output, /<a href="https:\/\/example\.com\/?" target="_blank" rel="noopener noreferrer">安全站点<\/a>/);
  assert.doesNotMatch(output, /javascript:alert/);
  assert.doesNotMatch(output, /危险站点/);
});
