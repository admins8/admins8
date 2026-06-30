/**
 * 书源类型枚举
 * 对应 Legado 的 BookSourceType
 */
export enum BookSourceType {
  TEXT = 0,    // 文本小说
  AUDIO = 1,   // 有声小说
  IMAGE = 2,   // 漫画/图片
  FILE = 3,    // 文件下载
}

export interface BookSourceRow {
  id?: number;
  book_source_url: string;
  book_source_name: string;
  book_source_group?: string | null;
  book_source_type?: number;  // BookSourceType
  enabled?: number | boolean;
  header?: string | null;
  search_url?: string | null;
  rule_search?: string | null;
  rule_book_info?: string | null;
  rule_toc?: string | null;
  rule_content?: string | null;
  [key: string]: unknown;
}

export interface RuleExecutionContext {
  result?: string | string[] | null;
  html?: string;
  source?: Record<string, unknown>;
}

export interface RuleExecutionResult {
  ok: boolean;
  values: string[];
  reason?: 'empty_rule' | 'js_disabled' | 'js_error' | 'parse_error';
}
