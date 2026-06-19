"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '009_password_reset_tokens';
/**
 * 密码重置令牌表。
 * 流程：
 *   1. 用户在登录页点击"忘记密码"，输入注册邮箱
 *   2. 后端生成 6 位数字验证码，写入本表
 *   3. 后端通过已配置 SMTP 发送验证码
 *   4. 用户输入验证码 + 新密码 → 后端验证 token 合法且未过期 → 重置密码
 */
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      email VARCHAR(200) NOT NULL,
      token VARCHAR(32) NOT NULL,              -- 6位数字验证码，或 uuid 令牌
      expires_at DATETIME NOT NULL,            -- 过期时间（默认 15 分钟）
      used_at DATETIME DEFAULT NULL,            -- 使用时间（NULL 表示未使用）
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pwd_reset_user_id (user_id),
      INDEX idx_pwd_reset_email (email),
      INDEX idx_pwd_reset_token (token),
      INDEX idx_pwd_reset_email_token (email, token),
      CONSTRAINT fk_pwd_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
//# sourceMappingURL=009_password_reset_tokens.js.map