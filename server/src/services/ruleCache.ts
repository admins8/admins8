/**
 * 规则缓存
 *
 * 缓存编译后的正则表达式和解析后的规则对象，避免重复解析。
 * 同时提供变量存储系统（put/get），支持规则链中传递数据。
 */

// ========== 正则/规则缓存 ==========

const regexCache = new Map<string, RegExp>();
const ruleJsonCache = new Map<string, any>();
const MAX_CACHE_SIZE = 500;

function evictIfNeeded(cache: Map<any, any>): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    // 简单策略：清除最早的一半
    const keys = Array.from(cache.keys());
    for (let i = 0; i < keys.length / 2; i++) {
      cache.delete(keys[i]);
    }
  }
}

/**
 * 获取缓存的正则表达式
 */
export function getCachedRegex(pattern: string, flags?: string): RegExp {
  const key = `${pattern}|${flags || ''}`;
  let regex = regexCache.get(key);
  if (!regex) {
    regex = new RegExp(pattern, flags);
    evictIfNeeded(regexCache);
    regexCache.set(key, regex);
  }
  return regex;
}

/**
 * 获取缓存的 JSON 规则对象
 */
export function getCachedRuleJson(jsonStr: string): any {
  let rule = ruleJsonCache.get(jsonStr);
  if (!rule) {
    try {
      rule = JSON.parse(jsonStr);
      evictIfNeeded(ruleJsonCache);
      ruleJsonCache.set(jsonStr, rule);
    } catch {
      rule = null;
    }
  }
  return rule;
}

/**
 * 清除所有缓存
 */
export function clearRuleCache(): void {
  regexCache.clear();
  ruleJsonCache.clear();
}

// ========== 变量存储系统 ==========

/**
 * 规则执行变量存储
 *
 * 支持在 JS 脚本中通过 put(key, value) 存储变量，
 * 后续规则可通过 {{key}} 或 get(key) 读取。
 */
class RuleVariableStore {
  private store = new Map<string, any>();

  /**
   * 存储变量
   */
  put(key: string, value: any): void {
    this.store.set(key, value);
  }

  /**
   * 读取变量
   */
  get(key: string): any {
    return this.store.get(key);
  }

  /**
   * 检查变量是否存在
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * 删除变量
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 清除所有变量
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 获取所有变量
   */
  all(): Record<string, any> {
    return Object.fromEntries(this.store);
  }

  /**
   * 替换字符串中的变量引用 {{key}}
   */
  replaceVariables(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = this.store.get(key);
      return value !== undefined ? String(value) : '';
    });
  }
}

// 全局变量存储实例
export const ruleVariables = new RuleVariableStore();
