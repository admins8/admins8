import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultSource,
  buildApiSource,
  buildHeaderProfiles,
  buildFallbackGenerationResult,
  buildSearchCandidates,
  detectAccessChallenge,
  extractApiCandidatesFromHtml,
  extractSearchActionTemplate,
  inferJsonSearchRule,
  inferSearchRulesFromHtml,
} from './sourceGenerator';

test('buildDefaultSource creates importable source JSON', () => {
  const source = buildDefaultSource({
    url: 'http://www.xqishuta.org/',
    name: '奇书网',
    searchUrl: '/search?keyword={{key}}',
    ruleSearch: {
      bookList: 'li',
      name: 'a@text',
      author: '',
      bookUrl: 'a@href',
    },
  });

  assert.equal(source.bookSourceName, '奇书网');
  assert.equal(source.bookSourceUrl, 'http://www.xqishuta.org');
  assert.equal(source.searchUrl, '/search?keyword={{key}}');
  assert.equal(source.ruleSearch.bookList, 'li');
  assert.equal(source.ruleToc.chapterList, 'dd a');
  assert.equal(source.ruleContent.content, '#content@html||.content@html||.chapter-content@html');
});

test('buildSearchCandidates returns common static site search URLs', () => {
  const candidates = buildSearchCandidates('http://www.xqishuta.org/', '诡秘之主');

  assert.ok(candidates.some((item) => item.template === '/search?keyword={{key}}'));
  assert.ok(candidates.some((item) => item.template === '/modules/article/search.php?searchkey={{key}}'));
  assert.ok(candidates.every((item) => item.url.startsWith('http://www.xqishuta.org/')));
});

test('inferSearchRulesFromHtml detects repeated list links', () => {
  const html = `
    <ul class="book-list">
      <li><a href="/book/1.html">诡秘之主</a><span class="author">爱潜水的乌贼</span></li>
      <li><a href="/book/2.html">宿命之环</a><span class="author">爱潜水的乌贼</span></li>
    </ul>
  `;

  const rules = inferSearchRulesFromHtml(html);

  assert.equal(rules.bookList, '.book-list li');
  assert.equal(rules.name, 'a@text');
  assert.equal(rules.bookUrl, 'a@href');
  assert.equal(rules.author, '.author@text');
});

test('buildFallbackGenerationResult returns a copyable JSON draft when site probing fails', () => {
  const result = buildFallbackGenerationResult({
    url: 'http://www.xqishuta.org/',
    name: '',
    reason: 'Request failed with status code 403',
  });

  assert.equal(result.source.bookSourceName, 'xqishuta.org');
  assert.equal(result.source.bookSourceUrl, 'http://www.xqishuta.org');
  assert.equal(result.source.searchUrl, '/search?keyword={{key}}');
  assert.ok(result.jsonText.includes('"bookSourceName": "xqishuta.org"'));
  assert.ok(result.diagnostics.some((item) => item.includes('站点探测失败')));
});

test('extractSearchActionTemplate detects zhnjth schema search url', () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://www.zhnjth.com/modules/article/search.php?searchkey={search_term_string}&searchtype=articlename"
          },
          "query-input": "required name=search_term_string"
        }
      }
    </script>
  `;

  assert.equal(
    extractSearchActionTemplate('https://www.zhnjth.com/', html),
    '/modules/article/search.php?searchkey={{key}}&searchtype=articlename',
  );
});

test('detectAccessChallenge detects anti bot verification pages returned as html', () => {
  const html = '<html><head><title>访问验证</title></head><body>请完成访问验证后继续</body></html>';

  assert.equal(detectAccessChallenge(html), '访问验证');
});

test('extractApiCandidatesFromHtml detects api search urls from scripts', () => {
  const html = `
    <html>
      <body>
        <script>
          fetch('/api/search?keyword=' + encodeURIComponent(keyword) + '&page=1')
          axios.get("/novel/search?key=" + keyword)
        </script>
      </body>
    </html>
  `;

  const candidates = extractApiCandidatesFromHtml('https://example.com/books', html);

  assert.ok(candidates.includes('/api/search?keyword={{key}}&page=1'));
  assert.ok(candidates.includes('/novel/search?key={{key}}'));
});

test('inferJsonSearchRule detects common novel api response fields', () => {
  const rule = inferJsonSearchRule({
    data: [
      {
        novelName: '诡秘之主',
        authorName: '爱潜水的乌贼',
        novelId: 123,
        cover: 'https://img.example.com/1.jpg',
        summary: '蒸汽与机械的世界',
        wordNum: '446万字',
      },
    ],
  });

  assert.equal(rule.bookList, '$.data[*]');
  assert.equal(rule.name, '$.novelName');
  assert.equal(rule.author, '$.authorName');
  assert.equal(rule.bookUrl, '/novel/{{$.novelId}}');
  assert.equal(rule.coverUrl, '$.cover');
  assert.equal(rule.intro, '$.summary');
  assert.equal(rule.wordCount, '$.wordNum');
});

test('buildApiSource creates importable jsonpath source', () => {
  const source = buildApiSource({
    url: 'https://example.com/books',
    name: '接口书源',
    searchUrl: '/api/search?keyword={{key}}',
    headers: {
      'User-Agent': 'okhttp/4.9.2',
      Accept: 'application/json',
    },
    ruleSearch: {
      bookList: '$.data[*]',
      name: '$.novelName',
      author: '$.authorName',
      bookUrl: '/novel/{{$.novelId}}',
      coverUrl: '$.cover',
      intro: '$.summary',
    },
  });

  assert.equal(source.bookSourceName, '接口书源');
  assert.equal(source.searchUrl, '/api/search?keyword={{key}}');
  assert.equal(source.ruleSearch.bookList, '$.data[*]');
  assert.equal(source.ruleSearch.name, '$.novelName');
  assert.equal(source.ruleBookInfo.name, '$.novelName');
  assert.equal(source.ruleContent.content, '$.content');
  assert.ok(source.header.includes('"User-Agent": "okhttp/4.9.2"'));
});

test('buildHeaderProfiles returns retryable browser mobile and app style headers', () => {
  const profiles = buildHeaderProfiles('https://example.com/books', {
    Authorization: 'Bearer user-token',
  });

  assert.ok(profiles.length >= 4);
  assert.equal(profiles[0].name, '自定义请求头');
  assert.equal(profiles[0].headers.Authorization, 'Bearer user-token');
  assert.ok(profiles.some((profile) => profile.headers['User-Agent']?.includes('Windows NT 10.0')));
  assert.ok(profiles.some((profile) => profile.headers['User-Agent']?.includes('Android')));
  assert.ok(profiles.some((profile) => profile.headers['User-Agent']?.includes('okhttp')));
  assert.ok(profiles.every((profile) => profile.headers.Referer === 'https://example.com/books'));
});
