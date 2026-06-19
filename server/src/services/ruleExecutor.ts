import * as cheerio from 'cheerio';
import { JSONPath } from 'jsonpath-plus';
import { runSourceScript } from './safeScriptRunner';
import type { RuleExecutionResult } from './sourceTypes';

function parseJsoupSelector(selector: string, $: cheerio.CheerioAPI, context?: any): any {
  selector = selector.trim().replace(/^@css:\s*/i, '');
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

  const atParts = rule.split('@');
  if (atParts.length <= 1) {
    return parseJsoupSelector(rule, $, context);
  }

  const lastPart = atParts[atParts.length - 1];
  const knownAttrSuffixes = ['text', 'textNodes', 'ownText', 'html', 'all', 'src', 'href',
    'data-original', 'data-src', 'content'];
  const isAttrSuffix = knownAttrSuffixes.includes(lastPart) ||
    lastPart.startsWith('attr.') || lastPart.startsWith('data-');

  if (isAttrSuffix && atParts.length >= 2) {
    const selectorRule = atParts.slice(0, -1).join('@');
    const elements = parseJsoupSelector(selectorRule, $, context);
    const elem = elements.length > 0 ? elements.first() : null;
    if (!elem) return $();

    if (lastPart.startsWith('text')) return elem.text().trim();
    if (lastPart.startsWith('html')) return elem.html() || '';
    if (lastPart.startsWith('href')) return elem.attr('href') || '';
    if (lastPart.startsWith('src')) return elem.attr('src') || '';
    return elem.attr(lastPart) || elem.text().trim();
  }

  let elements = context || $.root();
  for (const part of atParts) {
    if (!part) continue;
    if (elements.length > 0) {
      const allResults: any[] = [];
      elements.each((_: number, el: any) => {
        const result = parseJsoupSelector(part, $, el);
        if (result.length > 0) {
          result.each((__: number, r: any) => allResults.push(r));
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
    case 'src':
    case 'href':
    case 'data-original':
    case 'data-src':
      return el.attr(suffix) || '';
    default:
      if (suffix.startsWith('attr.')) return el.attr(suffix.substring(5)) || '';
      return el.attr(suffix) || '';
  }
}

function normalizeScriptResult(result: unknown): string[] {
  if (Array.isArray(result)) return result.map(String);
  if (typeof result === 'string') return [result];
  if (result === undefined || result === null) return [];
  return [String(result)];
}

function applySimpleResultScript(value: string, script: string): string {
  const code = script.trim().replace(/^js:\s*/, '').replace(/^:/, '').trim();
  if (!code) return value;
  try {
    // 兼容常见 Legado 字段后处理：@js:'https://xx/'+result+'/'、@js:result.replace(...)
    const fn = Function('result', `"use strict"; return (${code});`);
    const output = fn(value);
    return output === undefined || output === null ? '' : String(output);
  } catch {
    return value;
  }
}

export function executeRule(rule: string, html: string, isJson: boolean = false): string[] {
  if (!rule || rule.trim() === '') return [];
  rule = rule.trim().replace(/^@css:\s*/i, '');

  const regexReplaceMatch = rule.match(/^(.+?)##(.+?)##(.+)$/);
  if (regexReplaceMatch) {
    const baseResults = executeRule(regexReplaceMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      const regex = new RegExp(regexReplaceMatch[2], 'g');
      return baseResults.map(r => r.replace(regex, regexReplaceMatch[3]));
    } catch { return baseResults; }
  }

  if (rule.trimStart().startsWith('js:') || rule.trimStart().startsWith('<js>')) {
    const jsCode = rule.replace(/^js:\s*/, '').replace(/^<js>/, '').replace(/<\/js>$/, '');
    try {
      return normalizeScriptResult(runSourceScript(jsCode, { result: null, html }));
    } catch { return []; }
  }

  const inlineJsIndex = rule.indexOf('@js:');
  if (inlineJsIndex > 0) {
    const baseRule = rule.slice(0, inlineJsIndex);
    const script = rule.slice(inlineJsIndex + 1);
    return executeRule(baseRule, html, isJson).map((value) => applySimpleResultScript(value, script)).filter(Boolean);
  }

  for (const chainType of ['||', '&&']) {
    if (rule.includes(chainType)) {
      const parts = rule.split(chainType);
      if (chainType === '||') {
        for (const part of parts) {
          const result = executeRule(part.trim(), html, isJson);
          if (result.length > 0) return result;
        }
        return [];
      }
      let allResults: string[] = [];
      for (const part of parts) {
        allResults = allResults.concat(executeRule(part.trim(), html, isJson));
      }
      return allResults;
    }
  }

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

  if (rule.startsWith('//')) {
    try {
      const { DOMParser } = require('@xmldom/xmldom') as any;
      const { select } = require('xpath') as any;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const nodes = select(rule, doc) as any[];
      const values = nodes.map((node: any) => node.nodeType === 2 ? (node.value || '') : (node.textContent?.trim() || '')).filter(Boolean);
      if (values.length > 0) return values;
    } catch {
      // 继续走下方 Cheerio 降级分支
    }
    const simpleTag = rule.match(/^\/\/([a-zA-Z][\w-]*)$/);
    if (simpleTag) {
      try {
        const $ = cheerio.load(html);
        return $(simpleTag[1]).toArray().map((el) => $(el).text().trim()).filter(Boolean);
      } catch {
        return [];
      }
    }
    return [];
  }

  if (isJson && (/^https?:\/\//i.test(rule) || /^\//.test(rule))) {
    return [rule];
  }

  if (rule.includes('@') && !rule.startsWith('http') && !rule.startsWith('//')) {
    return executeJsoupRule(rule, html, isJson);
  }

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

export function executeRuleResult(rule: string, html: string, isJson: boolean = false): RuleExecutionResult {
  if (!rule || rule.trim() === '') {
    return { ok: false, values: [], reason: 'empty_rule' };
  }
  try {
    const values = executeRule(rule, html, isJson);
    return { ok: values.length > 0, values };
  } catch {
    return { ok: false, values: [], reason: 'parse_error' };
  }
}

function executeJsoupRule(rule: string, html: string, isJson: boolean): string[] {
  const jsTagMatch = rule.match(/^(.+?)<js>(.+?)(?:<\/js>)?$/);
  if (jsTagMatch) {
    const baseResults = executeRule(jsTagMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      return normalizeScriptResult(runSourceScript(jsTagMatch[2], {
        result: baseResults[0],
        html,
        source: { bookSourceUrl: '' },
      }));
    } catch { return []; }
  }

  const jsMatch = rule.match(/^(.+?)@js:(.+)$/);
  if (jsMatch) {
    const baseResults = executeRule(jsMatch[1], html, isJson);
    if (baseResults.length === 0) return [];
    try {
      return normalizeScriptResult(runSourceScript(jsMatch[2], { result: baseResults[0], html }));
    } catch { return []; }
  }

  const $ = cheerio.load(html);
  const atIdx = rule.lastIndexOf('@');
  const selectorPart = atIdx >= 0 ? rule.substring(0, atIdx) : rule;
  let suffix = atIdx >= 0 ? rule.substring(atIdx + 1) : 'text';

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
  if (typeof elements === 'string') return [elements];

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
