/**
 * 升级执行器：将解压后的升级包应用到当前部署目录。
 *
 * 输入：extractDir，目录内布局应为：
 *   extractDir/
 *     server/dist/...     -> 写入到 <serverInstallDir>/dist
 *     web/dist/...        -> 写入到 <webInstallDir>/dist
 *     version.txt
 *     migrations/         (可选，若需要 SQL 迁移可在此放置)
 *
 * 步骤：
 *   1. 备份当前 server/dist 与 web/dist 到 <backupDir>/<ts>/
 *   2. 原子替换：先写入 dist.new，再 rename dist -> dist.old，再 rename dist.new -> dist
 *   3. 调用 PM2 reload 实现零停机重启；若失败则自动回滚
 *   4. 写入 update-history.json
 */
export interface InstallOptions {
    extractDir: string;
    fromVersion: string;
    toVersion: string;
    /** 当前 server 安装根（包含 dist） */
    serverRoot: string;
    /** 当前 web 安装根（包含 dist） */
    webRoot?: string;
    /** PM2 进程名，若为空则跳过 PM2 reload */
    pm2Name?: string;
    /** 备份根目录 */
    backupDir?: string;
    /** 历史记录文件 */
    historyFile?: string;
    /** 触发人，用于历史记录 */
    operator?: string;
}
export interface InstallResult {
    success: boolean;
    fromVersion: string;
    toVersion: string;
    backupPath?: string;
    error?: string;
    rolledBack?: boolean;
    startedAt: string;
    finishedAt: string;
}
export interface HistoryRecord extends InstallResult {
    id: string;
    operator?: string;
}
/** 复制目录（递归） */
export declare function copyDir(src: string, dest: string): void;
export interface Pm2CommandResult {
    status: number | null;
    stdout?: string;
    stderr?: string;
    error?: Error;
}
export interface RestartPm2Options {
    pm2Bin?: string;
    runner?: (command: string, args: string[]) => Pm2CommandResult;
    detachedRunner?: (command: string, args: string[]) => Pm2CommandResult;
}
export declare function restartPm2Process(name: string, options?: RestartPm2Options): {
    success: boolean;
    output: string;
    error?: string;
};
/** 安装升级包 */
export declare function installUpdate(opts: InstallOptions): InstallResult;
export declare function readHistory(file?: string): HistoryRecord[];
/**
 * 手动回滚到指定备份目录
 */
export declare function rollbackTo(backupPath: string, opts: {
    serverRoot: string;
    webRoot?: string;
    pm2Name?: string;
}): InstallResult;
//# sourceMappingURL=updateExecutor.d.ts.map