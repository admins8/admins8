import { execute, queryOne, transaction } from '../config/database';
import { UPDATE_LAST_LOGIN_SQL } from '../services/userLoginAudit';

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string;
  role: string;
  is_active: number;
  created_at?: string;
  last_login_at?: string | null;
}

export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  expires_at: Date | string;
  used_at: Date | string | null;
}

export async function findUserByUsernameOrEmail(usernameOrEmail: string): Promise<UserRow | null> {
  return queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [usernameOrEmail, usernameOrEmail]);
}

export async function findUserIdByUsernameOrEmail(username: string, email: string): Promise<{ id: number } | null> {
  return queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
}

export async function findUserByEmail(email: string): Promise<Pick<UserRow, 'id' | 'username' | 'email'> | null> {
  return queryOne('SELECT id, username, email FROM users WHERE email = ?', [email]);
}

export async function findPublicUserById(
  id: number
): Promise<(Omit<UserRow, 'password_hash' | 'is_active' | 'created_at'> & { createdAt?: string }) | null> {
  return queryOne('SELECT id, username, email, role, avatar_url, created_at AS createdAt FROM users WHERE id = ?', [id]);
}

export async function createUser(username: string, email: string, passwordHash: string): Promise<number> {
  const result = await execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.insertId;
}

export async function updateUserProfileRow(userId: number, email?: string, avatarUrl?: string): Promise<void> {
  await execute(
    'UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?',
    [email ?? null, avatarUrl ?? null, userId]
  );
}

export async function updateUserLastLoginAt(userId: number): Promise<void> {
  await execute(UPDATE_LAST_LOGIN_SQL, [userId]);
}

export async function findOtherUserByEmail(email: string, userId: number): Promise<{ id: number } | null> {
  return queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
}

export async function getPasswordHash(userId: number): Promise<{ password_hash: string } | null> {
  return queryOne('SELECT password_hash FROM users WHERE id = ?', [userId]);
}

export async function updatePassword(userId: number, passwordHash: string): Promise<void> {
  await execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
}

export async function createPasswordResetToken(userId: number, email: string, token: string, expiresAt: Date): Promise<void> {
  await execute(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [userId]
  );
  await execute(
    'INSERT INTO password_reset_tokens (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)',
    [userId, email, token, expiresAt]
  );
}

export async function resetPasswordWithToken(
  email: string,
  token: string,
  passwordHash: string
): Promise<'not_found' | 'used' | 'expired' | 'ok'> {
  return transaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE email = ? AND token = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, token]
    );
    const record = (rows as PasswordResetTokenRow[])[0];
    if (!record) return 'not_found';
    if (record.used_at) return 'used';
    if (new Date(record.expires_at).getTime() < Date.now()) return 'expired';

    await conn.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, record.user_id]);
    await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ?', [record.user_id]);
    return 'ok';
  });
}

export async function countUserBooks(userId: number): Promise<number> {
  const row = await queryOne('SELECT COUNT(*) as count FROM user_books WHERE user_id = ?', [userId]);
  return row?.count || 0;
}
