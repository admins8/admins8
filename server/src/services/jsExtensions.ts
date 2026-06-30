/**
 * JS 扩展 API —— 为 isolated-vm 沙箱中的书源脚本提供 Legado 兼容的扩展功能
 *
 * 参考 Legado 的 JsExtensions.kt，提供以下扩展对象：
 * - java: ajax, ajaxAll, connect, get, post
 * - cookie: getCookie, setCookie, removeCookie
 * - cache: get, put, delete
 * - base64: encode, decode
 * - md5/sha1: 哈希计算
 * - encodeURI/decodeURI: URL 编码
 * - source: 书源信息访问
 */

import crypto from 'crypto';
import { httpRequest, UrlOption, buildHeaders } from './bookSourceHttpClient';
import { cookieStore } from './cookieStore';

export interface JsExtensionContext {
  /** 书源 URL */
  sourceUrl: string;
  /** 书源基础 URL */
  baseUrl: string;
  /** 当前页面 HTML */
  html?: string;
  /** 当前规则执行结果 */
  result?: string | string[];
  /** 书源完整信息 */
  source?: Record<string, unknown>;
}

// 内存缓存（用于 cache.get/put）
const memoryCache = new Map<string, { value: string; expires: number }>();

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, item] of memoryCache) {
    if (item.expires < now) {
      memoryCache.delete(key);
    }
  }
}

function cacheGet(key: string): string | undefined {
  cleanExpiredCache();
  const item = memoryCache.get(key);
  if (!item) return undefined;
  if (item.expires < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return item.value;
}

function cachePut(key: string, value: string, ttlSeconds?: number): void {
  const expires = ttlSeconds
    ? Date.now() + ttlSeconds * 1000
    : Date.now() + 3600 * 1000; // 默认 1 小时
  memoryCache.set(key, { value, expires });
}

function cacheDelete(key: string): void {
  memoryCache.delete(key);
}

/**
 * 构建 JS 扩展对象（同步版本，用于 isolated-vm 注入）
 *
 * 注意：isolated-vm 不支持直接注入异步函数，因此 HTTP 请求需要
 * 在沙箱外部预执行或通过同步包装。这里采用"预加载"策略：
 * 在调用 runSourceScript 之前，先执行需要的 HTTP 请求，将结果
 * 作为参数传入沙箱。
 */
export function buildJsExtensions(context: JsExtensionContext) {
  const sourceUrl = context.sourceUrl;
  const baseUrl = context.baseUrl;

  return {
    // ========== HTTP 请求（同步包装）==========
    /**
     * 发起 HTTP 请求（同步阻塞式，用于 isolated-vm）
     * 注意：此函数在沙箱内部通过 deasync 或预加载方式实现同步调用
     */
    ajax: (url: string, options?: any): string => {
      // 同步 HTTP 请求需要使用 deasync 或类似的同步化包装
      // 这里返回一个占位符，实际实现见 buildJsExtensionsAsync
      throw new Error(
        'java.ajax() 需要在异步上下文中使用。请在沙箱外部预加载数据，或通过 buildJsExtensionsAsync 获取异步版本。'
      );
    },

    // ========== Cookie 管理 ==========
    cookie: {
      /**
       * 获取指定 URL 的 Cookie 字符串
       */
      getCookie: (url?: string): string => {
        return cookieStore.getCookieString(url || sourceUrl);
      },
      /**
       * 设置 Cookie
       */
      setCookie: (cookieStr: string, url?: string): void => {
        cookieStore.saveCookies(url || sourceUrl, [cookieStr]);
      },
      /**
       * 移除指定域名的所有 Cookie
       */
      removeCookie: (domain: string): void => {
        cookieStore.clearDomain(domain);
      },
    },

    // ========== 缓存 ==========
    cache: {
      get: (key: string): string | undefined => cacheGet(key),
      put: (key: string, value: string, ttlSeconds?: number): void =>
        cachePut(key, value, ttlSeconds),
      delete: (key: string): void => cacheDelete(key),
    },

    // ========== 编码 ==========
    base64: {
      encode: (str: string): string => Buffer.from(str).toString('base64'),
      decode: (str: string): string => Buffer.from(str, 'base64').toString('utf-8'),
    },

    // ========== 哈希 ==========
    md5: (str: string): string =>
      crypto.createHash('md5').update(str).digest('hex'),
    sha1: (str: string): string =>
      crypto.createHash('sha1').update(str).digest('hex'),

    // ========== URL 编码 ==========
    encodeURI: (str: string): string => encodeURIComponent(str),
    decodeURI: (str: string): string => decodeURIComponent(str),

    // ========== 书源信息 ==========
    source: {
      getKey: (): string => sourceUrl,
      getUrl: (): string => sourceUrl,
      getBaseUrl: (): string => baseUrl,
    },

    // ========== 工具函数 ==========
    /**
     * 获取当前时间戳（毫秒）
     */
    getTime: (): number => Date.now(),
    /**
     * 生成 UUID
     */
    getUUID: (): string =>
      crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    /**
     * 字符串替换（支持正则）
     */
    replace: (str: string, search: string, replacement: string): string => {
      try {
        const regex = new RegExp(search, 'g');
        return str.replace(regex, replacement);
      } catch {
        return str.replace(search, replacement);
      }
    },
  };
}

/**
 * 构建包含异步 HTTP 请求的 JS 扩展对象
 * 用于在非 isolated-vm 环境（如 node:vm 后备）或预加载场景
 */
export function buildJsExtensionsAsync(context: JsExtensionContext) {
  const base = buildJsExtensions(context);
  const sourceUrl = context.sourceUrl;

  return {
    ...base,
    // 异步版本的 HTTP 请求
    ajax: async (url: string, options?: any): Promise<string> => {
      const opt: UrlOption = {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        charset: options?.charset,
        timeoutMs: options?.timeout || 15000,
      };
      const headers = buildHeaders(
        context.source?.header ? String(context.source.header) : null
      );
      return httpRequest(url, headers, opt);
    },
    /**
     * 并行发起多个 HTTP 请求
     */
    ajaxAll: async (requests: any[]): Promise<string[]> => {
      const headers = buildHeaders(
        context.source?.header ? String(context.source.header) : null
      );
      return Promise.all(
        requests.map((r) => {
          const opt: UrlOption = {
            method: r.method || 'GET',
            headers: r.headers,
            body: r.body,
            charset: r.charset,
            timeoutMs: r.timeout || 15000,
          };
          return httpRequest(r.url, headers, opt);
        })
      );
    },
    /**
     * 简化的 GET 请求
     */
    get: async (url: string, headers?: Record<string, string>): Promise<string> => {
      const defaultHeaders = buildHeaders(
        context.source?.header ? String(context.source.header) : null
      );
      return httpRequest(url, { ...defaultHeaders, ...headers }, { method: 'GET' });
    },
    /**
     * 简化的 POST 请求
     */
    post: async (
      url: string,
      body: string,
      headers?: Record<string, string>
    ): Promise<string> => {
      const defaultHeaders = buildHeaders(
        context.source?.header ? String(context.source.header) : null
      );
      return httpRequest(url, { ...defaultHeaders, ...headers }, { method: 'POST', body });
    },
  };
}
