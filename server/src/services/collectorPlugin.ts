import { execute, query, queryOne, transaction } from '../config/database';
import { executeRule } from './ruleExecutor';
import * as cheerio from 'cheerio';
import { buildHeaders, parseSearchUrl, UrlOption } from './bookSourceHttpClient';
import { normalizeChapterList } from './chapterListNormalizer';
import { refreshSchedulesNow } from './collectorScheduler';
import { requestTargetHtml } from './targetAccess';

// Puppeteer 浏览器单例
let puppeteerBrowser: any = null;

async function getPuppeteerBrowser(): Promise<any> {
  if (!puppeteerBrowser || !puppeteerBrowser.isConnected || !puppeteerBrowser.isConnected()) {
    const puppeteer = require('puppeteer-core');
    console.log('[Puppeteer] Launching browser...');
    puppeteerBrowser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
    });
    console.log('[Puppeteer] Browser launched');
  }
  return puppeteerBrowser;
}

export async function closePuppeteerBrowser(): Promise<void> {
  if (puppeteerBrowser) {
    await puppeteerBrowser.close();
    puppeteerBrowser = null;
    console.log('[Puppeteer] Browser closed');
  }
}

async function fetchHtmlWithPuppeteer(url: string, _rule: CollectorRulePayload): Promise<string> {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });
    console.log(`[Puppeteer] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // 等待 Cloudflare 挑战通过
    await page.waitForFunction(
      () => {
        const title = document.querySelector('title');
        return !title || !title.textContent || !title.textContent.includes('Just a moment');
      },
      { timeout: 15000, polling: 500 }
    ).catch(() => {
      console.log('[Puppeteer] Cloudflare challenge may not have completed, proceeding anyway');
    });
    const html = await page.content();
    console.log(`[Puppeteer] Fetched ${url}, length=${html.length}`);
    return html;
  } finally {
    await page.close();
  }
}

function isCloudflarePage(html: string): boolean {
  return html.includes('challenge-platform') ||
    html.includes('cf-chl') ||
    html.includes('Just a moment') ||
    html.includes('cf-browser-verification') ||
    html.includes('Turnstile');
}

export interface CollectorDetailRules {
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  tocUrl: string;
  kind?: string;
  latestChapterTitle?: string;
}

export interface CollectorTocRules {
  chapterList: string;
  chapterTitle: string;
  chapterUrl: string;
}

export interface CollectorListRules {
  bookList: string;
  bookName?: string;
  bookAuthor?: string;
  bookUrl?: string;
  bookCover?: string;
  bookLatestChapter?: string;
  bookKind?: string;
}

export interface CollectorPagination {
  pattern: string;
  startPage: number;
  maxPages: number;
  increment: number;
}

export interface CollectorRulePayload {
  id?: number;
  name: string;
  entryUrl: string;
  entryUrls: string[];
  entryUrlConfigs?: Array<{ startPage: number; endPage: number }>;
  enabled?: boolean;
  charset?: string;
  headers?: Record<string, string> | string;
  proxy?: string;
  timeoutMs?: number;
  detailRules: CollectorDetailRules;
  tocRules: CollectorTocRules;
  contentRule: string;
  listUrl?: string;
  listRules?: CollectorListRules;
  pagination?: CollectorPagination;
}

export interface CollectorBookDraft {
  bookUrl: string;
  tocUrl: string;
  origin: string;
  originName: string;
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  kind: string;
  latestChapterTitle: string;
}

export interface CollectorChapterDraft {
  index: number;
  title: string;
  url: string;
  content?: string;
}

export interface CollectorRunResult {
  book: CollectorBookDraft;
  chapters: CollectorChapterDraft[];
  imported: boolean;
  chapterCount: number;
  contentCount: number;
}

export interface CollectorRunOptions {
  includeContent?: boolean;
  maxChapters?: number;
  entryUrl?: string;
}

export interface CollectorUpdateCheckResult {
  canUpdate: boolean;
  localChapterCount: number;
  remoteChapterCount: number;
  ruleName: string;
  message: string;
}

function text(value: any): string {
  if (Array.isArray(value)) return text(value[0]);
  return String(value ?? '').trim();
}

function normalizeKnownCollectorAuthorRule(input: any, authorRule: string): string {
  const name = text(input?.name).toLowerCase();
  const entryUrl = text(input?.entryUrl || input?.entry_url || input?.url).toLowerCase();
  const isXqishuta = name.includes('xqishuta') || entryUrl.includes('xqishuta.org');
  if (
    isXqishuta &&
    /ul\s+li\.small@text/i.test(authorRule) &&
    authorRule.includes('书籍作者')
  ) {
    return '.detail .detail_info ul li:contains("书籍作者")@text##.*书籍作者：';
  }
  return authorRule;
}

function isIpaoshubaRule(input: any): boolean {
  const name = text(input?.name).toLowerCase();
  const entryUrl = text(input?.entryUrl || input?.entry_url || input?.url).toLowerCase();
  return name.includes('ipaoshuba') || name.includes('泡书吧') || entryUrl.includes('ipaoshuba.net') || entryUrl.includes('paoshuba.com');
}

function isJinaMarkdownSnapshot(html: string): boolean {
  return /URL Source:\s*https?:\/\/[^\n]+/i.test(String(html || '')) && String(html || '').includes('Markdown Content:');
}

function markdownContent(html: string): string {
  const raw = String(html || '');
  const index = raw.indexOf('Markdown Content:');
  return index >= 0 ? raw.slice(index + 'Markdown Content:'.length).trim() : raw.trim();
}

function normalizeMarkdownText(value: string): string {
  return text(value)
    .replace(/\\\*/g, '*')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMarkdownLinkTitle(markdown: string, urlPattern: RegExp): string {
  const match = markdown.match(urlPattern);
  return normalizeMarkdownText(match?.[1] || '');
}

function extractIpaoshubaBookFromMarkdown(html: string, detailUrl: string, rule: CollectorRulePayload): CollectorBookDraft {
  const markdown = markdownContent(html);
  const titleMatch = markdown.match(/^#\s+(.+?)\s+_作者:\[([^\]]+)\]/m)
    || markdown.match(/^#\s+\[?([^\]\n]+?)\]?\([^)]+\)\s*[\r\n]+作\s*者：\[([^\]]+)\]/m);
  const name = normalizeMarkdownText(titleMatch?.[1] || '');
  if (!name) throw new Error('详情页未提取到书名');
  const author = normalizeMarkdownText(titleMatch?.[2] || '');
  const coverUrl = text(markdown.match(/!\[[^\]]*?\]\((https?:\/\/[^)]+)\)/i)?.[1]);
  const tocUrl = text(markdown.match(/\[开始阅读\]\((https?:\/\/www\.ipaoshuba\.net\/Partlist\/\d+\/)/i)?.[1])
    || text(markdown.match(/\[直达底部↓\]\((https?:\/\/www\.ipaoshuba\.net\/Partlist\/\d+\/)/i)?.[1])
    || text(markdown.match(/URL Source:\s*(https?:\/\/www\.ipaoshuba\.net\/Book\/(\d+)\/)/i)?.[2] ? `https://www.ipaoshuba.net/Partlist/${markdown.match(/URL Source:\s*https?:\/\/www\.ipaoshuba\.net\/Book\/(\d+)\/?/i)?.[1]}/` : '');
  const introMatch = markdown.match(/关于[^：:]+[：:]\s*([\s\S]*?)\*\*小说分类：/i)
    || markdown.match(/简介:\s*([\s\S]*?)(?:\n\n|《[^》]+》的结局)/i);
  const kind = normalizeMarkdownText(markdown.match(/\*\*小说分类：\*\*([^*]+)/)?.[1] || markdown.match(/类\s*别：([^\(\n]+)/)?.[1] || '');
  const latestChapterTitle = firstMarkdownLinkTitle(markdown, /已更新到[\s\S]*?\[([^\]]+)\]\(https?:\/\/www\.ipaoshuba\.net\/Partlist\/\d+\/\d+\.shtml\)/i)
    || firstMarkdownLinkTitle(markdown, /最新连载：\[([^\]]+)\]\(https?:\/\/www\.ipaoshuba\.net\/Partlist\/\d+\/\d+\.shtml\)/i);
  return {
    bookUrl: detailUrl,
    tocUrl: absolutize(tocUrl, detailUrl),
    origin: collectorOrigin(detailUrl),
    originName: rule.name,
    name,
    author,
    coverUrl: absolutize(coverUrl, detailUrl),
    intro: normalizeMarkdownText(introMatch?.[1] || ''),
    kind,
    latestChapterTitle,
  };
}

function extractIpaoshubaChaptersFromMarkdown(html: string): CollectorChapterDraft[] {
  let markdown = markdownContent(html);
  const bodyIndex = markdown.indexOf('**《');
  const bodyMarkerIndex = markdown.indexOf('》正文**', bodyIndex);
  if (bodyMarkerIndex >= 0) markdown = markdown.slice(bodyMarkerIndex + '》正文**'.length);
  const chapters: CollectorChapterDraft[] = [];
  const seen = new Set<string>();
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/www\.ipaoshuba\.net\/Partlist\/\d+\/\d+\.shtml)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(markdown))) {
    const title = normalizeMarkdownText(match[1]);
    const url = text(match[2]);
    if (!title || seen.has(url) || /txt全文下载/i.test(title)) continue;
    seen.add(url);
    chapters.push({ index: chapters.length, title, url });
  }
  return chapters;
}

function extractIpaoshubaContentFromMarkdown(html: string): string {
  const content = markdownContent(html)
    .replace(/^#\s+.*$/gm, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalizeMarkdownText(content).replace(/。\s*/g, '。\n\n').trim();
}

function isKanxiaoshuoRule(input: any): boolean {
  const name = text(input?.name).toLowerCase();
  const entryUrl = text(input?.entryUrl || input?.entry_url || input?.url).toLowerCase();
  return name.includes('kanxiaoshuo123') || name.includes('看小说网') || entryUrl.includes('kanxiaoshuo123.com');
}

function isXqishutaRule(input: any): boolean {
  const name = text(input?.name).toLowerCase();
  const entryUrl = text(input?.entryUrl || input?.entry_url || input?.url).toLowerCase();
  return name.includes('xqishuta') || name.includes('奇书网') || entryUrl.includes('xqishuta.org');
}

const KANXIAOSHUO_CONTENT_RULE = '#chaptercontent@html##<script[\\s\\S]*?</script>####<p>[^<]*最新章节地址[\\s\\S]*?</p>####<p>\\s*本章未完[\\s\\S]*?</p>####<div[^>]*style=["\'][^"\']*text-align:\\s*center[\\s\\S]*$####<div[^>]*class=["\'][^"\']*nr_fy[\\s\\S]*$##';

function normalizeKnownCollectorContentRule(input: any, contentRule: string): string {
  if (!isKanxiaoshuoRule(input)) return contentRule;
  const raw = text(contentRule);
  if (!raw) return raw;
  if (/^#content@html\b/i.test(raw) || /^#chaptercontent@html\b/i.test(raw)) {
    return KANXIAOSHUO_CONTENT_RULE;
  }
  return raw;
}

function normalizeKnownCollectorTocUrlRule(input: any, tocUrlRule: string): string {
  if (!isKanxiaoshuoRule(input)) return tocUrlRule;
  const raw = text(tocUrlRule);
  return raw || 'a:contains("全文目录")@href';
}

function normalizeKnownCollectorChapterListRule(input: any, chapterListRule: string): string {
  const raw = text(chapterListRule);
  if (isXqishutaRule(input) && raw === '#info .pc_list ul li') {
    return '#info .pc_list:last ul li';
  }
  if (isKanxiaoshuoRule(input)) {
    return raw === 'dd' ? 'dl.books_dl dd' : raw;
  }
  return raw;
}

function findKnownCollectorTocUrlFromHtml(input: any, html: string): string {
  if (!isKanxiaoshuoRule(input)) return '';
  const match = String(html || '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*全文目录\s*<\/a>/i);
  return text(match?.[1]);
}

function normalizeCollectorTimeout(input: any): number | undefined {
  const raw = Number(input?.timeoutMs ?? input?.timeout_ms ?? input?.requestTimeoutMs ?? input?.request_timeout_ms);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(1000, Math.min(60000, Math.round(raw)));
  }
  return isIpaoshubaRule(input) ? 30000 : undefined;
}

function absolutize(url: string, baseUrl: string): string {
  const raw = text(url);
  if (!raw) return '';
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function runCollectorRule(ruleText: string, html: string, asList = false): any {
  const raw = text(ruleText);
  if (!raw) return asList ? [] : '';
  const parts = raw.split('##');
  // 不要移除 @text，它是合法的 Legado 规则后缀
  const selector = parts.shift()!;
  let result = executeRule(selector, html, asList);
  if (!asList && parts.length > 0) {
    let value = text(result);
    for (let i = 0; i < parts.length; i += 2) {
      const pattern = parts[i] || '';
      const replacement = parts[i + 1] ?? '';
      if (!pattern) continue;
      try {
        value = value.replace(new RegExp(pattern, 'g'), replacement);
      } catch {
        value = value.split(pattern).join(replacement);
      }
    }
    return value.trim();
  }
  return result;
}

function parseHeaders(headers: CollectorRulePayload['headers']): Record<string, string> {
  if (!headers) return {};
  if (typeof headers === 'object') return headers;
  try {
    const parsed = JSON.parse(headers);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return String(headers)
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .reduce((acc, line) => {
        const idx = line.indexOf(':');
        if (idx > 0) acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        return acc;
      }, {} as Record<string, string>);
  }
}

export function normalizeCollectorRule(input: any): CollectorRulePayload {
  const detailRules = input?.detailRules || input?.detail_rules || {};
  const tocRules = input?.tocRules || input?.toc_rules || {};
  const listRules = input?.listRules || input?.list_rules || {};
  const pagination = input?.pagination || input?.Pagination || {};
  // 兼容旧的 entryUrl 单字符串，自动转为数组
  let entryUrls: string[] = [];
  if (Array.isArray(input?.entryUrls || input?.entry_urls)) {
    entryUrls = (input.entryUrls || input.entry_urls).map((u: any) => text(u)).filter(Boolean);
  }
  const singleEntryUrl = text(input?.entryUrl || input?.entry_url || input?.url || '');
  if (singleEntryUrl && !entryUrls.includes(singleEntryUrl)) {
    entryUrls.unshift(singleEntryUrl);
  }
  // 读取每个网址的独立分页配置
  const rawEntryUrlConfigs = input?.entryUrlConfigs || input?.entry_url_configs || [];
  const entryUrlConfigs: Array<{ startPage: number; endPage: number }> = Array.isArray(rawEntryUrlConfigs)
    ? rawEntryUrlConfigs
        .map((c: any) => ({
          startPage: Math.max(1, Number(c?.startPage ?? c?.start_page ?? 1)),
          endPage: Math.max(1, Number(c?.endPage ?? c?.end_page ?? 1)),
        }))
        .filter((c: any) => c.endPage >= c.startPage)
    : [];
  const result: CollectorRulePayload = {
    ...(input?.id ? { id: Number(input.id) } : {}),
    name: text(input?.name || '未命名采集规则'),
    entryUrl: entryUrls[0] || '',
    entryUrls: entryUrls.length > 0 ? entryUrls : [''],
    enabled: input?.enabled !== false,
    charset: text(input?.charset || 'utf-8'),
    headers: input?.headers || {},
    proxy: text(input?.proxy || input?.requestProxy || input?.request_proxy),
    timeoutMs: normalizeCollectorTimeout(input),
    detailRules: {
      name: text(detailRules.name),
      author: normalizeKnownCollectorAuthorRule(input, text(detailRules.author)),
      coverUrl: text(detailRules.coverUrl || detailRules.cover || detailRules.cover_url),
      intro: text(detailRules.intro),
      tocUrl: normalizeKnownCollectorTocUrlRule(input, text(detailRules.tocUrl || detailRules.toc_url)),
      kind: text(detailRules.kind || detailRules.category),
      latestChapterTitle: text(detailRules.latestChapterTitle || detailRules.latest_chapter_title),
    },
    tocRules: {
      chapterList: normalizeKnownCollectorChapterListRule(input, text(tocRules.chapterList || tocRules.list || tocRules.chapter_list)),
      chapterTitle: text(tocRules.chapterTitle || tocRules.title || tocRules.chapter_title),
      chapterUrl: text(tocRules.chapterUrl || tocRules.url || tocRules.chapter_url),
    },
    contentRule: normalizeKnownCollectorContentRule(input, text(input?.contentRule || input?.content_rule)),
  };
  if (entryUrlConfigs.length > 0) {
    result.entryUrlConfigs = entryUrlConfigs;
  }
  if (text(listRules.bookList)) {
    result.listRules = {
      bookList: text(listRules.bookList),
      bookName: text(listRules.bookName || listRules.book_name),
      bookAuthor: text(listRules.bookAuthor || listRules.book_author),
      bookUrl: text(listRules.bookUrl || listRules.book_url),
      bookCover: text(listRules.bookCover || listRules.book_cover),
      bookLatestChapter: text(listRules.bookLatestChapter || listRules.book_latest_chapter),
      bookKind: text(listRules.bookKind || listRules.book_kind || listRules.category),
    };
  }
  if (text(pagination.pattern)) {
    result.pagination = {
      pattern: text(pagination.pattern),
      startPage: Math.max(1, Number(pagination.startPage ?? pagination.start_page ?? 1)),
      maxPages: Math.min(100, Math.max(1, Number(pagination.maxPages ?? pagination.max_pages ?? 1))),
      increment: Math.max(1, Number(pagination.increment ?? 1)),
    };
    result.listUrl = text(input?.listUrl || input?.list_url || pagination.pattern);
  }
  // 如果 entryUrl 包含分页占位符但未配置 pagination，自动从 entryUrl 推导
  const entryUrl = result.entryUrl;
  if (!result.pagination && /\[page\]|\{page\}/.test(entryUrl)) {
    result.pagination = {
      pattern: entryUrl,
      startPage: Math.max(1, Number(input?.startPage ?? input?.start_page ?? 1)),
      maxPages: Math.min(100, Math.max(1, Number(input?.maxPages ?? input?.max_pages ?? 1))),
      increment: Math.max(1, Number(input?.increment ?? 1)),
    };
    result.listUrl = text(input?.listUrl || input?.list_url || entryUrl);
  }
  return result;
}

export function extractBookByCollectorRule(html: string, detailUrl: string, inputRule: CollectorRulePayload): CollectorBookDraft {
  const rule = normalizeCollectorRule(inputRule);
  if (isIpaoshubaRule(rule) && isJinaMarkdownSnapshot(html)) {
    return extractIpaoshubaBookFromMarkdown(html, detailUrl, rule);
  }
  const extract = (ruleText?: string) => ruleText ? text(runCollectorRule(ruleText, html, false)) : '';
  const name = extract(rule.detailRules.name);
  if (!name) throw new Error('详情页未提取到书名');
  const tocRaw = extract(rule.detailRules.tocUrl) || findKnownCollectorTocUrlFromHtml(rule, html) || detailUrl;
  return {
    bookUrl: detailUrl,
    tocUrl: absolutize(tocRaw, detailUrl),
    origin: collectorOrigin(detailUrl),
    originName: rule.name,
    name,
    author: extract(rule.detailRules.author),
    coverUrl: absolutize(extract(rule.detailRules.coverUrl), detailUrl),
    intro: extract(rule.detailRules.intro),
    kind: extract(rule.detailRules.kind),
    latestChapterTitle: extract(rule.detailRules.latestChapterTitle),
  };
}

export function extractChaptersByCollectorRule(html: string, tocUrl: string, inputRule: CollectorRulePayload): CollectorChapterDraft[] {
  const rule = normalizeCollectorRule(inputRule);
  if (isIpaoshubaRule(rule) && isJinaMarkdownSnapshot(html)) {
    return extractIpaoshubaChaptersFromMarkdown(html);
  }
  if (!rule.tocRules.chapterList || !rule.tocRules.chapterTitle || !rule.tocRules.chapterUrl) return [];
  const $ = cheerio.load(html);
  const nodes = $(rule.tocRules.chapterList).toArray();
  const chapters: CollectorChapterDraft[] = [];
  nodes.forEach((node, index) => {
    const itemHtml = $.html(node) || '';
    const title = text(runCollectorRule(rule.tocRules.chapterTitle, itemHtml, false));
    const url = absolutize(text(runCollectorRule(rule.tocRules.chapterUrl, itemHtml, false)), tocUrl);
    if (title && url) chapters.push({ index, title, url });
  });
  return chapters;
}

export function extractContentByCollectorRule(html: string, inputRule: CollectorRulePayload): string {
  const rule = normalizeCollectorRule(inputRule);
  if (isIpaoshubaRule(rule) && isJinaMarkdownSnapshot(html)) {
    return extractIpaoshubaContentFromMarkdown(html);
  }
  return rule.contentRule ? text(runCollectorRule(rule.contentRule, html, false)) : '';
}

export function collectorOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

async function fetchHtml(url: string, rule: CollectorRulePayload): Promise<string> {
  const parsed = parseSearchUrl(url);

  // 为分页请求添加 Referer（奇书网等网站需要 Referer 才能正确分页）
  const headers = buildHeaders(JSON.stringify(parseHeaders(rule.headers)));
  const pageMatch = parsed.url.match(/index_(\d+)\.html/);
  if (pageMatch && Number(pageMatch[1]) > 1) {
    const referer = parsed.url.replace(/index_\d+\.html/, 'index_1.html');
    headers['Referer'] = referer;
  }

  const html = await requestTargetHtml(parsed.url, headers, {
    ...buildCollectorFetchOptions(rule, parsed.option),
    targetAccessMode: isIpaoshubaRule(rule) ? 'snapshot-first' : 'snapshot-fallback',
  });

  // 检测 Cloudflare 挑战页面，切换到 Puppeteer
  if (isCloudflarePage(html)) {
    console.log(`[fetchHtml] Cloudflare detected for ${parsed.url}, switching to Puppeteer`);
    return fetchHtmlWithPuppeteer(parsed.url, rule);
  }

  return html;
}

export async function fetchCollectorChapterContent(originName: string, chapterUrl: string): Promise<string | null> {
  console.log(`[fetchCollectorChapterContent] originName=${originName}, chapterUrl=${chapterUrl}`);
  const row = await queryOne('SELECT * FROM collector_rules WHERE name=? AND enabled=1 LIMIT 1', [originName]);
  if (!row) {
    console.log(`[fetchCollectorChapterContent] 未找到采集规则: originName=${originName}`);
    return null;
  }
  console.log(`[fetchCollectorChapterContent] 找到规则: id=${row.id}, name=${row.name}`);
  const rule = normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
  if (!rule.contentRule) {
    console.log(`[fetchCollectorChapterContent] 规则无contentRule`);
    return null;
  }
  console.log(`[fetchCollectorChapterContent] contentRule=${rule.contentRule}`);
  const html = await fetchHtml(chapterUrl, rule);
  console.log(`[fetchCollectorChapterContent] 获取HTML长度=${html.length}`);
  const content = extractContentByCollectorRule(html, rule);
  console.log(`[fetchCollectorChapterContent] 提取内容长度=${content?.length || 0}`);
  return content || null;
}

export async function fetchCollectorChapterContentByBook(book: any, chapterUrl: string): Promise<string | null> {
  // 优先按 origin_name 匹配采集规则
  const originName = text(book?.origin_name || book?.originName);
  if (originName) {
    const content = await fetchCollectorChapterContent(originName, chapterUrl);
    if (content) return content;
  }
  // 按 book_url 域名匹配采集规则
  const bookUrl = text(book?.book_url || book?.bookUrl);
  if (bookUrl) {
    const bookOrigin = collectorOrigin(bookUrl);
    if (bookOrigin) {
      const rows = await query('SELECT * FROM collector_rules WHERE enabled=1 ORDER BY updated_at DESC, id DESC');
      for (const row of rows) {
        const rule = normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
        if (collectorOrigin(rule.entryUrl) === bookOrigin && rule.contentRule) {
          console.log(`[fetchCollectorChapterContentByBook] 通过域名匹配规则: id=${row.id}, name=${row.name}`);
          const content = await fetchCollectorChapterContent(row.name as string, chapterUrl);
          if (content) return content;
        }
      }
    }
  }
  return null;
}

export function buildCollectorFetchOptions(rule: CollectorRulePayload, parsedOption: UrlOption = {}): UrlOption {
  const options: UrlOption = {
    ...parsedOption,
    charset: rule.charset || parsedOption.charset || 'utf-8',
    proxy: parsedOption.proxy || rule.proxy,
    timeoutMs: parsedOption.timeoutMs || rule.timeoutMs,
  };
  if (parsedOption.retry !== undefined) {
    options.retry = parsedOption.retry;
  } else if (isIpaoshubaRule(rule)) {
    options.retry = 0;
  }
  return options;
}

export async function listCollectorRules() {
  return query('SELECT * FROM collector_rules ORDER BY updated_at DESC, id DESC');
}

export async function saveCollectorRule(input: any) {
  const rule = normalizeCollectorRule(input);
  if (!rule.entryUrl && (!rule.entryUrls || rule.entryUrls.length === 0 || !rule.entryUrls[0])) {
    throw new Error('请填写单本详情页地址');
  }
  // 确保 entryUrlConfigs 被保留在 ruleJson 中
  if (Array.isArray(input?.entryUrlConfigs)) {
    rule.entryUrlConfigs = input.entryUrlConfigs.map((c: any) => ({
      startPage: Math.max(1, Number(c?.startPage ?? 1)),
      endPage: Math.max(1, Number(c?.endPage ?? 1)),
    }));
  }
  const primaryUrl = rule.entryUrls[0] || rule.entryUrl || '';
  const payload = JSON.stringify(rule);
  if (rule.id) {
    // 检查记录是否存在，存在则更新，不存在则插入（忽略传入的 id）
    const existing = await queryOne('SELECT id FROM collector_rules WHERE id=?', [rule.id]);
    if (existing) {
      await execute(
        'UPDATE collector_rules SET name=?, entry_url=?, enabled=?, rule_json=?, updated_at=NOW() WHERE id=?',
        [rule.name, primaryUrl, rule.enabled ? 1 : 0, payload, rule.id]
      );
      return queryOne('SELECT * FROM collector_rules WHERE id=?', [rule.id]);
    }
  }
  const result = await execute(
    'INSERT INTO collector_rules (name, entry_url, enabled, rule_json) VALUES (?, ?, ?, ?)',
    [rule.name, primaryUrl, rule.enabled ? 1 : 0, payload]
  );
  return queryOne('SELECT * FROM collector_rules WHERE id=?', [result.insertId]);
}

export async function deleteCollectorRule(id: number) {
  await execute('DELETE FROM collector_rules WHERE id=?', [id]);
}

export async function getCollectorRule(id: number): Promise<CollectorRulePayload> {
  const row = await queryOne('SELECT * FROM collector_rules WHERE id=?', [id]);
  if (!row) throw new Error('采集规则不存在');
  return normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
}

export async function importCollectorRules(payload: any): Promise<{ success: number; fail: number; rules: any[]; errors: string[] }> {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.rules) ? payload.rules : [payload];
  const rules: any[] = [];
  const errors: string[] = [];
  let fail = 0;
  for (const [index, item] of items.entries()) {
    try {
      rules.push(await saveCollectorRule(item));
    } catch (error) {
      fail++;
      errors.push(`第 ${index + 1} 条：${error instanceof Error ? error.message : '导入失败'}`);
    }
  }
  return { success: rules.length, fail, rules, errors };
}

export async function exportCollectorRules(): Promise<CollectorRulePayload[]> {
  const rows = await listCollectorRules();
  return rows.map(row => normalizeCollectorRule(JSON.parse(row.rule_json || '{}')));
}

export function buildCollectorRunRule(rule: CollectorRulePayload, options: CollectorRunOptions = {}): CollectorRulePayload {
  const entryUrl = text(options.entryUrl || '');
  return entryUrl ? { ...rule, entryUrl } : { ...rule };
}

export function buildCollectorUpdateCheck(input: {
  localChapterCount: number;
  remoteChapterCount: number;
  ruleName: string;
}): CollectorUpdateCheckResult {
  const localChapterCount = Math.max(0, Number(input.localChapterCount || 0));
  const remoteChapterCount = Math.max(0, Number(input.remoteChapterCount || 0));
  const canUpdate = remoteChapterCount > localChapterCount;
  return {
    canUpdate,
    localChapterCount,
    remoteChapterCount,
    ruleName: input.ruleName || '',
    message: canUpdate
      ? `检测到目标站有更多章节：本地 ${localChapterCount} 章，目标站 ${remoteChapterCount} 章`
      : '本地章节已是最新',
  };
}

export interface CollectorTestResult {
  rule: { name: string; entryUrl: string };
  detail: {
    ok: boolean;
    url: string;
    htmlLength: number;
    book?: CollectorBookDraft;
    error?: string;
  };
  toc: {
    ok: boolean;
    url: string;
    htmlLength: number;
    chapterCount: number;
    chapters: CollectorChapterDraft[];
    error?: string;
  };
  content: {
    ok: boolean;
    url: string;
    htmlLength: number;
    length: number;
    preview?: string;
    error?: string;
  };
  imported: false;
}

const PREVIEW_CHAPTER_LIMIT = 5;
const CONTENT_PREVIEW_LENGTH = 400;

function formatCollectorFetchError(error: unknown): string {
  const anyError = error as any;
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const code = String(anyError?.code || '');
  if (code === 'ECONNABORTED' || /timeout/i.test(rawMessage)) {
    return `详情页请求失败：目标站访问超时（${rawMessage || code}）。如果本地可访问但线上超时，通常是目标站屏蔽服务器 IP 或网络链路过慢。`;
  }
  if (code) {
    return `详情页请求失败：${code}${rawMessage ? `，${rawMessage}` : ''}`;
  }
  return `详情页请求失败：${rawMessage || '目标站无法访问'}`;
}

export function buildCollectorTestFetchError(
  inputRule: CollectorRulePayload,
  error: unknown,
  stage: 'detail' | 'toc' | 'content' = 'detail'
): CollectorTestResult {
  const rule = normalizeCollectorRule(inputRule);
  const result: CollectorTestResult = {
    rule: { name: rule.name, entryUrl: rule.entryUrl },
    detail: { ok: false, url: rule.entryUrl, htmlLength: 0 },
    toc: { ok: false, url: '', htmlLength: 0, chapterCount: 0, chapters: [] },
    content: { ok: false, url: '', htmlLength: 0, length: 0 },
    imported: false,
  };
  const message = formatCollectorFetchError(error);
  if (stage === 'detail') {
    result.detail.error = message;
  } else if (stage === 'toc') {
    result.detail.ok = true;
    result.toc.error = message;
  } else {
    result.detail.ok = true;
    result.content.error = message;
  }
  return result;
}

export function testCollectorRuleFromHtml(
  inputRule: CollectorRulePayload,
  pages: { detailHtml: string; tocHtml?: string; contentHtml?: string },
  context: { detailUrl?: string; tocUrl?: string; contentUrl?: string } = {}
): CollectorTestResult {
  const rule = normalizeCollectorRule(inputRule);
  const detailUrl = context.detailUrl || rule.entryUrl;
  const result: CollectorTestResult = {
    rule: { name: rule.name, entryUrl: rule.entryUrl },
    detail: { ok: false, url: detailUrl, htmlLength: pages.detailHtml.length },
    toc: { ok: false, url: '', htmlLength: 0, chapterCount: 0, chapters: [] },
    content: { ok: false, url: '', htmlLength: 0, length: 0 },
    imported: false,
  };

  let book: CollectorBookDraft | undefined;
  try {
    book = extractBookByCollectorRule(pages.detailHtml, detailUrl, rule);
    result.detail.ok = true;
    result.detail.book = book;
  } catch (error) {
    result.detail.error = error instanceof Error ? error.message : '详情页提取失败';
    return result;
  }

  const tocUrl = context.tocUrl || book.tocUrl || detailUrl;
  result.toc.url = tocUrl;
  const tocHtml = pages.tocHtml ?? (tocUrl === detailUrl ? pages.detailHtml : '');
  result.toc.htmlLength = tocHtml.length;
  if (!rule.tocRules.chapterList) {
    result.toc.error = '未配置章节列表规则';
  } else if (!tocHtml) {
    result.toc.error = '缺少目录页 HTML';
  } else {
    try {
      const chapters = extractChaptersByCollectorRule(tocHtml, tocUrl, rule);
      result.toc.chapterCount = chapters.length;
      result.toc.chapters = chapters.slice(0, PREVIEW_CHAPTER_LIMIT);
      result.toc.ok = chapters.length > 0;
      if (chapters.length === 0) result.toc.error = '目录页未提取到任何章节';
    } catch (error) {
      result.toc.error = error instanceof Error ? error.message : '目录提取失败';
    }
  }

  const firstChapterUrl = result.toc.chapters[0]?.url || '';
  const contentUrl = context.contentUrl || firstChapterUrl;
  result.content.url = contentUrl;
  const contentHtml = pages.contentHtml ?? '';
  result.content.htmlLength = contentHtml.length;
  if (!rule.contentRule) {
    result.content.error = '未配置正文规则';
  } else if (!contentHtml) {
    result.content.error = '缺少正文页 HTML';
  } else {
    try {
      const content = extractContentByCollectorRule(contentHtml, rule);
      result.content.length = content.length;
      result.content.preview = content.slice(0, CONTENT_PREVIEW_LENGTH);
      result.content.ok = content.trim().length > 0;
      if (!result.content.ok) result.content.error = '正文页未提取到内容';
    } catch (error) {
      result.content.error = error instanceof Error ? error.message : '正文提取失败';
    }
  }

  return result;
}

export interface CollectorListTestResult {
  ok: boolean;
  url: string;
  htmlLength: number;
  bookCount: number;
  books: Array<{ name: string; author: string; bookUrl: string; coverUrl: string; latestChapterTitle: string; kind: string }>;
  error?: string;
}

export async function testCollectorListPage(ruleId: number, listUrl: string): Promise<CollectorListTestResult> {
  const baseRule = await getCollectorRule(ruleId);
  const rule = normalizeCollectorRule(baseRule);
  if (!listUrl) throw new Error('请填写列表页地址');
  if (!rule.listRules?.bookList) throw new Error('未配置列表页规则');

  let listHtml = '';
  try {
    listHtml = await fetchHtml(listUrl, rule);
  } catch (error) {
    return {
      ok: false,
      url: listUrl,
      htmlLength: 0,
      bookCount: 0,
      books: [],
      error: error instanceof Error ? error.message : String(error || '列表页请求失败'),
    };
  }

  const books = extractBookListByCollectorRule(listHtml, listUrl, rule);
  return {
    ok: books.length > 0,
    url: listUrl,
    htmlLength: listHtml.length,
    bookCount: books.length,
    books: books.slice(0, 10),
    error: books.length === 0 ? '未从列表页提取到任何书籍，请检查列表页规则（bookList 选择器是否匹配到节点、bookName/bookUrl 是否正确，或尝试不填写 bookUrl 让系统自动提取）' : undefined,
  };
}

export async function testCollectorRule(
  ruleId: number,
  options: { entryUrl?: string } = {}
): Promise<CollectorTestResult> {
  const baseRule = await getCollectorRule(ruleId);
  const rule = buildCollectorRunRule(baseRule, options);
  if (!rule.entryUrl) throw new Error('请填写单本详情页地址');
  let detailHtml = '';
  try {
    detailHtml = await fetchHtml(rule.entryUrl, rule);
  } catch (error) {
    return buildCollectorTestFetchError(rule, error, 'detail');
  }
  let tocHtml: string | undefined;
  let contentHtml: string | undefined;
  let tocUrl = rule.entryUrl;
  let contentUrl = '';
  try {
    const book = extractBookByCollectorRule(detailHtml, rule.entryUrl, rule);
    tocUrl = book.tocUrl || rule.entryUrl;
    tocHtml = tocUrl === rule.entryUrl ? detailHtml : await fetchHtml(tocUrl, rule).catch(() => '');
    if (rule.tocRules.chapterList && tocHtml) {
      const chapters = extractChaptersByCollectorRule(tocHtml, tocUrl, rule);
      const first = chapters[0];
      if (first?.url && rule.contentRule) {
        contentUrl = first.url;
        contentHtml = await fetchHtml(first.url, rule).catch(() => '');
      }
    }
  } catch {
    // detail extraction error is captured inside testCollectorRuleFromHtml
  }
  return testCollectorRuleFromHtml(
    rule,
    { detailHtml, tocHtml, contentHtml },
    { detailUrl: rule.entryUrl, tocUrl, contentUrl }
  );
}

export async function getCollectorRuleForBook(book: any): Promise<{ id: number; rule: CollectorRulePayload } | null> {
  const originName = text(book?.origin_name || book?.originName);
  if (originName) {
    const row = await queryOne('SELECT * FROM collector_rules WHERE name=? AND enabled=1 LIMIT 1', [originName]);
    if (row) return { id: Number(row.id), rule: normalizeCollectorRule(JSON.parse(row.rule_json || '{}')) };
  }

  const rows = await query('SELECT * FROM collector_rules WHERE enabled=1 ORDER BY updated_at DESC, id DESC');
  const bookOrigin = collectorOrigin(text(book?.book_url || book?.bookUrl || book?.toc_url || book?.tocUrl));
  for (const row of rows) {
    const rule = normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
    if (bookOrigin && collectorOrigin(rule.entryUrl) === bookOrigin) {
      return { id: Number(row.id), rule };
    }
  }
  return null;
}

export async function fetchCollectorChaptersForBook(book: any, rule: CollectorRulePayload) {
  const entryUrl = text(book?.book_url || book?.bookUrl || rule.entryUrl);
  const runRule = buildCollectorRunRule(rule, { entryUrl });
  const detailHtml = await fetchHtml(runRule.entryUrl, runRule);
  const remoteBook = extractBookByCollectorRule(detailHtml, runRule.entryUrl, runRule);
  const tocHtml = remoteBook.tocUrl === runRule.entryUrl ? detailHtml : await fetchHtml(remoteBook.tocUrl, runRule);
  const chapters = normalizeCollectorChaptersForUpdate(extractChaptersByCollectorRule(tocHtml, remoteBook.tocUrl, runRule));
  return { book: remoteBook, chapters };
}

export function normalizeCollectorChaptersForUpdate(chapters: CollectorChapterDraft[]): CollectorChapterDraft[] {
  return normalizeChapterList(chapters, { dedupeTitle: false }).map((chapter, index) => ({
    ...chapter,
    index,
  }));
}

export async function checkCollectorBookUpdate(bookUrl: string): Promise<CollectorUpdateCheckResult> {
  const book = await queryOne('SELECT * FROM books WHERE book_url=?', [bookUrl]);
  if (!book) throw new Error('书籍不存在');
  const matched = await getCollectorRuleForBook(book);
  if (!matched) {
    return buildCollectorUpdateCheck({
      localChapterCount: 0,
      remoteChapterCount: 0,
      ruleName: '',
    });
  }
  const localRow = await queryOne('SELECT COUNT(*) AS count FROM book_chapters WHERE book_url=?', [bookUrl]);
  const localChapterCount = Number(localRow?.count || 0);
  const remote = await fetchCollectorChaptersForBook(book, matched.rule);
  return buildCollectorUpdateCheck({
    localChapterCount,
    remoteChapterCount: remote.chapters.length,
    ruleName: matched.rule.name,
  });
}

export async function updateCollectorBookToLatest(bookUrl: string): Promise<CollectorRunResult> {
  const bookRow = await queryOne('SELECT * FROM books WHERE book_url=?', [bookUrl]);
  if (!bookRow) throw new Error('书籍不存在');
  const matched = await getCollectorRuleForBook(bookRow);
  if (!matched) throw new Error('未找到该本地书对应的采集规则');
  const remote = await fetchCollectorChaptersForBook(bookRow, matched.rule);
  const importBook = buildCollectorUpdateImportBook(bookUrl, remote.book);
  await importCollectedBook(importBook, remote.chapters);
  await execute(
    'INSERT INTO collector_logs (rule_id, status, message, book_name, chapter_count, content_count) VALUES (?, ?, ?, ?, ?, ?)',
    [matched.id, 'success', '手动更新到最新章节完成', remote.book.name, remote.chapters.length, 0]
  );
  return {
    book: importBook,
    chapters: remote.chapters,
    imported: true,
    chapterCount: remote.chapters.length,
    contentCount: 0,
  };
}

export function buildCollectorUpdateImportBook(currentBookUrl: string, remoteBook: CollectorBookDraft): CollectorBookDraft {
  return {
    ...remoteBook,
    bookUrl: text(currentBookUrl) || remoteBook.bookUrl,
  };
}

export function resolveCollectorMaxChapters(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.max(1, Math.round(raw));
}

export interface CollectorListItem {
  name: string;
  author: string;
  bookUrl: string;
  coverUrl: string;
  latestChapterTitle: string;
  kind: string;
}

export interface CollectorBatchResult {
  totalPages: number;
  totalBooks: number;
  successBooks: number;
  failedBooks: number;
  skippedBooks: number;
  results: Array<{
    page: number;
    pageUrl: string;
    bookName: string;
    bookUrl: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    chapterCount?: number;
  }>;
}

function buildPageUrl(pattern: string, page: number): string {
  return pattern.replace(/\{page\}/g, String(page)).replace(/\[page\]/g, String(page));
}

export function extractBookListByCollectorRule(html: string, listUrl: string, inputRule: CollectorRulePayload): CollectorListItem[] {
  const rule = normalizeCollectorRule(inputRule);
  if (!rule.listRules?.bookList) return [];
  const $ = cheerio.load(html);
  const nodes = $(rule.listRules.bookList).toArray();
  const books: CollectorListItem[] = [];
  const seen = new Set<string>();

  nodes.forEach((node) => {
    const itemHtml = $.html(node) || '';
    const $node = $(node);

    // 优先使用 listRules 中的配置，如果没有则复用 detailRules
    const nameSelector = rule.listRules.bookName || rule.detailRules.name;
    const urlSelector = rule.listRules.bookUrl || rule.detailRules.tocUrl;
    const authorSelector = rule.listRules.bookAuthor || rule.detailRules.author;
    const coverSelector = rule.listRules.bookCover || rule.detailRules.coverUrl;
    const latestSelector = rule.listRules.bookLatestChapter || rule.detailRules.latestChapterTitle;
    const kindSelector = rule.listRules.bookKind || rule.detailRules.kind;

    let name = nameSelector ? text(runCollectorRule(nameSelector, itemHtml, false)) : '';
    let url = urlSelector ? absolutize(text(runCollectorRule(urlSelector, itemHtml, false)), listUrl) : '';

    // 自动回退：从节点本身或其子 <a> 标签中提取书名和链接
    const tagName = $node.prop('tagName')?.toLowerCase() || '';
    const $a = tagName === 'a' ? $node : $node.find('a').first();

    if (!name && $a.length) {
      name = $a.text().trim();
    }
    if (!url && $a.length) {
      const href = $a.attr('href');
      if (href) url = absolutize(href, listUrl);
    }

    if (!name || !url || seen.has(url)) return;
    seen.add(url);
    const author = authorSelector ? text(runCollectorRule(authorSelector, itemHtml, false)) : '';
    const coverUrl = coverSelector ? absolutize(text(runCollectorRule(coverSelector, itemHtml, false)), listUrl) : '';
    const latestChapterTitle = latestSelector ? text(runCollectorRule(latestSelector, itemHtml, false)) : '';
    const kind = kindSelector ? text(runCollectorRule(kindSelector, itemHtml, false)) : '';
    books.push({ name, author, bookUrl: url, coverUrl, latestChapterTitle, kind });
  });
  return books;
}

export interface CollectorBatchProgress {
  type: 'progress' | 'book' | 'done' | 'error';
  totalPages?: number;
  currentPage?: number;
  totalBooks?: number;
  successBooks?: number;
  failedBooks?: number;
  skippedBooks?: number;
  maxBooks?: number;
  bookName?: string;
  bookUrl?: string;
  bookStatus?: 'success' | 'failed' | 'skipped' | 'collecting';
  chapterCount?: number;
  error?: string;
}

export async function runBatchCollector(
  ruleId: number,
  options: { maxBooks?: number; startPage?: number; maxPages?: number; includeContent?: boolean; maxChapters?: number; resume?: boolean; entryUrlConfigs?: Array<{ startPage: number; endPage: number }> } = {},
  onProgress?: (progress: CollectorBatchProgress) => void
): Promise<CollectorBatchResult> {
  const baseRule = await getCollectorRule(ruleId);
  const rule = normalizeCollectorRule(baseRule);
  if (!rule.listRules || !rule.pagination) throw new Error('该规则未配置列表页规则或分页规则，无法进行批量采集');

  // 允许运行时通过 options 覆盖 entryUrlConfigs
  if (options.entryUrlConfigs && Array.isArray(options.entryUrlConfigs)) {
    rule.entryUrlConfigs = options.entryUrlConfigs.map((c: any) => ({
      startPage: Math.max(1, Number(c.startPage ?? 1)),
      endPage: Math.max(1, Number(c.endPage ?? 1)),
    }));
  }

  const result: CollectorBatchResult = {
    totalPages: 0,
    totalBooks: 0,
    successBooks: 0,
    failedBooks: 0,
    skippedBooks: 0,
    results: [],
  };

  const maxBooks = options.maxBooks ? Math.max(1, Math.round(Number(options.maxBooks))) : undefined;
  const seenUrls = new Set<string>();

  // 确定要处理的 entryUrls
  const entryUrls = (rule.entryUrls && rule.entryUrls.length > 0 && rule.entryUrls[0])
    ? rule.entryUrls
    : [rule.entryUrl];

  async function updateLastProgress(urlIndex: number, currentPage: number) {
    const rawRow = await queryOne('SELECT last_progress FROM collector_rules WHERE id=?', [ruleId]);
    let progress: any = {};
    try {
      if (rawRow?.last_progress) {
        progress = JSON.parse(rawRow.last_progress);
      }
    } catch {
      progress = {};
    }
    if (!progress.perUrl || !Array.isArray(progress.perUrl)) {
      progress = { perUrl: [] };
    }
    const url = entryUrls[urlIndex];
    const existing = progress.perUrl.find((p: any) => p.url === url);
    if (existing) {
      existing.page = currentPage;
      existing.seenUrls = Array.from(seenUrls);
    } else {
      progress.perUrl.push({ url, page: currentPage, seenUrls: Array.from(seenUrls) });
    }
    await execute(
      'UPDATE collector_rules SET last_progress=? WHERE id=?',
      [JSON.stringify(progress), ruleId]
    );
  }

  async function clearLastProgress() {
    await execute('UPDATE collector_rules SET last_progress=NULL WHERE id=?', [ruleId]);
  }

  // 断点续采：检查是否有上次进度
  let perUrlProgress: Array<{ url: string; page: number; seenUrls: string[] }> = [];
  if (options.resume) {
    const rawRow = await queryOne('SELECT last_progress FROM collector_rules WHERE id=?', [ruleId]);
    if (rawRow?.last_progress) {
      try {
        const progress = JSON.parse(rawRow.last_progress);
        if (Array.isArray(progress.perUrl)) {
          perUrlProgress = progress.perUrl;
        } else if (progress.page && typeof progress.page === 'number') {
          // 兼容旧格式：仅对第一个 entryUrl 生效
          perUrlProgress = [{ url: entryUrls[0], page: progress.page, seenUrls: progress.seenUrls || [] }];
        }
        // 恢复全局 seenUrls
        for (const p of perUrlProgress) {
          if (Array.isArray(p.seenUrls)) {
            for (const url of p.seenUrls) seenUrls.add(url);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  for (let urlIndex = 0; urlIndex < entryUrls.length; urlIndex++) {
    if (result.totalBooks >= maxBooks) break;

    const entryUrl = entryUrls[urlIndex];
    const hasPagePlaceholder = /\[page\]|\{page\}/.test(entryUrl);

    const urlConfig = rule.entryUrlConfigs?.[urlIndex];
    let startPage = options.startPage ?? urlConfig?.startPage ?? rule.pagination.startPage;
    const urlMaxPages = urlConfig?.endPage
      ? Math.max(1, urlConfig.endPage - startPage + 1)
      : (options.maxPages ?? rule.pagination.maxPages);

    // 断点续采：恢复该网址的进度
    if (options.resume) {
      const saved = perUrlProgress.find(p => p.url === entryUrl);
      if (saved?.page && typeof saved.page === 'number') {
        startPage = saved.page;
        onProgress?.({ type: 'progress', totalPages: result.totalPages, currentPage: startPage, totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks });
      }
    }

    if (hasPagePlaceholder) {
      const pattern = entryUrl;

      for (let pageIndex = 0; pageIndex < urlMaxPages; pageIndex++) {
        const page = startPage + pageIndex * rule.pagination.increment;
        const pageUrl = buildPageUrl(pattern, page);

        let listHtml: string;
        try {
          listHtml = await fetchHtml(pageUrl, rule);
        } catch (error) {
          result.results.push({
            page, pageUrl, bookName: '', bookUrl: '', status: 'failed',
            error: `列表页请求失败: ${error instanceof Error ? error.message : String(error)}`,
          });
          break;
        }

        const books = extractBookListByCollectorRule(listHtml, pageUrl, rule);
        if (books.length === 0) break;

        result.totalPages++;
        onProgress?.({ type: 'progress', totalPages: result.totalPages, currentPage: page, totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks });

        for (const bookItem of books) {
          if (result.totalBooks >= maxBooks) break;

          // 跨页 URL 去重
          if (seenUrls.has(bookItem.bookUrl)) continue;
          seenUrls.add(bookItem.bookUrl);

          result.totalBooks++;

          // 检查数据库是否已存在且章节未更新
          const existing = await queryOne('SELECT total_chapter_num, latest_chapter_title FROM books WHERE book_url=?', [bookItem.bookUrl]);
          if (existing && text(existing.latest_chapter_title) === bookItem.latestChapterTitle && Number(existing.total_chapter_num) > 0) {
            result.skippedBooks++;
            result.results.push({ page, pageUrl, bookName: bookItem.name, bookUrl: bookItem.bookUrl, status: 'skipped' });
            onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'skipped' });
            continue;
          }

          onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'collecting' });

          try {
            const runRule = buildCollectorRunRule(rule, { entryUrl: bookItem.bookUrl });
            const detailHtml = await fetchHtml(runRule.entryUrl, runRule);
            const book = extractBookByCollectorRule(detailHtml, runRule.entryUrl, runRule);
            const tocHtml = book.tocUrl === runRule.entryUrl ? detailHtml : await fetchHtml(book.tocUrl, runRule);
            const maxChapters = resolveCollectorMaxChapters(options.maxChapters);
            const chapters = extractChaptersByCollectorRule(tocHtml, book.tocUrl, runRule).slice(0, maxChapters || undefined);

            if (options.includeContent && runRule.contentRule) {
              for (const chapter of chapters) {
                try {
                  chapter.content = extractContentByCollectorRule(await fetchHtml(chapter.url, runRule), runRule);
                } catch {
                  chapter.content = '';
                }
              }
            }

            await importCollectedBook(book, chapters);
            result.successBooks++;
            result.results.push({ page, pageUrl, bookName: book.name, bookUrl: book.bookUrl, status: 'success', chapterCount: chapters.length });
            onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: book.name, bookUrl: book.bookUrl, bookStatus: 'success', chapterCount: chapters.length });
          } catch (error) {
            result.failedBooks++;
            result.results.push({
              page, pageUrl, bookName: bookItem.name, bookUrl: bookItem.bookUrl, status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            });
            onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'failed', error: error instanceof Error ? error.message : String(error) });
          }

          // 每本书之间延迟 5-10 秒，避免触发 Cloudflare
          const bookDelay = 5000 + Math.floor(Math.random() * 5000);
          await new Promise(r => setTimeout(r, bookDelay));
        }

        // 每页处理完后更新断点进度
        await updateLastProgress(urlIndex, page + rule.pagination.increment);

        if (result.totalBooks >= maxBooks) break;
        // 每页之间延迟 5-10 秒
        const pageDelay = 5000 + Math.floor(Math.random() * 5000);
        await new Promise(r => setTimeout(r, pageDelay));
      }
    } else {
      // 无分页占位符，只采集单页
      let listHtml: string;
      try {
        listHtml = await fetchHtml(entryUrl, rule);
      } catch (error) {
        result.results.push({
          page: 1, pageUrl: entryUrl, bookName: '', bookUrl: '', status: 'failed',
          error: `列表页请求失败: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }

      const books = extractBookListByCollectorRule(listHtml, entryUrl, rule);
      if (books.length === 0) continue;

      result.totalPages++;
      onProgress?.({ type: 'progress', totalPages: result.totalPages, currentPage: 1, totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks });

      for (const bookItem of books) {
        if (result.totalBooks >= maxBooks) break;

        if (seenUrls.has(bookItem.bookUrl)) continue;
        seenUrls.add(bookItem.bookUrl);

        result.totalBooks++;

        const existing = await queryOne('SELECT total_chapter_num, latest_chapter_title FROM books WHERE book_url=?', [bookItem.bookUrl]);
        if (existing && text(existing.latest_chapter_title) === bookItem.latestChapterTitle && Number(existing.total_chapter_num) > 0) {
          result.skippedBooks++;
          result.results.push({ page: 1, pageUrl: entryUrl, bookName: bookItem.name, bookUrl: bookItem.bookUrl, status: 'skipped' });
          onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'skipped' });
          continue;
        }

        onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'collecting' });

        try {
          const runRule = buildCollectorRunRule(rule, { entryUrl: bookItem.bookUrl });
          const detailHtml = await fetchHtml(runRule.entryUrl, runRule);
          const book = extractBookByCollectorRule(detailHtml, runRule.entryUrl, runRule);
          const tocHtml = book.tocUrl === runRule.entryUrl ? detailHtml : await fetchHtml(book.tocUrl, runRule);
          const maxChapters = resolveCollectorMaxChapters(options.maxChapters);
          const chapters = extractChaptersByCollectorRule(tocHtml, book.tocUrl, runRule).slice(0, maxChapters || undefined);

          if (options.includeContent && runRule.contentRule) {
            for (const chapter of chapters) {
              try {
                chapter.content = extractContentByCollectorRule(await fetchHtml(chapter.url, runRule), runRule);
              } catch {
                chapter.content = '';
              }
            }
          }

          await importCollectedBook(book, chapters);
          result.successBooks++;
          result.results.push({ page: 1, pageUrl: entryUrl, bookName: book.name, bookUrl: book.bookUrl, status: 'success', chapterCount: chapters.length });
          onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: book.name, bookUrl: book.bookUrl, bookStatus: 'success', chapterCount: chapters.length });
        } catch (error) {
          result.failedBooks++;
          result.results.push({
            page: 1, pageUrl: entryUrl, bookName: bookItem.name, bookUrl: bookItem.bookUrl, status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
          onProgress?.({ type: 'book', totalBooks: result.totalBooks, successBooks: result.successBooks, failedBooks: result.failedBooks, skippedBooks: result.skippedBooks, maxBooks, bookName: bookItem.name, bookUrl: bookItem.bookUrl, bookStatus: 'failed', error: error instanceof Error ? error.message : String(error) });
        }

        // 每本书之间延迟 5-10 秒
        const bookDelay2 = 5000 + Math.floor(Math.random() * 5000);
        await new Promise(r => setTimeout(r, bookDelay2));
      }
    }
  }

  // 采集完成后清除断点进度
  await clearLastProgress();

  await execute(
    'INSERT INTO collector_logs (rule_id, status, message, book_name, chapter_count, content_count) VALUES (?, ?, ?, ?, ?, ?)',
    [ruleId, 'success', `批量采集完成: 共${result.totalPages}页, ${result.totalBooks}本, 成功${result.successBooks}, 失败${result.failedBooks}, 跳过${result.skippedBooks}`, '', result.totalBooks, result.successBooks]
  );

  return result;
}

export async function runSingleBookCollector(ruleId: number, options: CollectorRunOptions = {}): Promise<CollectorRunResult> {
  const rule = buildCollectorRunRule(await getCollectorRule(ruleId), options);
  const detailHtml = await fetchHtml(rule.entryUrl, rule);
  const book = extractBookByCollectorRule(detailHtml, rule.entryUrl, rule);
  const tocHtml = book.tocUrl === rule.entryUrl ? detailHtml : await fetchHtml(book.tocUrl, rule);
  const maxChapters = resolveCollectorMaxChapters(options.maxChapters);
  const chapters = extractChaptersByCollectorRule(tocHtml, book.tocUrl, rule).slice(0, maxChapters || undefined);
  let contentCount = 0;
  if (options.includeContent && rule.contentRule) {
    for (const chapter of chapters) {
      try {
        chapter.content = extractContentByCollectorRule(await fetchHtml(chapter.url, rule), rule);
        if (chapter.content) contentCount++;
      } catch {
        chapter.content = '';
      }
    }
  }

  await importCollectedBook(book, chapters);
  await execute(
    'INSERT INTO collector_logs (rule_id, status, message, book_name, chapter_count, content_count) VALUES (?, ?, ?, ?, ?, ?)',
    [ruleId, 'success', '单本采集完成', book.name, chapters.length, contentCount]
  );
  return { book, chapters, imported: true, chapterCount: chapters.length, contentCount };
}

export async function getCollectorSchedule(ruleId: number) {
  const row = await queryOne('SELECT * FROM collector_schedules WHERE rule_id=?', [ruleId]);
  if (!row) return null;
  return {
    id: row.id,
    ruleId: row.rule_id,
    cron: row.cron,
    maxBooks: row.max_books,
    maxPages: row.max_pages,
    enabled: !!row.enabled,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveCollectorSchedule(input: any) {
  const ruleId = Number(input.ruleId);
  const cron = String(input.cron || '').trim();
  const maxBooks = Number(input.maxBooks ?? 50);
  const maxPages = Number(input.maxPages ?? 10);
  const enabled = input.enabled !== false ? 1 : 0;
  if (!ruleId) throw new Error('规则ID不能为空');
  if (!cron) throw new Error('Cron表达式不能为空');
  const existing = await queryOne('SELECT id FROM collector_schedules WHERE rule_id=?', [ruleId]);
  if (existing) {
    await execute(
      'UPDATE collector_schedules SET cron=?, max_books=?, max_pages=?, enabled=?, updated_at=NOW() WHERE id=?',
      [cron, maxBooks, maxPages, enabled, existing.id]
    );
    const row = await queryOne('SELECT * FROM collector_schedules WHERE id=?', [existing.id]);
    // 立即刷新调度器
    try { await refreshSchedulesNow(); } catch {}
    return row;
  }
  const result = await execute(
    'INSERT INTO collector_schedules (rule_id, cron, max_books, max_pages, enabled) VALUES (?, ?, ?, ?, ?)',
    [ruleId, cron, maxBooks, maxPages, enabled]
  );
  const row = await queryOne('SELECT * FROM collector_schedules WHERE id=?', [result.insertId]);
  // 立即刷新调度器
  try { await refreshSchedulesNow(); } catch {}
  return row;
}

export async function deleteCollectorSchedule(id: number) {
  await execute('DELETE FROM collector_schedules WHERE id=?', [id]);
  // 立即刷新调度器
  try { await refreshSchedulesNow(); } catch {}
}

export async function listCollectorSchedules() {
  return query('SELECT * FROM collector_schedules WHERE enabled=1');
}

export async function importCollectedBook(book: CollectorBookDraft, chapters: CollectorChapterDraft[]) {
  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO books
        (book_url, toc_url, origin, origin_name, name, author, kind, cover_url, intro, total_chapter_num, latest_chapter_title, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE toc_url=VALUES(toc_url), origin=VALUES(origin), origin_name=VALUES(origin_name),
         name=VALUES(name), author=VALUES(author), kind=VALUES(kind), cover_url=VALUES(cover_url), intro=VALUES(intro),
         total_chapter_num=VALUES(total_chapter_num), latest_chapter_title=VALUES(latest_chapter_title), type=1, updated_at=NOW()`,
      [book.bookUrl, book.tocUrl, book.origin, book.originName, book.name, book.author, book.kind, book.coverUrl, book.intro, chapters.length, book.latestChapterTitle || chapters.at(-1)?.title || '']
    );
    for (const chapter of chapters) {
      await conn.execute(
        `INSERT INTO book_chapters (book_url, chapter_index, title, url)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), url=VALUES(url)`,
        [book.bookUrl, chapter.index, chapter.title, chapter.url]
      );
    }
  });
}
