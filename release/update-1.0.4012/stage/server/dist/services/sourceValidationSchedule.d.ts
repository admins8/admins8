import { interpretValidationResult } from './sourceValidator';
export declare const DEFAULT_SOURCE_VALIDATE_KEYWORD = "\u8BE1\u79D8\u4E4B\u4E3B";
export declare const DEFAULT_SOURCE_VALIDATE_TIMEOUT = 15000;
export declare const DEFAULT_SOURCE_VALIDATE_CONCURRENCY = 5;
export type SourceValidationFailureAction = 'none' | 'disable' | 'delete';
export type SourceValidationScope = 'enabled' | 'all' | 'failed';
export interface SourceValidationScheduleSettings {
    enabled: boolean;
    day: number;
    hour: number;
    minute: number;
    keyword: string;
    timeoutMs: number;
    concurrency: number;
    scope: SourceValidationScope;
    failureAction: SourceValidationFailureAction;
    lastRunKey: string;
    lastRunAt: string;
    lastResult: {
        total: number;
        okCount: number;
        failCount: number;
        disabledCount: number;
        deletedCount: number;
        message: string;
    };
}
export declare function normalizeSourceValidationSchedule(input: Record<string, unknown>): SourceValidationScheduleSettings;
export declare function buildSourceValidationRunKey(date: Date): string;
export declare function shouldRunSourceValidationSchedule(settings: SourceValidationScheduleSettings, now: Date, lastRunKey: string, running: boolean): boolean;
export declare function validateOneSource(source: any, keywords: string[], timeoutMs: number): Promise<import("./sourceValidator").ValidationOutcome>;
export declare function persistValidationResult(id: number, outcome: ReturnType<typeof interpretValidationResult>): Promise<void>;
export declare function getSourceValidationScheduleSettings(): Promise<SourceValidationScheduleSettings>;
export declare function saveSourceValidationScheduleSettings(input: Partial<SourceValidationScheduleSettings>): Promise<SourceValidationScheduleSettings>;
export declare function runSourceValidationSchedule(settings?: SourceValidationScheduleSettings): Promise<{
    total: number;
    okCount: number;
    failCount: number;
    disabledCount: number;
    deletedCount: number;
    message: string;
}>;
declare class SourceValidationScheduler {
    private timer;
    private running;
    start(): void;
    stop(): void;
    reload(): Promise<void>;
    private tick;
}
export declare const sourceValidationScheduler: SourceValidationScheduler;
export {};
//# sourceMappingURL=sourceValidationSchedule.d.ts.map