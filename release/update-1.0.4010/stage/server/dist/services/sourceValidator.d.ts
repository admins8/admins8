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
export declare function interpretValidationResult(input: InterpretInput): ValidationOutcome;
//# sourceMappingURL=sourceValidator.d.ts.map