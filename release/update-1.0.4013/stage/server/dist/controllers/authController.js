"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = logout;
exports.register = register;
exports.login = login;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const permissionService_1 = require("../services/permissionService");
const emailService_1 = require("../services/emailService");
const userRepository_1 = require("../repositories/userRepository");
function setAuthCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
}
async function logout(_req, res) {
    res.clearCookie('token', { path: '/' });
    res.json({ code: 0, msg: '已退出登录' });
}
// 注册
async function register(req, res) {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            res.json({ code: 400, msg: '用户名、邮箱和密码不能为空' });
            return;
        }
        if (password.length < 6) {
            res.json({ code: 400, msg: '密码长度不能少于6位' });
            return;
        }
        const existing = await (0, userRepository_1.findUserIdByUsernameOrEmail)(username, email);
        if (existing) {
            res.json({ code: 400, msg: '用户名或邮箱已存在' });
            return;
        }
        const passwordHash = bcryptjs_1.default.hashSync(password, 10);
        const userId = await (0, userRepository_1.createUser)(username, email, passwordHash);
        const permissions = await (0, permissionService_1.getUserPermissions)(userId, 'user');
        await (0, userRepository_1.updateUserLastLoginAt)(userId);
        const token = (0, auth_1.generateToken)({
            userId,
            username,
            role: 'user',
            permissions,
        });
        setAuthCookie(res, token);
        res.json({
            code: 0,
            msg: '注册成功',
            data: {
                token,
                user: { id: userId, username, email, role: 'user', permissions },
            },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 登录
async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.json({ code: 400, msg: '用户名和密码不能为空' });
            return;
        }
        const user = await (0, userRepository_1.findUserByUsernameOrEmail)(username);
        if (!user) {
            res.json({ code: 400, msg: '用户不存在' });
            return;
        }
        if (!user.is_active) {
            res.json({ code: 400, msg: '账号已被禁用' });
            return;
        }
        if (!bcryptjs_1.default.compareSync(password, user.password_hash)) {
            res.json({ code: 400, msg: '密码错误' });
            return;
        }
        const permissions = await (0, permissionService_1.getUserPermissions)(user.id, user.role);
        await (0, userRepository_1.updateUserLastLoginAt)(user.id);
        const token = (0, auth_1.generateToken)({
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions,
        });
        setAuthCookie(res, token);
        res.json({
            code: 0,
            msg: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    avatar_url: user.avatar_url,
                    createdAt: user.created_at,
                    permissions,
                },
            },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 获取个人信息
async function getProfile(req, res) {
    try {
        const user = req.user;
        const userInfo = await (0, userRepository_1.findPublicUserById)(user.userId);
        if (!userInfo) {
            res.json({ code: 404, msg: '用户不存在' });
            return;
        }
        const shelfCount = await (0, userRepository_1.countUserBooks)(user.userId);
        const permissions = await (0, permissionService_1.getUserPermissions)(user.userId, userInfo.role);
        res.json({
            code: 0,
            data: { ...userInfo, permissions, shelf_count: shelfCount },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 更新个人信息
async function updateProfile(req, res) {
    try {
        const user = req.user;
        const { email, avatar_url } = req.body;
        if (email) {
            const existing = await (0, userRepository_1.findOtherUserByEmail)(email, user.userId);
            if (existing) {
                res.json({ code: 400, msg: '邮箱已被使用' });
                return;
            }
        }
        await (0, userRepository_1.updateUserProfileRow)(user.userId, email, avatar_url);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 修改密码
async function changePassword(req, res) {
    try {
        const user = req.user;
        const { old_password, new_password } = req.body;
        const userInfo = await (0, userRepository_1.getPasswordHash)(user.userId);
        if (!userInfo || !bcryptjs_1.default.compareSync(old_password, userInfo.password_hash)) {
            res.json({ code: 400, msg: '原密码错误' });
            return;
        }
        const hash = bcryptjs_1.default.hashSync(new_password, 10);
        await (0, userRepository_1.updatePassword)(user.userId, hash);
        res.json({ code: 0, msg: '密码修改成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/**
 * 申请重置密码：输入注册邮箱，生成 6 位数字验证码并通过 SMTP 发送。
 * 用户用这个验证码 + 邮箱 + 新密码即可重置密码。
 *
 * POST /auth/forgot-password  body: { email }
 */
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            res.json({ code: 400, msg: '请输入邮箱' });
            return;
        }
        const user = await (0, userRepository_1.findUserByEmail)(email);
        if (!user) {
            res.json({ code: 404, msg: '该邮箱未注册' });
            return;
        }
        // 生成 6 位数字验证码
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        // 15 分钟有效
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await (0, userRepository_1.createPasswordResetToken)(user.id, email, token, expiresAt);
        await (0, emailService_1.sendPasswordResetCode)(email, token);
        res.json({
            code: 0,
            msg: '验证码已发送，请检查邮箱',
            data: {
                email,
                expiresAt: expiresAt.toISOString(),
                expiresInSeconds: 15 * 60,
            },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/**
 * 重置密码：输入邮箱 + 验证码 + 新密码。
 *
 * POST /auth/reset-password  body: { email, token, new_password }
 */
async function resetPassword(req, res) {
    try {
        const { email, token, new_password } = req.body;
        if (!email || !token || !new_password) {
            res.json({ code: 400, msg: '邮箱、验证码和新密码不能为空' });
            return;
        }
        if (new_password.length < 6) {
            res.json({ code: 400, msg: '密码长度不能少于6位' });
            return;
        }
        const passwordHash = bcryptjs_1.default.hashSync(new_password, 10);
        const resetResult = await (0, userRepository_1.resetPasswordWithToken)(email, token, passwordHash);
        if (resetResult === 'not_found') {
            res.json({ code: 400, msg: '验证码无效' });
            return;
        }
        if (resetResult === 'used') {
            res.json({ code: 400, msg: '该验证码已被使用，请重新获取' });
            return;
        }
        if (resetResult === 'expired') {
            res.json({ code: 400, msg: '验证码已过期，请重新获取' });
            return;
        }
        res.json({ code: 0, msg: '密码重置成功，请用新密码登录' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
//# sourceMappingURL=authController.js.map