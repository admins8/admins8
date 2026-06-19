/**
 * 读取当前运行版本。
 *
 * 优先级：
 * 1) dist/version.txt（混淆构建时由 obfuscate-dist 写入）
 * 2) 项目根 VERSION 文件（开发阶段）
 * 3) 兜底 '0.0.0'
 */
export declare function getCurrentVersion(): string;
/**
 * 比较两个语义化版本号。
 * @returns -1 当 a < b, 0 当 a == b, 1 当 a > b
 */
export declare function compareVersion(a: string, b: string): number;
export declare function isNewer(remote: string, local: string): boolean;
//# sourceMappingURL=versionService.d.ts.map