import { Request, Response, NextFunction } from 'express';
import { getActiveLicense, isDomainAllowed } from '../services/licenseService';

/**
 * 域名校验中间件：每个请求根据 host 判断是否在授权范围内。
 *
 * 设计原则：
 * - 启动时如果 license 校验失败，进程会直接退出，因此进入此中间件的请求一定带着 activePayload；
 * - 健康检查 / license 状态接口可由调用方通过 path 跳过；
 * - localhost / 127.0.0.1 默认放行，方便客户在服务器本机调试。
 */
export function licenseDomainGuard(options?: {
  /** 跳过校验的路径前缀 */
  skipPaths?: string[];
  /** 允许的本地 host（默认包含 localhost / 127.0.0.1） */
  allowLocalHosts?: string[];
}) {
  const skipPaths = options?.skipPaths ?? ['/api/health', '/api/license'];
  const localHosts = (options?.allowLocalHosts ?? ['localhost', '127.0.0.1', '::1', 'server'])
    .map(h => h.toLowerCase());

  return function licenseMiddleware(req: Request, res: Response, next: NextFunction): void {
    const reqPath = req.path || '';
    if (skipPaths.some(p => reqPath.startsWith(p))) {
      next();
      return;
    }

    const license = getActiveLicense();
    if (!license) {
      res.status(503).json({ code: 503, msg: '服务尚未授权，请联系供应商提供 license.lic' });
      return;
    }

    const host = String(req.headers['host'] || '').toLowerCase().split(':')[0];
    if (localHosts.includes(host)) {
      next();
      return;
    }

    if (!isDomainAllowed(host, license.domains)) {
      res.status(403).json({
        code: 403,
        msg: `当前域名 ${host} 未在授权范围内`,
        data: { licenseId: license.licenseId },
      });
      return;
    }

    next(