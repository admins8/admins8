import { config } from '../config';
import type { RuleExecutionContext } from './sourceTypes';
import { buildJsExtensions, type JsExtensionContext } from './jsExtensions';
import { ruleVariables } from './ruleCache';

export type ScriptContext = RuleExecutionContext;

export interface NodeVmFallbackOptions {
  nodeEnv?: string;
  allowFallback?: string;
}

export interface RunScriptOptions {
  /** 书源 URL，用于构建扩展 API 的上下文 */
  sourceUrl?: string;
  /** 书源基础 URL */
  baseUrl?: string;
  /** 书源完整信息 */
  source?: Record<string, unknown>;
}

export function canUseNodeVmFallback(options: NodeVmFallbackOptions = {}): boolean {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const allowFallback = Object.prototype.hasOwnProperty.call(options, 'allowFallback')
    ? options.allowFallback
    : process.env.ALLOW_SOURCE_JS_VM_FALLBACK;

  return nodeEnv !== 'production' && allowFallback === 'true';
}

function isSourceJsEnabled(): boolean {
  return config.security.enableSourceJs || process.env.ENABLE_SOURCE_JS === 'true';
}

/**
 * 将扩展对象扁平化为适合注入沙箱的键值对
 * isolated-vm 的 setSync 只支持基本类型和 Reference
 */
function flattenExtensions(extensions: ReturnType<typeof buildJsExtensions>): Record<string, any> {
  const flat: Record<string, any> = {};

  // Cookie 管理
  flat['cookie_getCookie'] = extensions.cookie.getCookie;
  flat['cookie_setCookie'] = extensions.cookie.setCookie;
  flat['cookie_removeCookie'] = extensions.cookie.removeCookie;

  // 缓存
  flat['cache_get'] = extensions.cache.get;
  flat['cache_put'] = extensions.cache.put;
  flat['cache_delete'] = extensions.cache.delete;

  // 编码
  flat['base64_encode'] = extensions.base64.encode;
  flat['base64_decode'] = extensions.base64.decode;

  // 哈希
  flat['md5'] = extensions.md5;
  flat['sha1'] = extensions.sha1;

  // URL 编码
  flat['encodeURI'] = extensions.encodeURI;
  flat['decodeURI'] = extensions.decodeURI;

  // 书源信息
  flat['source_getKey'] = extensions.source.getKey;
  flat['source_getUrl'] = extensions.source.getUrl;
  flat['source_getBaseUrl'] = extensions.source.getBaseUrl;

  // 工具函数
  flat['getTime'] = extensions.getTime;
  flat['getUUID'] = extensions.getUUID;
  flat['replace'] = extensions.replace;

  // 变量系统 (put/get)
  flat['rule_put'] = (key: string, value: any) => ruleVariables.put(key, value);
  flat['rule_get'] = (key: string) => ruleVariables.get(key);

  return flat;
}

/**
 * 生成在沙箱中重建扩展对象的 JS 代码
 */
function buildExtensionBootstrapCode(): string {
  return `
    var java = {
      cookie: {
        getCookie: function(url) { return cookie_getCookie(url); },
        setCookie: function(str, url) { return cookie_setCookie(str, url); },
        removeCookie: function(domain) { return cookie_removeCookie(domain); }
      },
      cache: {
        get: function(key) { return cache_get(key); },
        put: function(key, value, ttl) { return cache_put(key, value, ttl); },
        delete: function(key) { return cache_delete(key); }
      },
      base64: {
        encode: function(str) { return base64_encode(str); },
        decode: function(str) { return base64_decode(str); }
      },
      md5: function(str) { return md5(str); },
      sha1: function(str) { return sha1(str); },
      encodeURI: function(str) { return encodeURI(str); },
      decodeURI: function(str) { return decodeURI(str); },
      source: {
        getKey: function() { return source_getKey(); },
        getUrl: function() { return source_getUrl(); },
        getBaseUrl: function() { return source_getBaseUrl(); }
      },
      getTime: function() { return getTime(); },
      getUUID: function() { return getUUID(); },
      replace: function(str, search, replacement) { return replace(str, search, replacement); },
      put: function(key, value) { return rule_put(key, value); },
      get: function(key) { return rule_get(key); }
    };
  `;
}

function runFallbackVm(code: string, context: ScriptContext, options?: RunScriptOptions): unknown {
  const vm = require('node:vm') as typeof import('node:vm');

  // 构建扩展上下文
  const extContext: JsExtensionContext = {
    sourceUrl: options?.sourceUrl || '',
    baseUrl: options?.baseUrl || '',
    html: context.html,
    result: context.result,
    source: options?.source,
  };
  const extensions = buildJsExtensions(extContext);
  const flatExt = flattenExtensions(extensions);

  const sandbox: Record<string, any> = {
    RESULT: context.result ?? null,
    HTML: context.html ?? '',
    SOURCE: context.source ?? {},
    ...flatExt,
  };

  const ctx = vm.createContext(sandbox, {
    name: 'source-rule-fallback',
    codeGeneration: { strings: true, wasm: false },
  });

  const script = new vm.Script(`
    "use strict";
    ${buildExtensionBootstrapCode()}
    (function(result, html, source) {
      ${code}
    })(RESULT, HTML, SOURCE);
  `);
  return script.runInContext(ctx, { timeout: 1000 });
}

export function runSourceScript(
  code: string,
  context: ScriptContext = {},
  options?: RunScriptOptions
): unknown {
  if (!isSourceJsEnabled()) {
    return undefined;
  }

  let ivm: typeof import('isolated-vm');
  try {
    ivm = require('isolated-vm') as typeof import('isolated-vm');
  } catch (err: any) {
    if (!canUseNodeVmFallback()) {
      console.error(
        '[safeScriptRunner] isolated-vm 不可用，当前环境已禁用 node:vm 后备执行:',
        err.message
      );
      return undefined;
    }
    console.warn('[safeScriptRunner] isolated-vm 不可用，使用受限 node:vm 后备执行:', err.message);
    return runFallbackVm(code, context, options);
  }

  // 构建扩展上下文
  const extContext: JsExtensionContext = {
    sourceUrl: options?.sourceUrl || '',
    baseUrl: options?.baseUrl || '',
    html: context.html,
    result: context.result,
    source: options?.source,
  };
  const extensions = buildJsExtensions(extContext);
  const flatExt = flattenExtensions(extensions);

  const isolate = new ivm.Isolate({ memoryLimit: 32 });
  try {
    const script = isolate.compileScriptSync(`
      "use strict";
      ${buildExtensionBootstrapCode()}
      (function(result, html, source) {
        ${code}
      })(RESULT, HTML, SOURCE);
    `);

    const ctx = isolate.createContextSync();
    const jail = ctx.global;

    // 注入基本变量
    jail.setSync('RESULT', context.result ?? null);
    jail.setSync('HTML', context.html ?? '');
    jail.setSync('SOURCE', context.source ?? {});

    // 注入扩展 API 函数
    for (const [key, fn] of Object.entries(flatExt)) {
      if (typeof fn === 'function') {
        jail.setSync(key, new ivm.Reference(fn));
      } else {
        jail.setSync(key, fn);
      }
    }

    const result = script.runSync(ctx, { timeout: 5000 });
    return result;
  } catch (err: any) {
    console.error('[safeScriptRunner] 脚本执行失败:', err.message);
    return undefined;
  } finally {
    isolate.dispose();
  }
}
