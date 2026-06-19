import type { SearchBookResult } from './webBookService';

export interface ValidationOutcome {
  ok: boolean;
  /** 命中数量 */
  sampleCount: number;
  /** 耗时 ms */
  respondTime: number;
  /** 用于展示的提示信息 */
  message: string;
}

export interface InterpretInput {
  results?: SearchBookResult[];
  error?: any;
  respondTime: number;
}

/**
 * 把"搜索结果或异常"翻译成统一的验证结论
 */
export function interpretValidationResult(input: InterpretInput): ValidationOutcome {
  const respondTime = Math.max(0, Math.round(input.respondTime || 0));

  if (input.error) {
    return {
      ok: false,
      sampleCount: 0,
      respondTime,
      message: describeError(input.error),
    };
  }

  const results = input.results || [];
  if (results.length === 0) {
    return {
      ok: false,
      sampleCount: 0,
      respondTime,
      message: '搜索结果为空',
    };
  }

  return {
    ok: true,
    sampleCount: results.length,
    respondTime,
    message: `命中 ${results.length} 条 · ${respondTime}ms`,
  };
}

function describeError(err: any): string {
  if (!err) return '未知错误';
  const msg = String(err?.message || err);

  // 超时
  if (/timeout/i.test(msg) || /ETIMEDOUT/i.test(msg) || err?.code === 'ECONNABORTED') {
    return '请求超时';
  }

  // HTTP 错误
  const status = err?.response?.status;
  if (status) {
    return `HTTP ${status}`;
  }

  // 网络层错误
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ECONNRESET') {
    return `网络错误（${err.code}）`;
  }

  // 通用截断
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg;
}
