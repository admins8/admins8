import { execute, query, queryOne } from '../config/database';

/**
 * 关注/取关作者
 */
export async function toggleAuthorFollow(userId: number, authorName: string): Promise<{ followed: boolean }> {
  const name = String(authorName || '').trim();
  if (!name) throw new Error('作者名称不能为空');

  const existing = await queryOne(
    'SELECT id FROM author_follows WHERE user_id = ? AND author_name = ? LIMIT 1',
    [userId, name]
  );
  if (existing) {
    await execute('DELETE FROM author_follows WHERE id = ?', [existing.id]);
    return { followed: false };
  }
  await execute(
    'INSERT INTO author_follows (user_id, author_name) VALUES (?, ?)',
    [userId, name]
  );
  return { followed: true };
}

/**
 * 检查用户是否已关注某作者
 */
export async function isAuthorFollowed(userId: number | null | undefined, authorName: string): Promise<boolean> {
  if (!userId) return false;
  const name = String(authorName || '').trim();
  if (!name) return false;
  const row = await queryOne(
    'SELECT id FROM author_follows WHERE user_id = ? AND author_name = ? LIMIT 1',
    [userId, name]
  );
  return !!row;
}

/**
 * 获取作者的粉丝数
 */
export async function getAuthorFollowerCount(authorName: string): Promise<number> {
  const name = String(authorName || '').trim();
  if (!name) return 0;
  const row = await queryOne(
    'SELECT COUNT(*) AS count FROM author_follows WHERE author_name = ?',
    [name]
  );
  return Number(row?.count || 0);
}
