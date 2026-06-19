import { Request, Response } from 'express';
export declare function logout(_req: Request, res: Response): Promise<void>;
export declare function register(req: Request, res: Response): Promise<void>;
export declare function login(req: Request, res: Response): Promise<void>;
export declare function getProfile(req: Request, res: Response): Promise<void>;
export declare function updateProfile(req: Request, res: Response): Promise<void>;
export declare function changePassword(req: Request, res: Response): Promise<void>;
/**
 * 申请重置密码：输入注册邮箱，生成 6 位数字验证码并通过 SMTP 发送。
 * 用户用这个验证码 + 邮箱 + 新密码即可重置密码。
 *
 * POST /auth/forgot-password  body: { email }
 */
export declare function forgotPassword(req: Request, res: Response): Promise<void>;
/**
 * 重置密码：输入邮箱 + 验证码 + 新密码。
 *
 * POST /auth/reset-password  body: { email, token, new_password }
 */
export declare function resetPassword(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=authController.d.ts.map