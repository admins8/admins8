export const UPDATE_LAST_LOGIN_SQL = 'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?';

export function buildAdminUserSelectSql(whereSql: string): string {
  return `SELECT id, username, email, role, is_active, created_at, last_login_at, updated_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
}
