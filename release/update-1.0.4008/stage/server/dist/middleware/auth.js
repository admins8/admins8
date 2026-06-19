"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.authMiddleware = authMiddleware;
exports.optionalAuth = optionalAuth;
exports.adminMiddleware = adminMiddleware;
exports.superAdminMiddleware = superAdminMiddleware;
exports.requireRole = requireRole;
exports.permissionMiddleware = permissionMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const permissionService_1 = require("../services/permissionService");
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
        expiresIn: config_1.config.jwt.expiresIn,
    });
}
/** 从请求中提取 JWT Token（Header > Cookie） */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    if (req.cookies?.token) {
        return req.cookies.token;
    }
    return undefined;
}
/** 登录认证中间件 */
function authMiddleware(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ code: 401, msg: '未登录，请先登录' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ code: 401, msg: 'Token无效或已过期' });
    }
}
/** 可选认证中间件 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            req.user = decoded;
        }
        catch {
            // 忽略无效token
        }
    }
    next();
}
/** 管理员权限中间件（允许 admin 和 superadmin） */
function adminMiddleware(req, res, next) {
    const user = req.user;
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
        res.status(403).json({ code: 403, msg: '无管理员权限' });
        return;
    }
    next();
}
/** 超级管理员权限中间件（仅允许 superadmin） */
function superAdminMiddleware(req, res, next) {
    const user = req.user;
    if (!user || user.role !== 'superadmin') {
        res.status(403).json({ code: 403, msg: '无超级管理员权限' });
        return;
    }
    next();
}
/** 自定义角色权限中间件 */
function requireRole(roles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            res.status(403).json({ code: 403, msg: '权限不足' });
            return;
        }
        next();
    };
}
/** 功能权限中间件：管理员默认拥有全部功能权限，普通用户需单独授权 */
function permissionMiddleware(permission) {
    return async (req, res, next) => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ code: 401, msg: '未登录，请先登录' });
            return;
        }
        if ((0, permissionService_1.roleHasPermission)(user.role, permission)) {
            next();
            return;
        }
        const permissions = user.permissions || await (0, permissionService_1.getUserPermissions)(user.userId, user.role);
        if (!permissions.includes(permission)) {
            res.status(403).json({ code: 403, msg: '无功能权限' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map