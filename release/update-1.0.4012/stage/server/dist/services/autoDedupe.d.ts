/**
 * 自动去重定时调度器
 * 从 site_config 读取 auto_dedupe_interval_days 配置（天数），
 * 每隔指定天数自动执行一次书籍去重。
 * 设为 0 或空则不执行。
 */
declare class AutoDedupeScheduler {
    private timer;
    private lastRun;
    /** 启动调度器 */
    start(): Promise<void>;
    /** 重新加载配置并重启 */
    reload(): Promise<void>;
    /** 停止调度器 */
    stop(): void;
    /** 获取配置的间隔天数 */
    private getInterval;
    /** 设置定时器（天 → 毫秒） */
    private schedule;
    /** 执行自动去重 */
    private run;
    /** 去重核心逻辑（复用 adminController 的逻辑） */
    private dedupe;
}
export declare const autoDedupeScheduler: AutoDedupeScheduler;
export {};
//# sourceMappingURL=autoDedupe.d.ts.map