import { Request, Response, NextFunction } from 'express';
/**
 * 域名校验中间件：每个请求根据 host 判断是否在授权范围内。
 *
 * 设计原则：
 * - 启动时如果 license 校验失败，进程会直接退出，因此进入此中间件的请求一定带着 activePayload；
 * - 健康检查 / license 状态接口可由调用方通过 path 跳过；
 * - localhost / 127.0.0.1 默认放行，方便客户在服务器本机调试。
 */
export declare function licenseDomainGuard(options?: {
    /** 跳过校验的路径前缀 */
    skipPaths?: string[];
    /** 允许的本地 host（默认包含 localhost / 127.0.0.1） */
    allowLocalHosts?: string[];
}): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=licenseGuard.d.ts.map