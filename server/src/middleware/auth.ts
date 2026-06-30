import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getUserPermissions } from '../services/permissionService';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  permissions?: string[];
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });
}

/** 登录认证中间件 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ code: 401, msg: '未登录，请先登录' });
    return;
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    (req as any).user = decoded;
    // test 角色全局禁止写操作（所有经过 authMiddleware 的 POST/PUT/DELETE/PATCH 请求）
    if (decoded.role === 'test' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      res.status(403).json({ code: 403, msg: '测试账号仅支持预览，不支持操作' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ code: 401, msg: 'Token无效或已过期' });
  }
}

/** 可选认证中间件 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      (req as any).user = decoded;
    } catch {
      // 忽略无效token
    }
  }
  next();
}

/** 管理员权限中间件（允许 admin、superadmin 和有后台权限的普通用户） */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload | undefined;
  if (!user) {
    res.status(403).json({ code: 403, msg: '无管理员权限' });
    return;
  }
  // admin/test/superadmin 直接通过
  if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'test') {
    next();
    return;
  }
  // 普通用户：优先用 token 中的缓存，如果没有则从数据库实时查询
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    next();
    return;
  }
  getUserPermissions(user.userId).then((permissions) => {
    if (permissions.length > 0) {
      // 将查询到的权限附加到 req.user 上，供后续使用
      user.permissions = permissions;
      next();
    } else {
      res.status(403).json({ code: 403, msg: '无管理员权限' });
    }
  }).catch(() => {
    res.status(403).json({ code: 403, msg: '无管理员权限' });
  });
}

/** 超级管理员权限中间件（允许 superadmin 和有后台权限的 admin） */
export function superAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload | undefined;
  if (!user) {
    res.status(403).json({ code: 403, msg: '无超级管理员权限' });
    return;
  }
  // superadmin 直接通过
  if (user.role === 'superadmin') {
    next();
    return;
  }
  // admin/test 角色：优先用 token 缓存，如果没有则实时查数据库
  if (user.role === 'admin' || user.role === 'test') {
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      next();
      return;
    }
    getUserPermissions(user.userId).then((permissions) => {
      if (permissions.length > 0) {
        user.permissions = permissions;
        next();
      } else {
        res.status(403).json({ code: 403, msg: '无超级管理员权限' });
      }
    }).catch(() => {
      res.status(403).json({ code: 403, msg: '无超级管理员权限' });
    });
    return;
  }
  res.status(403).json({ code: 403, msg: '无超级管理员权限' });
}

/** 测试账号只读中间件（禁止 test 角色进行写操作） */
export function testReadonlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JwtPayload | undefined;
  if (user && user.role === 'test') {
    res.status(403).json({ code: 403, msg: '测试账号仅支持预览，不支持操作' });
    return;
  }
  next();
}

/** 自定义角色权限中间件 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ code: 403, msg: '权限不足' });
      return;
    }
    next();
  };
}
