import test from 'node:test';
import assert from 'node:assert/strict';
import { WebBookEngine } from './webBookService';

test('getBookInfo 将详情页目录规则解析为 tocUrl，且不覆盖 bookUrl', async () => {
  const engine = new WebBookEngine({
    requestHtml: async () => `
      <html>
        <body>
          <h1>赤心巡天</h1>
          <a class="toc" href="/book/1/catalog.html">目录</a>
        </body>
      </html>
    `,
  } as any);

  const info = await engine.getBookInfo({
    rule_book_info: JSON.stringify({
      name: 'h1@text',
      tocUrl: '.toc@href',
    }),
  }, 'https://example.com/book/1/');

  assert.equal(info.name, '赤心巡天');
  assert.equal((info as any).tocUrl, 'https://example.com/book/1/catalog.html');
  assert.equal(info.bookUrl, undefined);
});

test('getChapterList 在搜索结果缺少 tocUrl 时先从详情页回补目录 URL', async () => {
  const requestedUrls: string[] = [];
  const engine = new WebBookEngine({
    requestHtml: async (url: string) => {
      requestedUrls.push(url);
      if (url === 'https://example.com/book/1/') {
        return `
          <html>
            <body>
              <a class="read" href="/book/1/catalog.html">开始阅读</a>
            </body>
          </html>
        `;
      }
      if (url === 'https://example.com/book/1/catalog.html') {
        return `
          <html>
            <body>
              <ul class="chapters">
                <li><a href="001.html">第一章 太虚幻境</a></li>
                <li><a href="002.html">第二章 观河台</a></li>
              </ul>
            </body>
          </html>
        `;
      }
      throw new Error(`unexpected url: ${url}`);
    },
  } as any);

  const chapters = await engine.getChapterList({
    rule_book_info: JSON.stringify({
      tocUrl: '.read@href',
    }),
    rule_toc: JSON.stringify({
      chapterList: '.chapters li',
      chapterName: 'li.0@tag.a.0@text',
      chapterUrl: 'li.0@tag.a.0@href',
    }),
  }, {
    bookUrl: 'https://example.com/book/1/',
  });

  assert.deepEqual(requestedUrls, [
    'https://example.com/book/1/',
    'https://example.com/book/1/catalog.html',
  ]);
  assert.deepEqual(chapters, [
    { index: 0, title: '第一章 太虚幻境', url: 'https://example.com/book/1/001.html' },
    { index: 1, title: '第二章 观河台', url: 'https://example.com/book/1/002.html' },
  ]);
});
