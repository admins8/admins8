import type mysql from 'mysql2/promise';

export const name = '010_email_config_defaults';

const defaults = [
  ['email_enabled', 'false', '是否启用邮件发送'],
  ['email_from_name', '', '邮件发件人名称'],
  ['email_from_address', '', '邮件发件人地址'],
  ['smtp_host', '', 'SMTP 主机'],
  ['smtp_port', '465', 'SMTP 端口'],
  ['smtp_secure', 'true', 'SMTP 是否使用 SSL/TLS'],
  ['smtp_username', '', 'SMTP 用户名'],
  ['smtp_password', '', 'SMTP 密码'],
  ['pop3_host', '', 'POP3 主机'],
  ['pop3_port', '995', 'POP3 端口'],
  ['pop3_secure', 'true', 'POP3 是否使用 SSL/TLS'],
  ['imap_host', '', 'IMAP 主机'],
  ['imap_port', '993', 'IMAP 端口'],
  ['imap_secure', 'true', 'IMAP 是否使用 SSL/TLS'],
] as const;

export async function up(db: mysql.Pool): Promise<void> {
  for (const [key, value, description] of defaults) {
    await db.query(
      `INSERT INTO site_config (config_key, config_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [key, value, description]
    );
  }
}
