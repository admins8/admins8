import axios from 'axios';
import { query, queryOne, execute } from '../config/database';
import { executeRule } from './ruleExecutor';

export type RssSourceUrlType = 'single' | 'collection' | 'unknown';

export interface NormalizedRssSource {
  sourceUrl: string;
  sourceName: string;
  sourceGroup: string | null;
  sourceIcon: string | null;
  sourceComment: string | null;
  enabled: boolean;
  customOrder: number;
  articleStyle: number;
  singleUrl: boolean;
  enableJs: boolean;
  enabledCookieJar: boolean;
  header: string | null;
  sortUrl: string | null;
  ruleArticles: string | null;
  ruleTitle: string | null;
  ruleLink: string | null;
  ruleImage: string | null;
  rulePubDate: string | null;
  ruleContent: string | null;
  ruleNextPage: string | null;
  rawJson: string;
}

export function detectRssSourceUrlType(url: string): RssSourceUrlType {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes('/yuedu/rsss/')) return 'collection';
    if (path.includes('/yuedu/rss/')) return 'single';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function normalizeRssImportPayload(payload: unknown): any[] {
  let data = payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error('订阅源导入内容不是有效 JSON');
    }
  }

  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const maybeData = (data as any).data;
    if (Array.isArray(maybeData)) return maybeData;
    return [data];
  }
  throw new Error('订阅源导入内容必须是对象、数组或 JSON 字符串');
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  return value !== false && value !== 0 && value !== '0' && value !== 'false';
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeRssSourceInput(input: any): NormalizedRssSource {
  const sourceUrl = asString(input?.sourceUrl ?? input?.source_url);
  if (!sourceUrl) throw new Error('订阅源缺少 sourceUrl');

  const sourceName = asString(input?.sourceName ?? input?.source_name) || sourceUrl;
  return {
    sourceUrl,
    sourceName,
    sourceGroup: asString(input?.sourceGroup ?? input?.source_group),
    sourceIcon: asString(input?.sourceIcon ?? input?.source_icon),
    sourceComment: asString(input?.sourceComment ?? input?.source_comment),
    enabled: asBoolean(input?.enabled, true),
    customOrder: asNumber(input?.customOrder ?? input?.custom_order, 0),
    articleStyle: asNumber(input?.articleStyle ?? input?.article_style, 0),
    singleUrl: asBoolean(input?.singleUrl ?? input?.single_url, false),
    enableJs: asBoolean(input?.enableJs ?? input?.enable_js, false),
    enabledCookieJar: asBoolean(input?.enabledCookieJar ?? input?.enabled_cookie_jar, true),
    header: asString(input?.header),
    sortUrl: asString(input?.sortUrl ?? input?.sort_url),
    ruleArticles: asString(input?.ruleArticles ?? input?.rule_articles),
    ruleTitle: asString(input?.ruleTitle ?? input?.rule_title),
    ruleLink: asString(input?.ruleLink ?? input?.rule_link),
    ruleImage: asString(input?.ruleImage ?? input?.rule_image),
    rulePubDate: asString(input?.rulePubDate ?? input?.rule_pub_date),
    ruleContent: asString(input?.ruleContent ?? input?.rule_content),
    ruleNextPage: asString(input?.ruleNextPage ?? input?.rule_next_page),
    rawJson: JSON.stringify(input || {}),
  };
}

export async function upsertRssSources(inputs: any[]) {
  const results: Array<{ success: boolean; name: string; error?: string }> = [];
  for (const input of inputs) {
    try {
      const s = normalizeRssSourceInput(input);
      await execute(
        `INSERT INTO rss_sources (
          source_url, source_name, source_group, source_icon, source_comment,
          enabled, custom_order, article_style, single_url, enable_js, enabled_cookie_jar,
          header, sort_url, rule_articles, rule_title, rule_link, rule_image,
          rule_pub_date, rule_content, rule_next_page, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          source_name = VALUES(source_name),
          source_group = VALUES(source_group),
          source_icon = VALUES(source_icon),
          source_comment = VALUES(source_comment),
          enabled = VALUES(enabled),
          custom_order = VALUES(custom_order),
          article_style = VALUES(article_style),
          single_url = VALUES(single_url),
          enable_js = VALUES(enable_js),
          enabled_cookie_jar = VALUES(enabled_cookie_jar),
          header = VALUES(header),
          sort_url = VALUES(sort_url),
          rule_articles = VALUES(rule_articles),
          rule_title = VALUES(rule_title),
          rule_link = VALUES(rule_link),
          rule_image = VALUES(rule_image),
          rule_pub_date = VALUES(rule_pub_date),
          rule_content = VALUES(rule_content),
          rule_next_page = VALUES(rule_next_page),
          raw_json = VALUES(raw_json),
          updated_at = NOW()`,
        [
          s.sourceUrl, s.sourceName, s.sourceGroup, s.sourceIcon, s.sourceComment,
          s.enabled ? 1 : 0, s.customOrder, s.articleStyle, s.singleUrl ? 1 : 0,
          s.enableJs ? 1 : 0, s.enabledCookieJar ? 1 : 0, s.header, s.sortUrl,
          s.ruleArticles, s.ruleTitle, s.ruleLink, s.ruleImage, s.rulePubDate,
          s.ruleContent, s.ruleNextPage, s.rawJson,
        ],
      );
      results.push({ success: true, name: s.sourceName });
    } catch (err: any) {
      results.push({
        success: false,
        name: asString(input?.sourceName ?? input?.source_name) || '未命名订阅源',
        error: err.message,
      });
    }
  }
  return results;
}

export async function importRssSourcesFromUrl(url: string) {
  const response = await axios.get(url, {
    timeout: 30000,
    responseType: 'json',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  });
  const items = normalizeRssImportPayload(response.data);
  const results = await upsertRssSources(items);
  const success = results.filter((item) => item.success).length;
  return { success, fail: results.length - success, results };
}

export async function listRssSources() {
  return query(`
    SELECT id, source_url, source_name, source_group, source_icon, source_comment,
      enabled, custom_order, article_style, single_url, enable_js, enabled_cookie_jar,
      header, sort_url, rule_articles, rule_title, rule_link, rule_image,
      rule_pub_date, rule_content, rule_next_page, created_at, updated_at
    FROM rss_sources
    ORDER BY custom_order ASC, source_name ASC
  `);
}

export async function getRssSource(id: number) {
  return queryOne('SELECT * FROM rss_sources WHERE id = ?', [id]);
}

export async function updateRssSource(id: number, payload: any) {
  await execute(
    `UPDATE rss_sources SET
      source_group = COALESCE(?, source_group),
      enabled = COALESCE(?, enabled),
      custom_order = COALESCE(?, custom_order),
      updated_at = NOW()
    WHERE id = ?`,
    [
      payload.sourceGroup ?? payload.source_group ?? null,
      payload.enabled !== undefined ? (payload.enabled ? 1 : 0) : null,
      payload.customOrder ?? payload.custom_order ?? null,
      id,
    ],
  );
}

export async function deleteRssSources(ids: number[]) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await execute(`DELETE FROM rss_sources WHERE id IN (${placeholders})`, ids);
}

function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

async function fetchSourceText(url: string, header?: string | null): Promise<string> {
  let headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  };
  if (header) {
    try {
      headers = { ...headers, ...JSON.parse(header) };
    } catch {
      // 保持默认请求头
    }
  }
  const response = await axios.get(url, { timeout: 15000, responseType: 'text', headers });
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}

export async function listRssArticles(id: number, sortUrl?: string) {
  const source = await getRssSource(id);
  if (!source) throw new Error('订阅源不存在');
  const targetUrl = resolveUrl(sortUrl || source.sort_url?.split('\n')[0]?.split('::').pop() || source.source_url, source.source_url);
  const html = await fetchSourceText(targetUrl, source.header);
  const listRule = source.rule_articles || 'a';
  const blocks = executeRule(listRule, html, html.trim().startsWith('{') || html.trim().startsWith('['));
  const items = blocks.slice(0, 100).map((block: string, index: number) => {
    const title = source.rule_title ? executeRule(source.rule_title, block)[0] : '';
    const link = source.rule_link ? executeRule(source.rule_link, block)[0] : '';
    const image = source.rule_image ? executeRule(source.rule_image, block)[0] : '';
    const pubDate = source.rule_pub_date ? executeRule(source.rule_pub_date, block)[0] : '';
    return {
      index,
      title: title || `文章 ${index + 1}`,
      link: link ? resolveUrl(link, targetUrl) : targetUrl,
      image: image ? resolveUrl(image, targetUrl) : '',
      pubDate,
    };
  });
  return { source, items };
}

export async function getRssArticleContent(id: number, link: string) {
  const source = await getRssSource(id);
  if (!source) throw new Error('订阅源不存在');
  const targetUrl = resolveUrl(link, source.source_url);
  const html = await fetchSourceText(targetUrl, source.header);
  const content = source.rule_content ? executeRule(source.rule_content, html)[0] : html;
  return {
    source,
    link: targetUrl,
    content: content || '',
  };
}
