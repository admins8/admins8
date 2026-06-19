import { execute, query, queryOne, transaction } from '../config/database';
import { executeRule } from './ruleExecutor';
import * as cheerio from 'cheerio';
import { buildHeaders, parseSearchUrl, UrlOption } from './bookSourceHttpClient';
import { normalizeChapterList } from './chapterListNormalizer';
import { requestTargetHtml } from './targetAccess';

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

export interface CollectorRulePayload {
  id?: number;
  name: string;
  entryUrl: string;
  enabled?: boolean;
  charset?: string;
  headers?: Record<string, string> | string;
  proxy?: string;
  timeoutMs?: number;
  detailRules: CollectorDetailRules;
  tocRules: CollectorTocRules;
  contentRule: string;
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
  const selector = parts.shift()!.replace(/@text\b/g, '');
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
  return {
    ...(input?.id ? { id: Number(input.id) } : {}),
    name: text(input?.name || '未命名采集规则'),
    entryUrl: text(input?.entryUrl || input?.entry_url || input?.url || ''),
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
  return requestTargetHtml(parsed.url, buildHeaders(JSON.stringify(parseHeaders(rule.headers))), {
    ...buildCollectorFetchOptions(rule, parsed.option),
    targetAccessMode: isIpaoshubaRule(rule) ? 'snapshot-first' : 'snapshot-fallback',
  });
}

export async function fetchCollectorChapterContent(originName: string, chapterUrl: string): Promise<string | null> {
  const row = await queryOne('SELECT * FROM collector_rules WHERE name=? AND enabled=1 LIMIT 1', [originName]);
  if (!row) return null;
  const rule = normalizeCollectorRule(JSON.parse(row.rule_json || '{}'));
  if (!rule.contentRule) return null;
  const html = await fetchHtml(chapterUrl, rule);
  return extractContentByCollectorRule(html, rule) || null;
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
  if (!rule.entryUrl) throw new Error('请填写单本详情页地址');
  const payload = JSON.stringify(rule);
  if (rule.id) {
    // 检查记录是否存在，存在则更新，不存在则插入（忽略传入的 id）
    const existing = await queryOne('SELECT id FROM collector_rules WHERE id=?', [rule.id]);
    if (existing) {
      await execute(
        'UPDATE collector_rules SET name=?, entry_url=?, enabled=?, rule_json=?, updated_at=NOW() WHERE id=?',
        [rule.name, rule.entryUrl, rule.enabled ? 1 : 0, payload, rule.id]
      );
      return queryOne('SELECT * FROM collector_rules WHERE id=?', [rule.id]);
    }
  }
  const result = await execute(
    'INSERT INTO collector_rules (name, entry_url, enabled, rule_json) VALUES (?, ?, ?, ?)',
    [rule.name, rule.entryUrl, rule.enabled ? 1 : 0, payload]
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

async function getCollectorRuleForBook(book: any): Promise<{ id: number; rule: CollectorRulePayload } | null> {
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

async function fetchCollectorChaptersForBook(book: any, rule: CollectorRulePayload) {
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
  return Math.min(Math.round(raw), 5000);
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

export async function importCollectedBook(book: CollectorBookDraft, chapters: CollectorChapterDraft[]) {
  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO books
        (book_url, toc_url, origin, origin_name, name, author, kind, cover_url, intro, total_chapter_num, latest_chapter_title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE toc_url=VALUES(toc_url), origin=VALUES(origin), origin_name=VALUES(origin_name),
         name=VALUES(name), author=VALUES(author), kind=VALUES(kind), cover_url=VALUES(cover_url), intro=VALUES(intro),
         total_chapter_num=VALUES(total_chapter_num), latest_chapter_title=VALUES(latest_chapter_title), updated_at=NOW()`,
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
