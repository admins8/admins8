import type mysql from 'mysql2/promise';
export declare const name = "009_password_reset_tokens";
/**
 * 密码重置令牌表。
 * 流程：
 *   1. 用户在登录页点击"忘记密码"，输入注册邮箱
 *   2. 后端生成 6 位数字验证码，写入本表
 *   3. 后端通过已配置 SMTP 发送验证码
 *   4. 用户输入验证码 + 新密码 → 后端验证 token 合法且未过期 → 重置密码
 */
export declare function up(db: mysql.Pool): Promise<void>;
//# sourceMappingURL=009_password_reset_tokens.d.ts.map