import * as cheerio from 'cheerio';
import { JSONPath } from 'jsonpath-plus';
import { httpRequest, UrlOption, buildHeaders, parseSearchUrl } from './bookSourceHttpClient';
import { isAntiCrawlPage, fetchWithBrowser } from './browserRender';
import { setRuleExecutionContext } from './ruleExecutor';

// ============ Legado 规则解析引擎 ============

function parseJsoupSelector(selector: string, $: cheerio.CheerioAPI, context?: any): any {
  const parts = selector.split('.');
  if (parts.length === 0) return $();
  const type = parts[0].toLowerCase();
  const name = parts.length > 1 ? parts[1] : '';
  const rest = parts.length > 2 ? parts.slice(2).join('.') : '';
  const searchRoot = context ? $(context) : $('body');
  let elements: any;
  switch (type) {
    case 'class':
      elements = searchRoot.find('.' + name.replace(/\s/g, '\\.'));
      break;
    case 'id':
      elements = $('#' + name);
      break;
    case 'tag':
      elements = searchRoot.find(name);
      break;
    case 'text':
      elements = searchRoot.find('*').filter(function (this: any) {
        return $(this).text().includes(name);
      });
      break;
    case 'children':
      elements = searchRoot.children();
      break;
    default:
      try { elements = $(selector); } catch { elements = $(); }
      return elements;
  }
  if (rest) {
    if (rest.includes('!')) {
      const excludePart = rest.split('!')[1];
      const excludeIndices = excludePart.split(':').map(Number).filter((n: number) => !isNaN(n));
      const allElements = elements.toArray();
      elements = $(allElements.filter((_: any, idx: number) => !excludeIndices.includes(idx)));
    } else if (rest.includes('[')) {
      const match = rest.match(/\[([^\]]+)\]/);
      if (match) {
        const inner = match[1];
        const allElements = elements.toArray();
        if (inner.startsWith('!')) {
          const excludeIndices = inner.substring(1).split(',').map(Number).filter((n: number) => !isNaN(n));
          elements = $(allElements.filter((_: any, idx: number) => !excludeIndices.includes(idx)));
        } else {
          const indices = inner.split(',').map(Number).filter((n: number) => !isNaN(n));
          elements = $(indices.map((i: number) => allElements[i]).filter(Boolean));
        }
      }
    } else {
      const indices = rest.split('.').map(Number).filter((n: number) => !isNaN(n));
      if (indices.length > 0) {
        const allElements = elements.toArray();
        elements = $(indices.map((i: number) => allElements[i]).filter(Boolean));
      }
    }
  }
  return elements;
}

function parseLegadoRule(rule: string, $: cheerio.CheerioAPI, context?: any): any {
  const chainTypes = ['||', '&&', '%%'];
  for (const chainType of chainTypes) {
    if (rule.includes(chainType)) {
      const parts = rule.split(chainType);
      let results: any = $.root();
      for (const part of parts) {
        const r = parseLegadoRule(part.trim(), $, context);
        if (chainType === '||') {
          if (r.length > 0) return r;
        } else if (chainType === '&&') {
          results = results.add(r.get());
        }
      }
      return results;
    }
  }
  // Split by @ but handle chained selectors like class.grid@tag.tr!0
  // vs attribute extraction like class.xxx@href
  const atParts = rule.split('@');
  
  if (atParts.length <= 1) {
    // No @ at all, just parse as JSOUP selector
    return parseJsoupSelector(rule, $, context);
  }
  
  // Check if the last part is an attribute extraction suffix
  const lastPart = atParts[atParts.length - 1];
  const knownAttrSuffixes = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
    'data-original', 'data-src', 'content'];
  const isAttrSuffix = knownAttrSuffixes.includes(lastPart) || 
    lastPart.startsWith('attr.') || lastPart.startsWith('data-');
  
  if (isAttrSuffix && atParts.length >= 2) {
    // This is selector@attr format (e.g., class.odd.0@tag.a@href)
    const selectorRule = atParts.slice(0, -1).join('@');
    let elements = parseJsoupSelector(selectorRule, $, context);
    
    const elem = elements.length > 0 ? elements.first() : null;
    if (!elem) return $();
    
    if (lastPart.startsWith('text')) {
      return elem.text().trim();
    } else if (lastPart.startsWith('html')) {
      return elem.html() || '';
    } else if (lastPart.startsWith('href')) {
      return elem.attr('href') || '';
    } else if (lastPart.startsWith('src')) {
      return elem.attr('src') || '';
    } else {
      return elem.attr(lastPart) || elem.text().trim();
    }
  }
  
  // This is a chain of JSOUP selectors: class.grid@tag.tr!0
  // Parse step by step, using previous result as context
  let elements = context || $.root();
  for (const part of atParts) {
    if (!part) continue;
    if (elements.length > 0) {
      // Collect results from all elements, not just the first one
      const allResults: any[] = [];
      elements.each((i: number, el: any) => {
        const result = parseJsoupSelector(part, $, el);
        if (result.length > 0) {
          result.each((j: number, r: any) => {
            allResults.push(r);
          });
        }
      });
      elements = $(allResults);
    } else {
      elements = parseJsoupSelector(part, $, undefined);
    }
  }
  return elements;
}

function getResultFromElement(element: any, $: cheerio.CheerioAPI, suffix: string): string {
  const el = $(element);
  switch (suffix) {
    case 'text': return el.text().trim();
    case 'textNodes':
      return el.contents().filter(function (this: any) { return this.type === 'text'; }).text().trim();
    case 'ownText': return el.contents().first().text().trim();
    case 'html': return el.html() || '';
    case 'all': return $.html(element) || '';
    case 'src': case 'href': case 'data-original': case 'data-src':
      return el.attr(suffix) || '';
    default:
      if (suffix.startsWith('attr.')) return el.attr(suffix.substring(5)) || '';
      return el.attr(suffix) || '';
  }
}

export function executeRule(rule: string, html: string, isJson: boolean = false): string[] {
  if (!rule || rule.trim() === '') return [];

  // ## 正则替换语法: rule##regex##replacement 或 rule##regex（replacement 默认为空字符串）
  const regexReplaceMatch = rule.match(/^(.+?)##(.+?)##(.+)$/);
  if (regexReplaceMatch) {
    const baseResults = executeRule(regexReplaceMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      const regex = new RegExp(regexReplaceMatch[2], 'g');
      return baseResults.map(r => r.replace(regex, regexReplaceMatch[3]));
    } catch { return baseResults; }
  }

  // ## 正则替换语法（单 ## 格式，replacement 默认为空字符串）
  const regexReplaceMatch2 = rule.match(/^(.+?)##(.+)$/);
  if (regexReplaceMatch2) {
    const baseResults = executeRule(regexReplaceMatch2[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      const regex = new RegExp(regexReplaceMatch2[2], 'g');
      return baseResults.map(r => r.replace(regex, ''));
    } catch { return baseResults; }
  }

  // JS 规则
  if (rule.trimStart().startsWith('js:') || rule.trimStart().startsWith('<js>')) {
    const jsCode = rule.replace(/^js:\s*/, '').replace(/^<js>/, '').replace(/<\/js>$/, '');
    try {
      const fn = new Function('result', 'html', jsCode);
      const result = fn(null, html);
      if (Array.isArray(result)) return result.map(String);
      if (typeof result === 'string') return [result];
      return [];
    } catch { return []; }
  }

  // 规则链 (||, &&)
  for (const chainType of ['||', '&&']) {
    if (rule.includes(chainType)) {
      const parts = rule.split(chainType);
      if (chainType === '||') {
        for (const part of parts) {
          const result = executeRule(part.trim(), html, isJson);
          if (result.length > 0) return result;
        }
        return [];
      } else {
        let allResults: string[] = [];
        for (const part of parts) {
          allResults = allResults.concat(executeRule(part.trim(), html, isJson));
        }
        return allResults;
      }
    }
  }

  // JSONPath
  if (rule.startsWith('$.') || rule.startsWith('$[')) {
    try {
      const data = isJson ? JSON.parse(html) : html;
      const results = JSONPath({ path: rule, json: data, wrap: true });
      const flat: any[] = [];
      for (const r of results) {
        if (Array.isArray(r)) flat.push(...r); else flat.push(r);
      }
      return flat.map((r: any) => typeof r === 'object' ? JSON.stringify(r) : String(r));
    } catch { return []; }
  }

  // XPath
  if (rule.startsWith('//')) {
    try {
      const { DOMParser } = require('xmldom') as any;
      const { select } = require('xpath') as any;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nodes = select(rule, doc) as any[];
      return nodes.map((node: any) => node.nodeType === 2 ? (node.value || '') : (node.textContent?.trim() || ''));
    } catch { return []; }
  }

  // Legado JSOUP 规则 (含 @)
  if (rule.includes('@') && !rule.startsWith('http') && !rule.startsWith('//')) {
    return executeJsoupRule(rule, html, isJson);
  }

  // 默认 CSS 选择器
  try {
    const $ = cheerio.load(html);
    const elements = $(rule);
    const results: string[] = [];
    elements.each((_: any, el: any) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      const src = $(el).attr('src');
      results.push(text || href || src || $(el).html() || '');
    });
    return results;
  } catch { return []; }
}

function executeJsoupRule(rule: string, html: string, isJson: boolean): string[] {
  // @js: 后缀 或 <js> 标签
  // 先尝试匹配 <js> 标签格式: selector<js>code</js> 或 selector<js>code
  const jsTagMatch = rule.match(/^(.+?)<js>(.+?)(?:<\/js>)?$/);
  if (jsTagMatch) {
    const baseResults = executeRule(jsTagMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      const fn = new Function('result', 'source', jsTagMatch[2]);
      const result = fn(baseResults[0], { bookSourceUrl: '' });
      if (Array.isArray(result)) return result.map(String);
      if (typeof result === 'string') return [result];
      return [String(result)];
    } catch { return []; }
  }
  // 再尝试 @js: 格式
  const jsMatch = rule.match(/^(.+?)@js:(.+)$/);
  if (jsMatch) {
    const baseResults = executeRule(jsMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      const fn = new Function('result', jsMatch[2]);
      const result = fn(baseResults[0]);
      if (Array.isArray(result)) return result.map(String);
      if (typeof result === 'string') return [result];
      return [String(result)];
    } catch { return []; }
  }

  const $ = cheerio.load(html);
  const atIdx = rule.lastIndexOf('@');
  const selectorPart = atIdx >= 0 ? rule.substring(0, atIdx) : rule;
  let suffix = atIdx >= 0 ? rule.substring(atIdx + 1) : 'text';

  // 处理后缀中的 .N 索引
  let suffixIndex = -1;
  const suffixDotMatch = suffix.match(/^(.+)\.(\d+)$/);
  if (suffixDotMatch) {
    const possibleSuffix = suffixDotMatch[1];
    if (['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href'].includes(possibleSuffix) ||
        possibleSuffix.startsWith('attr.') || possibleSuffix.startsWith('data-')) {
      suffix = possibleSuffix;
      suffixIndex = parseInt(suffixDotMatch[2]);
    }
  }

  const elements = parseLegadoRule(selectorPart, $);
  const results: string[] = [];
  elements.each((_: any, el: any) => {
    const value = getResultFromElement(el, $, suffix);
    if (value) results.push(value);
  });

  if (suffixIndex >= 0 && suffixIndex < results.length) {
    return [results[suffixIndex]];
  }
  return results;
}

// ============ 书源解析引擎 ============

export interface SearchBookResult {
  name: string;
  author: string;
  bookUrl: string;
  coverUrl: string;
  intro: string;
  kind: string;
  latestChapterTitle: string;
  wordCount: string;
  origin: string;
  originName: string;
  type: number;
}

export interface ChapterResult {
  index: number;
  title: string;
  url: string;
}

export class WebBookEngine {
  private headers: Record<string, string> = {};

  private initHeaders(source: any): void {
    this.headers = buildHeaders(source.header || null);
  }

  private buildSearchRequest(rawSearchUrl: string, keyword: string, baseUrl?: string): { url: string; option: UrlOption } {
    if (!rawSearchUrl) return { url: '', option: {} };
    let processed = rawSearchUrl
      .replace(/\{\{key\}\}/g, encodeURIComponent(keyword))
      .replace(/\{\{page\}\}/g, '1')
      .replace(/\\$/g, encodeURIComponent(keyword));
    const { url, option } = parseSearchUrl(processed);
    let finalUrl = url;
    if (finalUrl && !finalUrl.startsWith('http') && baseUrl) {
      try {
        const cleanBase = baseUrl.split('#')[0].split('/').slice(0, 3).join('/');
        finalUrl = new URL(finalUrl, cleanBase).href;
      } catch { finalUrl = baseUrl + finalUrl; }
    }
    return { url: finalUrl, option };
  }

  async search(source: any, keyword: string): Promise<SearchBookResult[]> {
    // 设置规则执行上下文，使 JS 沙箱可以访问书源信息
    setRuleExecutionContext({
      sourceUrl: source.book_source_url || source.bookSourceUrl || '',
      baseUrl: source.book_source_url || source.bookSourceUrl || '',
      source,
    });
    this.initHeaders(source);
    const sourceName = source.book_source_name || source.bookSourceName || '未知';
    const { url, option } = this.buildSearchRequest(
      source.searchUrl || source.search_url,
      keyword,
      source.bookSourceUrl || source.book_source_url
    );
    if (!url) {
      console.log(`[搜索] ${sourceName}: 无搜索URL`);
      return [];
    }
    try {
      const html = await httpRequest(url, this.headers, option);
      let ruleSearch: any;
      try {
        ruleSearch = typeof source.rule_search === 'string'
          ? JSON.parse(source.rule_search)
          : (source.rule_search || source.ruleSearch || {});
      } catch (parseErr: any) {
        console.log(`[搜索] ${sourceName}: rule_search解析失败 - ${parseErr.message}`);
        return [];
      }
      if (!ruleSearch.bookList) {
        console.log(`[搜索] ${sourceName}: 无bookList规则`);
        return [];
      }
      const results = this.parseSearchResult(html, ruleSearch, source, keyword);
      console.log(`[搜索] ${sourceName}: 返回 ${results.length} 条结果`);
      return results;
    } catch (e: any) {
      console.error(`[搜索失败] ${sourceName}:`, e.message);
      return [];
    }
  }

  parseSearchResult(html: string, rule: any, source: any, keyword?: string): SearchBookResult[] {
    const results: SearchBookResult[] = [];
    const bookListRule = rule.bookList || '';
    if (!bookListRule) return results;
    let isJson = false;
    try { JSON.parse(html); isJson = true; } catch { isJson = false; }
    let bookElements: any[] = [];

    if (isJson && (bookListRule.startsWith('$.') || bookListRule.startsWith('$['))) {
      try {
        const jsonData = JSON.parse(html);
        const jsonResults = JSONPath({ path: bookListRule, json: jsonData, wrap: true });
        let flat: any[] = [];
        for (const r of jsonResults) {
          if (Array.isArray(r)) flat.push(...r); else flat.push(r);
        }
        bookElements = flat;
      } catch (e) {
        console.error('[JSON解析错误]', e);
        return results;
      }
    } else {
      const $ = cheerio.load(html);
      const elements = parseLegadoRule(bookListRule, $);
      elements.each((_: any, el: any) => {
        const elHtml = $.html(el) || $(el).html() || '';
        bookElements.push(elHtml);
      });
    }

    for (const elementData of bookElements) {
      const elementHtml = typeof elementData === 'string' ? elementData : JSON.stringify(elementData);
      const book: SearchBookResult = {
        name: '', author: '', bookUrl: '', coverUrl: '', intro: '',
        kind: '', latestChapterTitle: '', wordCount: '',
        origin: source.book_source_url || source.bookSourceUrl || '',
        originName: source.book_source_name || source.bookSourceName || '',
        type: source.book_source_type || source.bookSourceType || 0,
      };
      if (rule.name) { const r = executeRule(rule.name, elementHtml, isJson); if (r.length > 0) book.name = r[0]; }
      if (rule.author) { const r = executeRule(rule.author, elementHtml, isJson); if (r.length > 0) book.author = r[0]; }
      if (rule.coverUrl) { const r = executeRule(rule.coverUrl, elementHtml, isJson); if (r.length > 0) book.coverUrl = r[0]; }
      if (rule.intro) { const r = executeRule(rule.intro, elementHtml, isJson); if (r.length > 0) book.intro = r[0]; }
      if (rule.kind) { const r = executeRule(rule.kind, elementHtml, isJson); if (r.length > 0) book.kind = r.join(','); }
      if (rule.lastChapter) { const r = executeRule(rule.lastChapter, elementHtml, isJson); if (r.length > 0) book.latestChapterTitle = r[0]; }
      if (rule.bookUrl) {
        const urls = executeRule(rule.bookUrl, elementHtml, isJson);
        if (urls.length > 0) {
          let bookUrl = urls[0];
          if (bookUrl && !bookUrl.startsWith('http')) {
            const base = source.book_source_url || source.bookSourceUrl || '';
            try { bookUrl = new URL(bookUrl, base.split('#')[0]).href; } catch { bookUrl = base + bookUrl; }
          }
          book.bookUrl = bookUrl;
        }
      }

      if (book.name && book.bookUrl) {
        // 如果提供了关键词，进行智能匹配过滤
        if (keyword) {
          const kw = keyword.toLowerCase().trim();
          const nameLower = book.name.toLowerCase().trim();
          const authorLower = book.author.toLowerCase().trim();
          
          // 1. 完整包含匹配（书名或作者包含完整关键词）
          const nameMatch = nameLower.includes(kw);
          const authorMatch = authorLower.includes(kw);
          
          // 2. 关键词包含书名（反向匹配，如搜索"斗破苍穹"，书名"斗破"也匹配）
          const reverseMatch = kw.includes(nameLower) && nameLower.length >= 2;
          
          // 3. 逐字匹配：关键词中至少一半的字出现在书名中（防止只提取到一个字的情况）
          const kwChars = Array.from(kw).filter(c => /\S/.test(c));
          const matchedChars = kwChars.filter(c => nameLower.includes(c)).length;
          const charRatio = kwChars.length > 0 ? matchedChars / kwChars.length : 0;
          const partialMatch = charRatio >= 0.6 && matchedChars >= 3;
          
          if (nameMatch || authorMatch || reverseMatch || partialMatch) {
            results.push(book);
          }
        } else {
          results.push(book);
        }
      }
    }
    return results;
  }

  async getBookInfo(source: any, bookUrl: string): Promise<Partial<SearchBookResult>> {
    setRuleExecutionContext({
      sourceUrl: source.book_source_url || source.bookSourceUrl || '',
      baseUrl: source.book_source_url || source.bookSourceUrl || '',
      source,
    });
    this.initHeaders(source);
    try {
      const html = await httpRequest(bookUrl, this.headers);
      const ruleInfo = typeof source.rule_book_info === 'string'
        ? JSON.parse(source.rule_book_info)
        : (source.rule_book_info || source.ruleBookInfo || {});
      const info: Partial<SearchBookResult> = {};
      if (ruleInfo.name) { const r = executeRule(ruleInfo.name, html); if (r.length > 0) info.name = r[0]; }
      if (ruleInfo.author) { const r = executeRule(ruleInfo.author, html); if (r.length > 0) info.author = r[0]; }
      if (ruleInfo.coverUrl) { const r = executeRule(ruleInfo.coverUrl, html); if (r.length > 0) info.coverUrl = r[0]; }
      if (ruleInfo.intro) { const r = executeRule(ruleInfo.intro, html); if (r.length > 0) info.intro = r[0]; }
      if (ruleInfo.kind) { const r = executeRule(ruleInfo.kind, html); if (r.length > 0) info.kind = r.join(','); }
      if (ruleInfo.lastChapter) { const r = executeRule(ruleInfo.lastChapter, html); if (r.length > 0) info.latestChapterTitle = r[0]; }
      if (ruleInfo.wordCount) { const r = executeRule(ruleInfo.wordCount, html); if (r.length > 0) info.wordCount = r[0]; }
      if (ruleInfo.tocUrl) { const r = executeRule(ruleInfo.tocUrl, html); if (r.length > 0) info.bookUrl = r[0]; }
      return info;
    } catch (e: any) {
      console.error(`[获取详情失败] ${source.book_source_name}:`, e.message);
      return {};
    }
  }

  async getChapterList(source: any, book: any): Promise<ChapterResult[]> {
    setRuleExecutionContext({
      sourceUrl: source.book_source_url || source.bookSourceUrl || '',
      baseUrl: source.book_source_url || source.bookSourceUrl || '',
      source,
    });
    this.initHeaders(source);
    const tocUrl = book.toc_url || book.tocUrl || book.book_url || book.bookUrl;
    try {
      const html = await httpRequest(tocUrl, this.headers);
      const ruleToc = typeof source.rule_toc === 'string'
        ? JSON.parse(source.rule_toc)
        : (source.rule_toc || source.ruleToc || {});
      return this.parseChapterList(html, ruleToc, tocUrl);
    } catch (e: any) {
      console.error(`[获取目录失败] ${source.book_source_name}:`, e.message);
      return [];
    }
  }

  private parseChapterList(html: string, rule: any, baseUrl: string): ChapterResult[] {
    const $ = cheerio.load(html);
    const results: ChapterResult[] = [];
    const chapterListRule = rule.chapterList || '';
    if (!chapterListRule) return results;
    const elements = parseLegadoRule(chapterListRule, $);
    elements.each((index: any, el: any) => {
      const chapter: ChapterResult = { index, title: '', url: '' };
      const el$ = $(el);
      // Handle chapterName: could be a plain attribute like 'text', 'href'
      // or a selector like 'tag.a@text'
      if (rule.chapterName) {
        const nameRule = rule.chapterName.trim();
        // If the rule is just an attribute suffix (text, href, src, etc.), extract directly
        const knownAttrs = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
          'data-original', 'data-src', 'content', 'title'];
        if (knownAttrs.includes(nameRule) || nameRule.startsWith('attr.') || nameRule.startsWith('data-')) {
          chapter.title = getResultFromElement(el, $, nameRule);
        } else if (nameRule.includes('@') || nameRule.includes('.') || nameRule.includes('#')) {
          // It's a selector rule, use parseLegadoRule
          const nameResult = parseLegadoRule(nameRule, $, el);
          if (typeof nameResult === 'string') {
            chapter.title = nameResult;
          } else if (nameResult.length > 0) {
            chapter.title = $(nameResult[0]).text().trim() || $(nameResult[0]).attr('title') || '';
          }
        } else {
          // Fallback: try as text content
          chapter.title = el$.text().trim();
        }
      }
      // Handle chapterUrl similarly
      if (rule.chapterUrl) {
        const urlRule = rule.chapterUrl.trim();
        const knownAttrs = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
          'data-original', 'data-src', 'content', 'title'];
        let url = '';
        if (knownAttrs.includes(urlRule) || urlRule.startsWith('attr.') || urlRule.startsWith('data-')) {
          url = getResultFromElement(el, $, urlRule);
        } else if (urlRule.includes('@') || urlRule.includes('.') || urlRule.includes('#')) {
          const urlResult = parseLegadoRule(urlRule, $, el);
          if (typeof urlResult === 'string') {
            url = urlResult;
          } else if (urlResult.length > 0) {
            url = $(urlResult[0]).attr('href') || '';
          }
        } else {
          url = el$.attr('href') || '';
        }
        if (url && !url.startsWith('http')) {
          try { url = new URL(url, baseUrl).href; } catch { url = baseUrl + url; }
        }
        chapter.url = url;
      }
      if (chapter.title) results.push(chapter);
    });
    return results.map((ch, i) => ({ ...ch, index: i }));
  }


  async getContent(source: any, book: any, chapter: any): Promise<string | null> {
    setRuleExecutionContext({
      sourceUrl: source.book_source_url || source.bookSourceUrl || '',
      baseUrl: source.book_source_url || source.bookSourceUrl || '',
      source,
    });
    this.initHeaders(source);
    const contentUrl = chapter.url;
    if (!contentUrl) return null;

    const sourceType = source.book_source_type ?? source.bookSourceType ?? 0;

    try {
      let html = await httpRequest(contentUrl, this.headers);

      // 检测是否触发反爬验证
      if (isAntiCrawlPage(html, contentUrl)) {
        console.log(`[WebBookEngine] 检测到反爬验证，使用浏览器渲染: ${source.book_source_name} - ${contentUrl}`);
        try {
          html = await fetchWithBrowser(contentUrl, {
            timeout: 30000,
            waitForTimeout: 3000,
          });
          console.log(`[WebBookEngine] 浏览器渲染成功: ${source.book_source_name} - ${contentUrl}`);
        } catch (browserError: any) {
          console.error(`[WebBookEngine] 浏览器渲染失败: ${source.book_source_name}`, browserError.message);
        }
      }

      const ruleContent = typeof source.rule_content === 'string'
        ? JSON.parse(source.rule_content)
        : (source.rule_content || source.ruleContent || {});

      // 根据书源类型调整解析策略
      if (sourceType === 1) {
        // 音频书源：返回音频 URL 列表（JSON 格式）
        return this.parseAudioContent(html, ruleContent, contentUrl);
      } else if (sourceType === 2) {
        // 图片书源：返回图片 URL 列表（JSON 格式）
        return this.parseImageContent(html, ruleContent, contentUrl);
      } else if (sourceType === 3) {
        // 文件书源：返回下载链接
        return this.parseFileContent(html, ruleContent, contentUrl);
      }

      return this.parseContent(html, ruleContent, contentUrl);
    } catch (e: any) {
      console.error(`[获取内容失败] ${source.book_source_name}:`, e.message);
      return null;
    }
  }

  /**
   * 解析音频内容
   * 返回 JSON 字符串，包含音频 URL 列表
   */
  private parseAudioContent(html: string, rule: any, baseUrl: string): string | null {
    if (!rule.content) return null;
    const contents = executeRule(rule.content, html);
    if (contents.length === 0) return null;

    // 音频内容格式：每行一个音频 URL，或 JSON 数组
    const audioUrls = contents.map(url => {
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        try { return new URL(url, baseUrl).href; } catch { return url; }
      }
      return url;
    });

    return JSON.stringify({ type: 'audio', urls: audioUrls });
  }

  /**
   * 解析图片内容
   * 返回 JSON 字符串，包含图片 URL 列表
   */
  private parseImageContent(html: string, rule: any, baseUrl: string): string | null {
    if (!rule.content) return null;
    const contents = executeRule(rule.content, html);
    if (contents.length === 0) return null;

    const imageUrls = contents.map(url => {
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        try { return new URL(url, baseUrl).href; } catch { return url; }
      }
      return url;
    });

    return JSON.stringify({ type: 'image', urls: imageUrls });
  }

  /**
   * 解析文件下载内容
   * 返回下载链接
   */
  private parseFileContent(html: string, rule: any, baseUrl: string): string | null {
    if (!rule.content) return null;
    const contents = executeRule(rule.content, html);
    if (contents.length === 0) return null;

    const downloadUrl = contents[0];
    if (downloadUrl && !downloadUrl.startsWith('http')) {
      try { return new URL(downloadUrl, baseUrl).href; } catch { return downloadUrl; }
    }
    return downloadUrl;
  }

  private parseContent(html: string, rule: any, baseUrl: string): string | null {
    if (!rule.content) return null;
    const contents = executeRule(rule.content, html);
    if (contents.length === 0) return null;
    let content = contents.join('\n');
    content = content.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match: string, src: string) => {
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try { return match.replace(src, new URL(src, baseUrl).href); } catch { return match; }
      }
      return match;
    });
    if (rule.replaceRegex) {
      const replaces = Array.isArray(rule.replaceRegex) ? rule.replaceRegex : [rule.replaceRegex];
      for (const r of replaces) {
        try {
          const regex = new RegExp(r.pattern, r.flags || 'g');
          content = content.replace(regex, r.replacement || '');
        } catch { /* ignore */ }
      }
    }
    return content;
  }
}

export const webBookEngine = new WebBookEngine();
