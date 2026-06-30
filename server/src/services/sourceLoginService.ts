/**
 * 书源登录服务
 *
 * 支持需要登录才能访问的书源。解析 loginUrl、loginUi、loginCheckJs，
 * 实现登录流程并保存登录后的 Cookie。
 */

import { httpRequest, buildHeaders } from './bookSourceHttpClient';
import { cookieStore } from './cookieStore';
import { runSourceScript } from './safeScriptRunner';
import { setRuleExecutionContext } from './ruleExecutor';

export interface LoginUiField {
  /** 字段名称（对应表单字段） */
  name: string;
  /** 显示标题 */
  title: string;
  /** 字段类型：text, password, select, checkbox */
  type?: string;
  /** 默认值 */
  value?: string;
  /** 选项（type=select 时） */
  options?: { label: string; value: string }[];
}

export interface LoginResult {
  success: boolean;
  message?: string;
  cookies?: string[];
}

/**
 * 解析登录 UI 配置
 *
 * loginUi 格式示例：
 * - JSON 数组: [{"name":"username","title":"用户名"},{"name":"password","title":"密码","type":"password"}]
 * - 简单字符串: "username\npassword"
 */
export function parseLoginUi(loginUi: string | null | undefined): LoginUiField[] {
  if (!loginUi || loginUi.trim() === '') {
    return [];
  }

  // 尝试 JSON 解析
  if (loginUi.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(loginUi);
      if (Array.isArray(parsed)) {
        return parsed.map((field: any) => ({
          name: field.name || field.key || '',
          title: field.title || field.label || field.name || '',
          type: field.type || 'text',
          value: field.value || '',
          options: field.options || [],
        }));
      }
    } catch {
      // 不是 JSON
    }
  }

  // 简单换行分隔格式
  return loginUi
    .split('\n')
    .filter((line) => line.trim())
    .map((line, idx) => {
      const parts = line.split(',');
      return {
        name: parts[0]?.trim() || `field_${idx}`,
        title: parts[1]?.trim() || parts[0]?.trim() || `字段 ${idx + 1}`,
        type: idx === 0 ? 'text' : 'password',
        value: '',
      };
    });
}

/**
 * 解析登录 URL
 *
 * loginUrl 格式示例：
 * - 简单 URL: "https://example.com/login"
 * - 带 JSON 选项: "https://example.com/login,{\"method\":\"POST\"}"
 * - 带 JS: "https://example.com/login,{"method":"POST","body":"username={{username}}&password={{password}}"}"
 */
export function parseLoginUrl(loginUrl: string): {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  charset?: string;
} {
  const jsonMatch = loginUrl.match(/^(https?:\/\/\S+?),\s*(\{.+\})$/s);
  if (jsonMatch) {
    try {
      const options = JSON.parse(jsonMatch[2]);
      return {
        url: jsonMatch[1],
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        charset: options.charset,
      };
    } catch {
      return { url: jsonMatch[1], method: 'GET' };
    }
  }

  return { url: loginUrl, method: 'GET' };
}

/**
 * 执行书源登录
 *
 * @param source 书源对象
 * @param formData 表单数据（字段名 -> 值）
 */
export async function executeSourceLogin(
  source: any,
  formData: Record<string, string>
): Promise<LoginResult> {
  const sourceName = source.book_source_name || source.bookSourceName || '未知';
  const sourceUrl = source.book_source_url || source.bookSourceUrl || '';
  const loginUrl = source.login_url || source.loginUrl;

  if (!loginUrl) {
    return { success: false, message: '该书源没有配置登录URL' };
  }

  setRuleExecutionContext({
    sourceUrl,
    baseUrl: sourceUrl,
    source,
  });

  try {
    const parsed = parseLoginUrl(loginUrl);

    // 替换 body 中的变量引用
    let body = parsed.body || '';
    for (const [key, value] of Object.entries(formData)) {
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), encodeURIComponent(value));
    }

    const headers = buildHeaders(source.header ? String(source.header) : null);

    const html = await httpRequest(parsed.url, headers, {
      method: parsed.method,
      body: parsed.method !== 'GET' ? body : undefined,
      charset: parsed.charset,
    });

    // 保存登录后的 Cookie
    const setCookieHeaders = html; // httpRequest 返回的内容可能包含 cookie
    // Cookie 已在 httpRequest 中通过 cookieStore 自动保存

    // 执行登录检查脚本
    const loginCheckJs = source.login_check_js || source.loginCheckJs;
    if (loginCheckJs) {
      const checkResult = runSourceScript(loginCheckJs, {
        result: null,
        html,
        source,
      }, { sourceUrl, baseUrl: sourceUrl, source });

      if (checkResult === false || checkResult === 0 || checkResult === '') {
        return { success: false, message: '登录验证失败' };
      }
    }

    console.log(`[书源登录成功] ${sourceName}`);
    return { success: true, message: '登录成功' };
  } catch (e: any) {
    console.error(`[书源登录失败] ${sourceName}:`, e.message);
    return { success: false, message: e.message };
  }
}

/**
 * 检查书源是否已登录
 *
 * 通过执行 loginCheckJs 验证当前登录状态
 */
export async function checkSourceLoginStatus(source: any): Promise<boolean> {
  const loginCheckJs = source.login_check_js || source.loginCheckJs;
  if (!loginCheckJs) {
    // 没有检查脚本，假设不需要登录
    return true;
  }

  const sourceUrl = source.book_source_url || source.bookSourceUrl || '';
  setRuleExecutionContext({
    sourceUrl,
    baseUrl: sourceUrl,
    source,
  });

  try {
    // 获取书源首页来检查登录状态
    const headers = buildHeaders(source.header ? String(source.header) : null);
    const html = await httpRequest(sourceUrl, headers);

    const result = runSourceScript(loginCheckJs, {
      result: null,
      html,
      source,
    }, { sourceUrl, baseUrl: sourceUrl, source });

    return result !== false && result !== 0 && result !== '';
  } catch {
    return false;
  }
}
