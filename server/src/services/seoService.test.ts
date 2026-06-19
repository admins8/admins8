import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRobotsTxt, buildSitemapXml, buildSeoBookSlug, buildSeoBookUrl } from './seoService';

test('robots.txt 允许公开页并禁止后台、接口、阅读页抓取', () => {
  const robots = buildRobotsTxt('https://so.soumal.com');

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/read\//);
  assert.match(robots, /Sitemap: https:\/\/so\.soumal\.com\/sitemap\.xml/);
});

test('sitemap.xml 输出可被搜索引擎读取的绝对 URL 并转义特殊字符', () => {
  const xml = buildSitemapXml([
    { loc: 'https://so.soumal.com/', priority: 1, changefreq: 'daily' },
    { loc: 'https://so.soumal.com/book/a&b.html', lastmod: '2026-06-16', priority: 0.8 },
  ]);

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/so\.soumal\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/so\.soumal\.com\/book\/a&amp;b\.html<\/loc>/);
  assert.match(xml, /<lastmod>2026-06-16<\/lastmod>/);
});

test('书籍 SEO URL 使用稳定 slug，避免直接暴露第三方书源 URL', () => {
  assert.equal(buildSeoBookSlug({ id: 12, name: '赤心巡天', author: '情何以甚' }), '12-chi-xin-xun-tian-qing-he-yi-shen');
  assert.equal(buildSeoBookUrl('https://so.soumal.com', { id: 12, name: '赤心巡天', author: '情何以甚' }), 'https://so.soumal.com/book/12-chi-xin-xun-tian-qing-he-yi-shen.html');
});
