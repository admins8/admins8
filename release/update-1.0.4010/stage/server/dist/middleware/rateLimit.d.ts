import { Request, Response, NextFunction } from 'express';
type RedisProvider = () => Promise<any | null>;
export declare function createRateLimiter(windowMs: number, maxRequests: number, redisProvider?: RedisProvider): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Redis 优先、内存回退的速率限制中间件
 * @param windowMs 时间窗口（毫秒）
 * @param maxRequests 窗口内最大请求数
 */
export declare function rateLimit(windowMs: number, maxRequests: number): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=rateLimit.d.ts.map