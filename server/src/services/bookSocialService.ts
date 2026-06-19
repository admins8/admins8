import crypto from 'crypto';
import { execute, query, queryOne } from '../config/database';
import { getBookIdentityKey } from './bookshelfDeduper';

export interface SocialBookInput {
  bookUrl: string
  name?: string
  author?: string
}

export function getBookLikeTargetId(bookUrl: string): string {
  return crypto.createHash('sha1').update(String(bookUrl || '').trim()).digest('hex');
}

export function normalizeCommentContent(content: unknown): string {
  const value = String(content || '').trim();
  if (!value) throw new Error('评论内容不能为空');
  if (value.length > 1000) throw new Error('评论内容不能超过1000字');
  return value;
}

export function normalizeSocialBookInput(input: any): SocialBookInput {
  const bookUrl = String(input?.bookUrl || input?.book_url || '').trim();
  if (!bookUrl) throw new Error('缺少书籍地址');
  return {
    bookUrl,
    name: String(input?.name || '').trim(),
    author: String(input?.author || '').trim(),
  };
}

async function isFavoriteByIdentity(userId: number | null | undefined, input: SocialBookInput): Promise<boolean> {
  if (!userId) return false;
  const byUrl = await queryOne('SELECT id FROM user_books WHERE user_id = ? AND book_url = ? LIMIT 1', [userId, input.bookUrl]);
  if (byUrl) return true;

  const key = getBookIdentityKey(input);
  if (!key) return false;
  const rows = await query(
    `SELECT b.name, b.author
     FROM user_books ub JOIN books b ON ub.book_url = b.book_url
     WHERE ub.user_id = ?`,
    [userId]
  );
  return rows.some((row: any) => getBookIdentityKey(row) === key);
}

export async function getBookComments(bookUrl: string) {
  return query(
    `SELECT c.id, c.user_id AS userId, u.username, c.content, c.created_at AS createdAt
     FROM book_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.book_url = ? AND c.is_active = 1
     ORDER BY c.created_at DESC
     LIMIT 100`,
    [bookUrl]
  );
}

export async function createBookComment(userId: number, bookUrl: string, content: unknown) {
  const safeContent = normalizeCommentContent(content);
  const result: any = await execute(
    'INSERT INTO book_comments (user_id, book_url, content, is_active) VALUES (?, ?, ?, 1)',
    [userId, bookUrl, safeContent]
  );
  return queryOne(
    `SELECT c.id, c.user_id AS userId, u.username, c.content, c.created_at AS createdAt
     FROM book_comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [result.insertId]
  );
}

export async function deleteBookComment(userId: number, commentId: number) {
  await execute('DELETE FROM book_comments WHERE id = ? AND user_id = ?', [commentId, userId]);
  return true;
}

export async function toggleBookLike(userId: number, bookUrl: string) {
  const targetId = getBookLikeTargetId(bookUrl);
  const existing = await queryOne(
    'SELECT id FROM user_likes WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1',
    [userId, 'book', targetId]
  );
  if (existing) {
    await execute('DELETE FROM user_likes WHERE id = ?', [existing.id]);
    return { liked: false };
  }
  await execute(
    'INSERT INTO user_likes (user_id, target_type, book_url, target_id) VALUES (?, ?, ?, ?)',
    [userId, 'book', bookUrl, targetId]
  );
  return { liked: true };
}

export async function getBookSocialStats(input: any, userId?: number | null) {
  const book = normalizeSocialBookInput(input);
  const targetId = getBookLikeTargetId(book.bookUrl);
  const [commentRow, likeRow, favoriteRow, likedRow, favorite] = await Promise.all([
    queryOne('SELECT COUNT(*) AS count FROM book_comments WHERE book_url = ? AND is_active = 1', [book.bookUrl]),
    queryOne('SELECT COUNT(*) AS count FROM user_likes WHERE target_type = ? AND target_id = ?', ['book', targetId]),
    queryOne('SELECT COUNT(*) AS count FROM user_books WHERE book_url = ?', [book.bookUrl]),
    userId
      ? queryOne('SELECT id FROM user_likes WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1', [userId, 'book', targetId])
      : Promise.resolve(null),
    isFavoriteByIdentity(userId, book),
  ]);

  return {
    commentCount: Number(commentRow?.count || 0),
    likeCount: Number(likeRow?.count || 0),
    favoriteCount: Number(favoriteRow?.count || 0),
    liked: !!likedRow,
    favorited: !!favorite,
  };
}
