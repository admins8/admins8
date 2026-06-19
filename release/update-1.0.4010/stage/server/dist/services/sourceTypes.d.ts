export interface BookSourceRow {
    id?: number;
    book_source_url: string;
    book_source_name: string;
    book_source_group?: string | null;
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
//# sourceMappingURL=sourceTypes.d.ts.map