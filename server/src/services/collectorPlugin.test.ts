import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectorFetchOptions, buildCollectorRunRule, buildCollectorUpdateCheck, buildCollectorTestFetchError, buildCollectorUpdateImportBook, extractBookByCollectorRule, extractChaptersByCollectorRule, extractContentByCollectorRule, normalizeCollectorChaptersForUpdate, normalizeCollectorRule, resolveCollectorMaxChapters, testCollectorRuleFromHtml } from './collectorPlugin';

test('采集规则能从详情页提取单本小说字段', async () => {
  const html = `
    <html><body>
      <h1 class="book-title">测试小说</h1>
      <span class="author">作者：张三</span>
      <img class="cover" src="/cover.jpg" />
      <div class="intro">这是简介</div>
      <a class="toc" href="/book/1/catalog.html">目录</a>
    </body></html>
  `;

  const book = extractBookByCollectorRule(html, 'https://example.com/book/1.html', {
    name: '测试规则',
    entryUrl: 'https://example.com/book/1.html',
    detailRules: {
      name: '.book-title@text',
      author: '.author@text##作者：',
      coverUrl: '.cover@src',
      intro: '.intro@text',
      tocUrl: '.toc@href',
    },
    tocRules: { chapterList: '', chapterTitle: '', chapterUrl: '' },
    contentRule: '',
  });

  assert.equal(book.name, '测试小说');
  assert.equal(book.author, '张三');
  assert.equal(book.coverUrl, 'https://example.com/cover.jpg');
  assert.equal(book.intro, '这是简介');
  assert.equal(book.tocUrl, 'https://example.com/book/1/catalog.html');
});

test('导入规则 JSON 会补齐默认值并保留核心字段', () => {
  const rule = normalizeCollectorRule({
    name: '导入规则',
    entryUrl: 'https://example.com/book/2.html',
    detailRules: { name: 'h1@text', author: '.author@text' },
    contentRule: '#content@html',
  });

  assert.equal(rule.name, '导入规则');
  assert.equal(rule.entryUrl, 'https://example.com/book/2.html');
  assert.equal(rule.detailRules.name, 'h1@text');
  assert.equal(rule.detailRules.author, '.author@text');
  assert.equal(rule.detailRules.coverUrl, '');
  assert.equal(rule.tocRules.chapterList, '');
  assert.equal(rule.contentRule, '#content@html');
});

test('单本采集可临时覆盖详情页地址且不修改原规则', () => {
  const baseRule = normalizeCollectorRule({
    name: '临时单本规则',
    entryUrl: 'https://example.com/book/original.html',
    detailRules: { name: 'h1@text', author: '.author@text' },
  });

  const runRule = buildCollectorRunRule(baseRule, {
    entryUrl: '  https://example.com/book/override.html  ',
  });

  assert.equal(runRule.entryUrl, 'https://example.com/book/override.html');
  assert.equal(baseRule.entryUrl, 'https://example.com/book/original.html');
  assert.equal(runRule.name, '临时单本规则');
});

test('导入规则兼容下划线字段和简写规则字段', () => {
  const rule = normalizeCollectorRule({
    name: '奇书网-xqishuta',
    entry_url: 'http://www.xqishuta.org/Shtml47336.html',
    charset: 'utf-8',
    detail_rules: {
      name: '.detail .detail_info h1@text##《|》全集',
      author: '.detail .detail_info ul li.small@text##.*书籍作者：',
      cover: '.detail .detail_pic img@src',
      category: '.wrap.position span a:nth-child(2)@text',
      latest_chapter_title: '.detail .detail_info ul li.small a@text',
      intro: '.showInfo p:first-child@text',
      toc_url: '.showDown a.downButton@href',
    },
    toc_rules: {
      list: '#info .pc_list ul li',
      title: 'a@text',
      url: 'a@href',
    },
    content_rule: '#content1@html',
  });

  assert.equal(rule.entryUrl, 'http://www.xqishuta.org/Shtml47336.html');
  assert.equal(rule.detailRules.coverUrl, '.detail .detail_pic img@src');
  assert.equal(rule.detailRules.kind, '.wrap.position span a:nth-child(2)@text');
  assert.equal(rule.detailRules.latestChapterTitle, '.detail .detail_info ul li.small a@text');
  assert.equal(rule.detailRules.tocUrl, '.showDown a.downButton@href');
  assert.equal(rule.tocRules.chapterList, '#info .pc_list:last ul li');
  assert.equal(rule.tocRules.chapterTitle, 'a@text');
  assert.equal(rule.tocRules.chapterUrl, 'a@href');
  assert.equal(rule.contentRule, '#content1@html');
});

test('奇书网采集规则会按“书籍作者”定位作者，避免误采点击次数', () => {
  const html = `
    <div class="detail">
      <div class="detail_info">
        <div class="detail_right">
          <h1>《叶辰》全集</h1>
          <ul>
            <li class="small">点击次数：126665</li>
            <li class="small">文件大小：67.77MB</li>
            <li class="small">书籍类型：ZIP+Txt</li>
            <li class="small">更新日期：2026-05-29 21:56:00</li>
            <li class="small">连载状态：连载中</li>
            <li class="small">书籍作者：风会笑</li>
            <li class="small">最新章节：<a href="/du/47/47336/">第12822章 归墟丹眼</a></li>
          </ul>
        </div>
      </div>
      <div class="detail_pic"><img src="/cover.jpg" /></div>
    </div>
    <div class="showInfo"><p>简介</p></div>
    <div class="showDown"><a class="downButton" href="/du/47/47336/">下载</a></div>
  `;
  const rule = normalizeCollectorRule({
    name: '奇书网-xqishuta',
    entryUrl: 'http://www.xqishuta.org/Shtml47336.html',
    detailRules: {
      name: '.detail .detail_info h1@text##《|》全集',
      author: '.detail .detail_info ul li.small@text##.*书籍作者：',
      coverUrl: '.detail .detail_pic img@src',
      intro: '.showInfo p:first-child@text',
      tocUrl: '.showDown a.downButton@href',
    },
    tocRules: { chapterList: '', chapterTitle: '', chapterUrl: '' },
    contentRule: '',
  });

  const book = extractBookByCollectorRule(html, rule.entryUrl, rule);

  assert.equal(rule.detailRules.author, '.detail .detail_info ul li:contains("书籍作者")@text##.*书籍作者：');
  assert.equal(book.name, '叶辰');
  assert.equal(book.author, '风会笑');
});

test('奇书网目录优先提取完整目录而不是最新章节列表', () => {
  const html = `
    <div id="info">
      <div class="pc_list">
        <ul>
          <li><a href="/du/78/78967/3.html">3、最新第三章</a></li>
          <li><a href="/du/78/78967/2.html">2、最新第二章</a></li>
        </ul>
      </div>
      <div class="pc_list">
        <ul>
          <li><a href="/du/78/78967/1.html">1、第一章</a></li>
          <li><a href="/du/78/78967/2.html">2、第二章</a></li>
          <li><a href="/du/78/78967/3.html">3、第三章</a></li>
        </ul>
      </div>
    </div>`;
  const rule = normalizeCollectorRule({
    name: '奇书网-xqishuta',
    entryUrl: 'http://www.xqishuta.org/Shtml78967.html',
    detailRules: { name: '.detail h1@text' },
    tocRules: {
      chapterList: '#info .pc_list ul li',
      chapterTitle: 'a@text',
      chapterUrl: 'a@href',
    },
    contentRule: '',
  });

  const chapters = extractChaptersByCollectorRule(html, 'http://www.xqishuta.org/du/78/78967/', rule);

  assert.deepEqual(chapters.map(ch => ch.title), ['1、第一章', '2、第二章', '3、第三章']);
});

test('测试采集规则会返回详情页/目录/正文诊断且不入库', () => {
  const detailHtml = `
    <html><body>
      <h1 class="book-title">测试书</h1>
      <span class="author">作者：李四</span>
      <img class="cover" src="/c.jpg" />
      <div class="intro">简介内容</div>
      <a class="toc" href="/book/9/list.html">目录</a>
    </body></html>`;
  const tocHtml = `
    <html><body>
      <ul class="chapters">
        <li><a href="/book/9/1.html">第1章 起航</a></li>
        <li><a href="/book/9/2.html">第2章 海上</a></li>
      </ul>
    </body></html>`;
  const contentHtml = `<div id="content"><p>第一章正文段落内容...</p></div>`;

  const rule = normalizeCollectorRule({
    name: 'test规则',
    entryUrl: 'https://example.com/book/9.html',
    detailRules: {
      name: '.book-title@text',
      author: '.author@text##作者：',
      coverUrl: '.cover@src',
      intro: '.intro@text',
      tocUrl: '.toc@href',
    },
    tocRules: {
      chapterList: '.chapters li',
      chapterTitle: 'a@text',
      chapterUrl: 'a@href',
    },
    contentRule: '#content@html',
  });

  const result = testCollectorRuleFromHtml(rule, { detailHtml, tocHtml, contentHtml });
  assert.equal(result.detail.ok, true);
  assert.equal(result.detail.book?.name, '测试书');
  assert.equal(result.detail.book?.author, '李四');
  assert.equal(result.detail.book?.tocUrl, 'https://example.com/book/9/list.html');
  assert.equal(result.toc.ok, true);
  assert.equal(result.toc.chapterCount, 2);
  assert.equal(result.toc.chapters[0].title, '第1章 起航');
  assert.equal(result.toc.chapters[0].url, 'https://example.com/book/9/1.html');
  assert.equal(result.content.ok, true);
  assert.match(result.content.preview || '', /第一章正文段落/);
  assert.equal(result.imported, false);
});

test('测试采集规则在书名为空时返回失败原因，不抛异常', () => {
  const rule = normalizeCollectorRule({
    name: 'bad规则',
    entryUrl: 'https://example.com/book/x.html',
    detailRules: { name: '.no-such@text' },
  });
  const result = testCollectorRuleFromHtml(rule, { detailHtml: '<html><body></body></html>' });
  assert.equal(result.detail.ok, false);
  assert.match(result.detail.error || '', /未提取到书名/);
});

test('测试采集规则在详情页请求超时时返回诊断结果，不抛服务器内部错误', () => {
  const rule = normalizeCollectorRule({
    name: '泡书吧-ipaoshuba',
    entryUrl: 'https://www.ipaoshuba.net/Book/31693/',
    detailRules: { name: '.f21h@text##作者:.*$##' },
    tocRules: { chapterList: '#list dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#content@html',
  });

  const result = buildCollectorTestFetchError(rule, new Error('timeout of 10000ms exceeded'), 'detail');
  assert.equal(result.detail.ok, false);
  assert.equal(result.detail.url, 'https://www.ipaoshuba.net/Book/31693/');
  assert.match(result.detail.error || '', /请求失败|超时|timeout/i);
  assert.equal(result.toc.ok, false);
  assert.equal(result.content.ok, false);
  assert.equal(result.imported, false);
});

test('泡书吧采集规则默认使用更长超时，避免线上慢链路被 10 秒截断', () => {
  const rule = normalizeCollectorRule({
    name: '泡书吧-ipaoshuba',
    entryUrl: 'https://www.ipaoshuba.net/Book/31693/',
    detailRules: { name: '.f21h@text##作者:.*$##' },
    tocRules: { chapterList: '#list dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#content@html',
  });

  assert.equal(rule.timeoutMs, 30000);
});

test('泡书吧采集规则支持 Jina Markdown 兜底详情页解析', () => {
  const html = `
Title: 道诡异仙txt全文下载_狐尾的笔_道诡异仙无弹窗广告_泡书吧小说

URL Source: https://www.ipaoshuba.net/Book/31693/

Markdown Content:
# 道诡异仙 _作者:[狐尾的笔](https://www.ipaoshuba.net/author/%E7%8B%90%E5%B0%BE%E7%9A%84%E7%AC%94.html)_
关于道诡异仙：

诡异的天道，异常的仙佛，是真？是假？
**小说分类：**玄幻魔法**小说状态：**已完成

_[TXT下载](https://www.ipaoshuba.net/down/31693.html)[开始阅读](https://www.ipaoshuba.net/Partlist/31693/ "道诡异仙")_

#### _**《道诡异仙》已更新到**_

_[番外：清旺来](https://www.ipaoshuba.net/Partlist/31693/162072344.shtml)_`;
  const rule = normalizeCollectorRule({
    name: '泡书吧-ipaoshuba',
    entryUrl: 'https://www.ipaoshuba.net/Book/31693/',
    detailRules: { name: '.f21h@text##作者:.*$##', author: '.f21h em a@text', coverUrl: '.pic img@src', intro: '.intro@text', tocUrl: '.btopt a@href', kind: '', latestChapterTitle: '' },
    tocRules: { chapterList: '#list dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#content@html',
  });

  const book = extractBookByCollectorRule(html, rule.entryUrl, rule);

  assert.equal(book.name, '道诡异仙');
  assert.equal(book.author, '狐尾的笔');
  assert.equal(book.tocUrl, 'https://www.ipaoshuba.net/Partlist/31693/');
  assert.equal(book.kind, '玄幻魔法');
  assert.equal(book.latestChapterTitle, '番外：清旺来');
  assert.match(book.intro, /诡异的天道/);
});

test('泡书吧采集规则支持 Jina Markdown 兜底目录和正文解析', () => {
  const tocHtml = `
Title: 道诡异仙
URL Source: https://www.ipaoshuba.net/Partlist/31693/
Markdown Content:
《道诡异仙》的结局[番外](https://www.ipaoshuba.net/Partlist/31693/161144535.shtml)**《道诡异仙》正文**[道诡异仙txt全文下载](https://www.ipaoshuba.net/down/31693.html)[第1章 师傅](https://www.ipaoshuba.net/Partlist/31693/123828192.shtml)[第2章 李火旺](https://www.ipaoshuba.net/Partlist/31693/123828193.shtml)`;
  const contentHtml = `
Title: 道诡异仙 - 第1章 师傅 - 泡书吧
URL Source: https://www.ipaoshuba.net/Partlist/31693/123828192.shtml
Markdown Content:
巴虺的吐纳声越来越近，李火旺紧张地看着四周。`;
  const rule = normalizeCollectorRule({
    name: '泡书吧-ipaoshuba',
    entryUrl: 'https://www.ipaoshuba.net/Book/31693/',
    detailRules: { name: '.f21h@text##作者:.*$##' },
    tocRules: { chapterList: '#list dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#content@html',
  });

  const chapters = extractChaptersByCollectorRule(tocHtml, 'https://www.ipaoshuba.net/Partlist/31693/', rule);
  const content = extractContentByCollectorRule(contentHtml, rule);

  assert.deepEqual(chapters.map(ch => ch.title), ['第1章 师傅', '第2章 李火旺']);
  assert.match(content, /巴虺的吐纳声/);
});

test('看小说网采集规则会自动修正正文容器为 chaptercontent', () => {
  const rule = normalizeCollectorRule({
    name: '看小说网-kanxiaoshuo123',
    entryUrl: 'https://www.kanxiaoshuo123.com/654752/',
    detailRules: { name: 'meta[property="og:novel:book_name"]@content' },
    tocRules: { chapterList: 'dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#content@html##<script[\\s\\S]*?</script>####<div class="bottem"[\\s\\S]*$##',
  });

  assert.match(rule.contentRule, /^#chaptercontent@html/);
  assert.match(rule.contentRule, /最新章节地址/);
});

test('看小说网采集规则会自动使用全文目录链接，避免只采详情页最近章节', () => {
  const html = `
    <html><head>
      <meta property="og:novel:book_name" content="星武纪元" />
    </head><body>
      <a href="/654752/52263451.html">首章阅读</a>
      <a href="/654752/index.html">全文目录</a>
    </body></html>`;
  const rule = normalizeCollectorRule({
    name: '看小说网-kanxiaoshuo123',
    entryUrl: 'https://www.kanxiaoshuo123.com/654752/',
    detailRules: { name: 'meta[property="og:novel:book_name"]@content', tocUrl: '' },
    tocRules: { chapterList: 'dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#chaptercontent@html',
  });

  const book = extractBookByCollectorRule(html, rule.entryUrl, rule);

  assert.equal(rule.detailRules.tocUrl, 'a:contains("全文目录")@href');
  assert.equal(rule.tocRules.chapterList, 'dl.books_dl dd');
  assert.equal(book.tocUrl, 'https://www.kanxiaoshuo123.com/654752/index.html');
});

test('单本采集默认不限制章节数量，显式数量才截断', () => {
  assert.equal(resolveCollectorMaxChapters(undefined), undefined);
  assert.equal(resolveCollectorMaxChapters(0), undefined);
  assert.equal(resolveCollectorMaxChapters(20), 20);
  assert.equal(resolveCollectorMaxChapters(9999), 5000);
});

test('看小说网采集请求不要强制 retry=0，允许使用备用浏览器请求头重试', () => {
  const rule = normalizeCollectorRule({
    name: '看小说网-kanxiaoshuo123',
    entryUrl: 'https://www.kanxiaoshuo123.com/654752/',
    timeoutMs: 30000,
    detailRules: { name: 'meta[property="og:novel:book_name"]@content' },
    tocRules: { chapterList: 'dd', chapterTitle: 'a@text', chapterUrl: 'a@href' },
    contentRule: '#chaptercontent@html',
  });

  const options = buildCollectorFetchOptions(rule, {});

  assert.equal(options.timeoutMs, 30000);
  assert.equal(options.retry, undefined);
});

test('采集规则支持显式配置代理和超时时间', () => {
  const rule = normalizeCollectorRule({
    name: '代理规则',
    entryUrl: 'https://example.com/book/1',
    timeoutMs: 45000,
    proxy: 'http://127.0.0.1:7890',
    detailRules: { name: 'h1@text' },
  });

  assert.equal(rule.timeoutMs, 45000);
  assert.equal(rule.proxy, 'http://127.0.0.1:7890');
});

test('采集更新检查会在远端章节更多时提示可更新', () => {
  const result = buildCollectorUpdateCheck({
    localChapterCount: 20,
    remoteChapterCount: 128,
    ruleName: '泡书吧',
  });
  assert.equal(result.canUpdate, true);
  assert.equal(result.localChapterCount, 20);
  assert.equal(result.remoteChapterCount, 128);
  assert.match(result.message, /更多章节/);
});

test('采集更新检查在本地已最新时不提示更新', () => {
  const result = buildCollectorUpdateCheck({
    localChapterCount: 128,
    remoteChapterCount: 128,
    ruleName: '泡书吧',
  });
  assert.equal(result.canUpdate, false);
});

test('采集更新入库必须保留当前详情页的本地 bookUrl', () => {
  const localBookUrl = 'https://example.com/book/old-url/';
  const remoteBook = {
    bookUrl: 'https://example.com/book/canonical-url/',
    tocUrl: 'https://example.com/book/canonical-url/catalog.html',
    origin: 'https://example.com',
    originName: '测试规则',
    name: '测试书',
    author: '作者',
    coverUrl: '',
    intro: '',
    kind: '',
    latestChapterTitle: '第941章',
  };

  const importBook = buildCollectorUpdateImportBook(localBookUrl, remoteBook);

  assert.equal(importBook.bookUrl, localBookUrl);
  assert.equal(remoteBook.bookUrl, 'https://example.com/book/canonical-url/');
  assert.equal(importBook.tocUrl, remoteBook.tocUrl);
});

test('采集更新检查应按唯一可读章节计数而不是原始抓取条数', () => {
  const chapters = normalizeCollectorChaptersForUpdate([
    { index: 0, title: '第1章', url: '/1.html' },
    { index: 1, title: '第1章', url: '/1.html' },
    { index: 2, title: '番外', url: '/extra-1.html' },
    { index: 3, title: '番外', url: '/extra-2.html' },
    { index: 4, title: '目录', url: '/toc.html' },
  ]);

  assert.deepEqual(chapters.map(ch => ({ index: ch.index, title: ch.title, url: ch.url })), [
    { index: 0, title: '第1章', url: '/1.html' },
    { index: 1, title: '番外', url: '/extra-1.html' },
    { index: 2, title: '番外', url: '/extra-2.html' },
  ]);
});
