"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookLikeTargetId = getBookLikeTargetId;
exports.normalizeCommentContent = normalizeCommentContent;
exports.normalizeSocialBookInput = normalizeSocialBookInput;
exports.getBookComments = getBookComments;
exports.createBookComment = createBookComment;
exports.deleteBookComment = deleteBookComment;
exports.toggleBookLike = toggleBookLike;
exports.getBookSocialStats = getBookSocialStats;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const bookshelfDeduper_1 = require("./bookshelfDeduper");
function getBookLikeTargetId(bookUrl) {
    return crypto_1.default.createHash('sha1').update(String(bookUrl || '').trim()).digest('hex');
}
function normalizeCommentContent(content) {
    const value = String(content || '').trim();
    if (!value)
        throw new Error('评论内容不能为空');
    if (value.length > 1000)
        throw new Error('评论内容不能超过1000字');
    return value;
}
function normalizeSocialBookInput(input) {
    const bookUrl = String(input?.bookUrl || input?.book_url || '').trim();
    if (!bookUrl)
        throw new Error('缺少书籍地址');
    return {
        bookUrl,
        name: String(input?.name || '').trim(),
        author: String(input?.author || '').trim(),
    };
}
async function isFavoriteByIdentity(userId, input) {
    if (!userId)
        return false;
    const byUrl = await (0, database_1.queryOne)('SELECT id FROM user_books WHERE user_id = ? AND book_url = ? LIMIT 1', [userId, input.bookUrl]);
    if (byUrl)
        return true;
    const key = (0, bookshelfDeduper_1.getBookIdentityKey)(input);
    if (!key)
        return false;
    const rows = await (0, database_1.query)(`SELECT b.name, b.author
     FROM user_books ub JOIN books b ON ub.book_url = b.book_url
     WHERE ub.user_id = ?`, [userId]);
    return rows.some((row) => (0, bookshelfDeduper_1.getBookIdentityKey)(row) === key);
}
async function getBookComments(bookUrl) {
    return (0, database_1.query)(`SELECT c.id, c.user_id AS userId, u.username, c.content, c.created_at AS createdAt
     FROM book_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.book_url = ? AND c.is_active = 1
     ORDER BY c.created_at DESC
     LIMIT 100`, [bookUrl]);
}
async function createBookComment(userId, bookUrl, content) {
    const safeContent = normalizeCommentContent(content);
    const result = await (0, database_1.execute)('INSERT INTO book_comments (user_id, book_url, content, is_active) VALUES (?, ?, ?, 1)', [userId, bookUrl, safeContent]);
    return (0, database_1.queryOne)(`SELECT c.id, c.user_id AS userId, u.username, c.content, c.created_at AS createdAt
     FROM book_comments c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`, [result.insertId]);
}
async function deleteBookComment(userId, commentId) {
    await (0, database_1.execute)('DELETE FROM book_comments WHERE id = ? AND user_id = ?', [commentId, userId]);
    return true;
}
async function toggleBookLike(userId, bookUrl) {
    const targetId = getBookLikeTargetId(bookUrl);
    const existing = await (0, database_1.queryOne)('SELECT id FROM user_likes WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1', [userId, 'book', targetId]);
    if (existing) {
        await (0, database_1.execute)('DELETE FROM user_likes WHERE id = ?', [existing.id]);
        return { liked: false };
    }
    await (0, database_1.execute)('INSERT INTO user_likes (user_id, target_type, book_url, target_id) VALUES (?, ?, ?, ?)', [userId, 'book', bookUrl, targetId]);
    return { liked: true };
}
async function getBookSocialStats(input, userId) {
    const book = normalizeSocialBookInput(input);
    const targetId = getBookLikeTargetId(book.bookUrl);
    const [commentRow, likeRow, favoriteRow, likedRow, favorite] = await Promise.all([
        (0, database_1.queryOne)('SELECT COUNT(*) AS count FROM book_comments WHERE book_url = ? AND is_active = 1', [book.bookUrl]),
        (0, database_1.queryOne)('SELECT COUNT(*) AS count FROM user_likes WHERE target_type = ? AND target_id = ?', ['book', targetId]),
        (0, database_1.queryOne)('SELECT COUNT(*) AS count FROM user_books WHERE book_url = ?', [book.bookUrl]),
        userId
            ? (0, database_1.queryOne)('SELECT id FROM user_likes WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1', [userId, 'book', targetId])
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
//# sourceMappingURL=bookSocialService.js.map