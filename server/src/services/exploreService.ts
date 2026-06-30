/**
 * 发现/目录站功能解析服务
 *
 * 复用 webBookService 的规则解析逻辑，实现书源发现功能。
 * 发现功能允许用户通过书源的 exploreUrl 获取分类目录、推荐列表等。
 */

import { httpRequest, buildHeaders } from './bookSourceHttpClient';
import { WebBookEngine, type SearchBookResult } from './webBookService';
import { setRuleExecutionContext } from './ruleExecutor';

export interface ExploreRule {
  bookList: string;
  name: string;
  author: string;
  bookUrl: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
  wordCount?: string;
}

export interface ExploreKind {
  title: string;
  url: string;
}

/**
 * 解析发现 URL 规则，支持多组发现入口
 *
 * exploreUrl 格式示例：
 * - 单组: "https://example.com/explore"
 * - 多组: "[{\"title\":\"玄幻\",\"url\":\"https://example.com/xuanhuan\"},{\"title\":\"都市\",\"url\":\"https://example.com/dushi\"}]"
 * - 带选项: "https://example.com/explore,{\"method\":\"POST\",\"body\":\"type=1\"}"
 */
export function parseExploreUrl(exploreUrl: string): ExploreKind[] {
  if (!exploreUrl || exploreUrl.trim() === '') {
    return [];
  }

  // 尝试解析为 JSON 数组（多组发现入口）
  if (exploreUrl.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(exploreUrl);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item: any) => item && (item.title || item.url))
          .map((item: any) => ({
            title: item.title || item.name || '未命名',
            url: item.url || item.link || '',
          }));
      }
    } catch {
      // 不是 JSON 数组，继续处理
    }
  }

  // 尝试解析为 JSON 对象（单组）
  if (exploreUrl.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(exploreUrl);
      if (parsed.title && parsed.url) {
        return [{ title: parsed.title, url: parsed.url }];
      }
    } catch {
      // 不是 JSON 对象
    }
  }

  // 普通 URL 字符串
  return [{ title: '发现', url: exploreUrl }];
}

/**
 * 从书源获取发现结果
 */
export async function exploreBook(
  source: any,
  exploreUrl?: string
): Promise<SearchBookResult[]> {
  const sourceName = source.book_source_name || source.bookSourceName || '未知';
  const sourceUrl = source.book_source_url || source.bookSourceUrl || '';

  // 设置规则执行上下文
  setRuleExecutionContext({
    sourceUrl,
    baseUrl: sourceUrl,
    source,
  });

  // 获取发现 URL
  const url = exploreUrl || source.explore_url || source.exploreUrl;
  if (!url) {
    console.log(`[发现] ${sourceName}: 无发现URL`);
    return [];
  }

  // 构建请求头
  const headers = buildHeaders(source.header ? String(source.header) : null);

  try {
    const html = await httpRequest(url, headers);

    // 解析发现规则
    let ruleExplore: ExploreRule;
    try {
      ruleExplore = typeof source.rule_explore === 'string'
        ? JSON.parse(source.rule_explore)
        : (source.rule_explore || source.ruleExplore || {});
    } catch (parseErr: any) {
      console.log(`[发现] ${sourceName}: rule_explore解析失败 - ${parseErr.message}`);
      return [];
    }

    if (!ruleExplore.bookList) {
      console.log(`[发现] ${sourceName}: 无bookList规则，尝试使用搜索规则`);
      // 回退：尝试使用搜索规则解析发现页面
      const ruleSearch = typeof source.rule_search === 'string'
        ? JSON.parse(source.rule_search)
        : (source.rule_search || source.ruleSearch || {});
      if (ruleSearch.bookList) {
        ruleExplore = {
          bookList: ruleSearch.bookList,
          name: ruleSearch.name || '',
          author: ruleSearch.author || '',
          bookUrl: ruleSearch.bookUrl || '',
          coverUrl: ruleSearch.coverUrl || '',
          intro: ruleSearch.intro || '',
          kind: ruleSearch.kind || '',
          lastChapter: ruleSearch.lastChapter || '',
          wordCount: ruleSearch.wordCount || '',
        };
      } else {
        return [];
      }
    }

    // 复用 WebBookEngine 的解析逻辑
    const engine = new WebBookEngine();
    const results = engine.parseSearchResult(html, ruleExplore, source);
    console.log(`[发现] ${sourceName}: 返回 ${results.length} 条结果`);
    return results;
  } catch (e: any) {
    console.error(`[发现失败] ${sourceName}:`, e.message);
    return [];
  }
}

/**
 * 批量获取多个发现入口的结果
 */
export async function exploreBookMulti(
  source: any
): Promise<{ kind: ExploreKind; books: SearchBookResult[] }[]> {
  const exploreUrl = source.explore_url || source.exploreUrl;
  if (!exploreUrl) return [];

  const kinds = parseExploreUrl(exploreUrl);
  const results: { kind: ExploreKind; books: SearchBookResult[] }[] = [];

  for (const kind of kinds) {
    if (!kind.url) continue;
    const books = await exploreBook(source, kind.url);
    results.push({ kind, books });
  }

  return results;
}
