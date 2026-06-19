"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_RECORD_TYPES = void 0;
exports.getUserRecordConfig = getUserRecordConfig;
exports.buildUserRecordPagination = buildUserRecordPagination;
exports.listUserRecords = listUserRecords;
exports.recordUserSearch = recordUserSearch;
const database_1 = require("../config/database");
exports.USER_RECORD_TYPES = [
    'reading',
    'searches',
    'comments',
    'likes',
    'favorites',
    'checkins',
];
const RECORD_CONFIGS = {
    reading: { title: '阅读记录', table: 'user_books', timeColumn: 'dur_chapter_time', searchableBook: true },
    searches: { title: '搜索记录', table: 'user_search_records', timeColumn: 'created_at' },
    comments: { title: '评论记录', table: 'book_comments', timeColumn: 'created_at', searchableBook: true },
    likes: { title: '点赞记录', table: 'user_likes', timeColumn: 'created_at', searchableBook: true },
    favorites: { title: '收藏记录', table: 'user_books', timeColumn: 'created_at', searchableBook: true },
    checkins: { title: '签到记录', table: 'user_checkins', timeColumn: 'checkin_date' },
};
function getUserRecordConfig(type) {
    const config = RECORD_CONFIGS[type];
    if (!config)
        throw new Error('不支持的记录类型');
    return config;
}
function buildUserRecordPagination(input) {
    const rawPage = Number.parseInt(String(input?.page ?? 1), 10);
    const rawSize = Number.parseInt(String(input?.size ?? 20), 10);
    const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
    const size = Math.max(1, Math.min(100, Number.isFinite(rawSize) ? rawSize : 20));
    return { page, size, offset: (page - 1) * size };
}
function keywordWhere(keyword, fields, params) {
    const value = String(keyword || '').trim();
    if (!value)
        return '';
    params.push(...fields.map(() => `%${value}%`));
    return ` AND (${fields.map(field => `${field} LIKE ?`).join(' OR ')})`;
}
async function listReadingOrFavoriteRecords(type, input) {
    const { page, size, offset } = buildUserRecordPagination(input);
    const params = [];
    let where = 'WHERE 1=1';
    where += keywordWhere(input.keyword, ['u.username', 'u.email'], params);
    where += keywordWhere(input.bookKeyword, ['b.name', 'b.author', 'ub.book_url'], params);
    if (type === 'reading')
        where += ' AND (ub.dur_chapter_index > 0 OR ub.dur_chapter_title <> \'\')';
    const fromSql = `FROM user_books ub
    JOIN users u ON u.id = ub.user_id
    LEFT JOIN books b ON b.book_url = ub.book_url
    ${where}`;
    const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) AS count ${fromSql}`, params);
    const list = await (0, database_1.query)(`SELECT ub.id, ub.user_id, u.username, u.email, ub.book_url, b.name AS book_name, b.author,
            ub.dur_chapter_index, ub.dur_chapter_pos, ub.dur_chapter_title,
            ub.dur_chapter_time, ub.created_at, ub.updated_at
     ${fromSql}
     ORDER BY ${type === 'reading' ? 'ub.dur_chapter_time' : 'ub.created_at'} DESC
     LIMIT ? OFFSET ?`, [...params, size, offset]);
    return { list, total: totalRow?.count || 0, page, size };
}
async function listSearchRecords(input) {
    const { page, size, offset } = buildUserRecordPagination(input);
    const params = [];
    let where = 'WHERE 1=1';
    where += keywordWhere(input.keyword, ['u.username', 'u.email', 'sr.keyword'], params);
    const fromSql = `FROM user_search_records sr LEFT JOIN users u ON u.id = sr.user_id ${where}`;
    const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) AS count ${fromSql}`, params);
    const list = await (0, database_1.query)(`SELECT sr.id, sr.user_id, u.username, u.email, sr.keyword, sr.result_count,
            sr.ip_address, sr.created_at
     ${fromSql}
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?`, [...params, size, offset]);
    return { list, total: totalRow?.count || 0, page, size };
}
async function listCommentRecords(input) {
    const { page, size, offset } = buildUserRecordPagination(input);
    const params = [];
    let where = 'WHERE 1=1';
    where += keywordWhere(input.keyword, ['u.username', 'u.email', 'c.content'], params);
    where += keywordWhere(input.bookKeyword, ['b.name', 'b.author', 'c.book_url'], params);
    const fromSql = `FROM book_comments c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN books b ON b.book_url = c.book_url
    ${where}`;
    const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) AS count ${fromSql}`, params);
    const list = await (0, database_1.query)(`SELECT c.id, c.user_id, u.username, u.email, c.book_url, b.name AS book_name, b.author,
            c.content, c.is_active, c.created_at, c.updated_at
     ${fromSql}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`, [...params, size, offset]);
    return { list, total: totalRow?.count || 0, page, size };
}
async function listLikeRecords(input) {
    const { page, size, offset } = buildUserRecordPagination(input);
    const params = [];
    let where = 'WHERE 1=1';
    where += keywordWhere(input.keyword, ['u.username', 'u.email'], params);
    where += keywordWhere(input.bookKeyword, ['b.name', 'b.author', 'l.book_url'], params);
    const fromSql = `FROM user_likes l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN books b ON b.book_url = l.book_url
    ${where}`;
    const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) AS count ${fromSql}`, params);
    const list = await (0, database_1.query)(`SELECT l.id, l.user_id, u.username, u.email, l.target_type, l.book_url, l.target_id,
            b.name AS book_name, b.author, l.created_at
     ${fromSql}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`, [...params, size, offset]);
    return { list, total: totalRow?.count || 0, page, size };
}
async function listCheckinRecords(input) {
    const { page, size, offset } = buildUserRecordPagination(input);
    const params = [];
    let where = 'WHERE 1=1';
    where += keywordWhere(input.keyword, ['u.username', 'u.email'], params);
    const fromSql = `FROM user_checkins ci JOIN users u ON u.id = ci.user_id ${where}`;
    const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) AS count ${fromSql}`, params);
    const list = await (0, database_1.query)(`SELECT ci.id, ci.user_id, u.username, u.email, ci.checkin_date, ci.points, ci.created_at
     ${fromSql}
     ORDER BY ci.checkin_date DESC, ci.created_at DESC
     LIMIT ? OFFSET ?`, [...params, size, offset]);
    return { list, total: totalRow?.count || 0, page, size };
}
async function listUserRecords(type, input) {
    getUserRecordConfig(type);
    if (type === 'reading' || type === 'favorites')
        return listReadingOrFavoriteRecords(type, input);
    if (type === 'searches')
        return listSearchRecords(input);
    if (type === 'comments')
        return listCommentRecords(input);
    if (type === 'likes')
        return listLikeRecords(input);
    if (type === 'checkins')
        return listCheckinRecords(input);
    throw new Error('不支持的记录类型');
}
async function recordUserSearch(input) {
    const keyword = String(input.keyword || '').trim();
    if (!keyword)
        return;
    try {
        await (0, database_1.execute)('INSERT INTO user_search_records (user_id, keyword, result_count, ip_address) VALUES (?, ?, ?, ?)', [input.userId || null, keyword, Number(input.resultCount || 0), input.ipAddress || '']);
    }
    catch (err) {
        console.warn('[搜索记录] 写入失败:', err?.message || err);
    }
}
//# sourceMappingURL=userRecordService.js.map