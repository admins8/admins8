import { Request, Response, NextFunction } from 'express';
import { PermissionKey } from '../services/permissionService';
export interface JwtPayload {
    userId: number;
    username: string;
    role: string;
    permissions?: string[];
}
export declare function generateToken(payload: JwtPayload): string;
/** 登录认证中间件 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/** 可选认证中间件 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): void;
/** 管理员权限中间件（允许 admin 和 superadmin） */
export declare function adminMiddleware(req: Request, res: Response, next: NextFunction): void;
/** 超级管理员权限中间件（仅允许 superadmin） */
export declare function superAdminMiddleware(req: Request, res: Response, next: NextFunction): void;
/** 自定义角色权限中间件 */
export declare function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
/** 功能权限中间件：管理员默认拥有全部功能权限，普通用户需单独授权 */
export declare function permissionMiddleware(permission: PermissionKey): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map