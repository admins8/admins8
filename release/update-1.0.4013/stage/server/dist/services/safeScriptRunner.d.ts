import type { RuleExecutionContext } from './sourceTypes';
export type ScriptContext = RuleExecutionContext;
export interface NodeVmFallbackOptions {
    nodeEnv?: string;
    allowFallback?: string;
}
export declare function canUseNodeVmFallback(options?: NodeVmFallbackOptions): boolean;
export declare function runSourceScript(code: string, context?: ScriptContext): unknown;
//# sourceMappingURL=safeScriptRunner.d.ts.map