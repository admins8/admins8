"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = getUsers;
exports.getUserRecords = getUserRecords;
exports.updateUserPermissions = updateUserPermissions;
exports.updateUserStatus = updateUserStatus;
exports.updateUserPassword = updateUserPassword;
exports.createUser = createUser;
exports.deleteUser = deleteUser;
exports.getStats = getStats;
exports.getAllBooks = getAllBooks;
exports.deleteBook = deleteBook;
exports.dedupeBooks = dedupeBooks;
exports.setAutoDedupeInterval = setAutoDedupeInterval;
exports.getBookCategories = getBookCategories;
exports.createBookCategory = createBookCategory;
exports.updateBookCategory = updateBookCategory;
exports.deleteBookCategory = deleteBookCategory;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const permissionService_1 = require("../services/permissionService");
const bookCategory_1 = require("../services/bookCategory");
const autoDedupe_1 = require("../services/autoDedupe");
const userRecordService_1 = require("../services/userRecordService");
const userLoginAudit_1 = require("../services/userLoginAudit");
// 管理后台 - 用户列表
async function getUsers(req, res) {
    try {
        const { page = '1', size = '20', keyword } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(size);
        let whereSql = 'WHERE 1=1';
        const params = [];
        if (keyword) {
            whereSql += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) as count FROM users ${whereSql}`, params);
        const total = totalRow?.count || 0;
        const users = await (0, database_1.query)((0, userLoginAudit_1.buildAdminUserSelectSql)(whereSql), [...params, parseInt(size), offset]);
        const permissionMap = await (0, permissionService_1.getUserPermissionMap)(users.map((user) => Number(user.id)));
        const usersWithPermissions = users.map((user) => ({
            ...user,
            permissions: (0, permissionService_1.roleHasPermission)(user.role, permissionService_1.PERMISSIONS.SOURCE_MANAGE)
                ? [permissionService_1.PERMISSIONS.SOURCE_MANAGE]
                : (permissionMap.get(Number(user.id)) || []),
        }));
        res.json({
            code: 0,
            data: { list: usersWithPermissions, total, page: parseInt(page), size: parseInt(size) },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function getUserRecords(req, res) {
    try {
        const data = await (0, userRecordService_1.listUserRecords)(String(req.params.type || ''), req.query);
        res.json({ code: 0, data });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 更新用户功能权限（superadmin专用）
async function updateUserPermissions(req, res) {
    try {
        const { id, permissions } = req.body;
        const currentUser = req.user;
        const userId = Number(id);
        if (!userId) {
            res.json({ code: 400, msg: '缺少用户ID' });
            return;
        }
        if (userId === currentUser.userId) {
            res.json({ code: 403, msg: '不能修改自己的功能权限' });
            return;
        }
        const targetUser = await (0, database_1.queryOne)('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!targetUser) {
            res.json({ code: 404, msg: '用户不存在' });
            return;
        }
        if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
            res.json({ code: 400, msg: '管理员默认拥有全部权限，无需单独设置' });
            return;
        }
        const normalized = (0, permissionService_1.normalizePermissions)(permissions);
        await (0, permissionService_1.setUserPermissions)(userId, normalized);
        res.json({ code: 0, msg: '权限更新成功', data: { permissions: normalized } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 更新用户状态
async function updateUserStatus(req, res) {
    try {
        const { id, is_active, role } = req.body;
        const currentUser = req.user;
        // 不能修改自己的状态
        if (id === currentUser.userId) {
            res.json({ code: 403, msg: '不能修改自己的状态' });
            return;
        }
        // 获取目标用户当前角色
        const targetUser = await (0, database_1.queryOne)('SELECT role FROM users WHERE id = ?', [id]);
        if (!targetUser) {
            res.json({ code: 404, msg: '用户不存在' });
            return;
        }
        // 只有superadmin能设置admin/superadmin角色，或修改admin/superadmin用户
        if (role || targetUser.role === 'admin' || targetUser.role === 'superadmin') {
            if (currentUser.role !== 'superadmin') {
                res.json({ code: 403, msg: '只有超级管理员能管理管理员账号' });
                return;
            }
        }
        if (is_active !== undefined) {
            await (0, database_1.execute)('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [is_active ? 1 : 0, id]);
        }
        if (role) {
            await (0, database_1.execute)('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [role, id]);
        }
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 修改用户密码（superadmin专用）
async function updateUserPassword(req, res) {
    try {
        const { id, password } = req.body;
        const currentUser = req.user;
        const userId = Number(id);
        if (!userId) {
            res.json({ code: 400, msg: '缺少用户ID' });
            return;
        }
        if (userId === currentUser.userId) {
            res.json({ code: 403, msg: '不能在这里修改自己的密码' });
            return;
        }
        if (!password || String(password).length < 6) {
            res.json({ code: 400, msg: '密码长度不能少于6位' });
            return;
        }
        const targetUser = await (0, database_1.queryOne)('SELECT role FROM users WHERE id = ?', [userId]);
        if (!targetUser) {
            res.json({ code: 404, msg: '用户不存在' });
            return;
        }
        if ((targetUser.role === 'admin' || targetUser.role === 'superadmin') && currentUser.role !== 'superadmin') {
            res.json({ code: 403, msg: '只有超级管理员能修改管理员密码' });
            return;
        }
        const passwordHash = bcryptjs_1.default.hashSync(String(password), 10);
        await (0, database_1.execute)('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
        res.json({ code: 0, msg: '密码修改成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 创建用户（superadmin专用）
async function createUser(req, res) {
    try {
        const { username, email, password, role = 'user' } = req.body;
        const currentUser = req.user;
        if (!username || !email || !password) {
            res.json({ code: 400, msg: '用户名、邮箱和密码不能为空' });
            return;
        }
        if (password.length < 6) {
            res.json({ code: 400, msg: '密码长度不能少于6位' });
            return;
        }
        // 只有superadmin能创建admin/superadmin账号
        if ((role === 'admin' || role === 'superadmin') && currentUser.role !== 'superadmin') {
            res.json({ code: 403, msg: '只有超级管理员能创建管理员账号' });
            return;
        }
        const existing = await (0, database_1.queryOne)('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing) {
            res.json({ code: 400, msg: '用户名或邮箱已存在' });
            return;
        }
        const passwordHash = bcryptjs_1.default.hashSync(password, 10);
        const result = await (0, database_1.execute)('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', [username, email, passwordHash, role]);
        res.json({
            code: 0,
            msg: '创建成功',
            data: { id: result.insertId, username, email, role },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 删除用户（superadmin专用）
async function deleteUser(req, res) {
    try {
        const { id } = req.body;
        const currentUser = req.user;
        if (id === currentUser.userId) {
            res.json({ code: 403, msg: '不能删除自己' });
            return;
        }
        // 获取目标用户角色
        const targetUser = await (0, database_1.queryOne)('SELECT role FROM users WHERE id = ?', [id]);
        if (!targetUser) {
            res.json({ code: 404, msg: '用户不存在' });
            return;
        }
        // 只有superadmin能删除admin/superadmin用户
        if ((targetUser.role === 'admin' || targetUser.role === 'superadmin') && currentUser.role !== 'superadmin') {
            res.json({ code: 403, msg: '只有超级管理员能删除管理员账号' });
            return;
        }
        await (0, database_1.execute)('DELETE FROM users WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 统计数据
async function getStats(req, res) {
    try {
        const userCount = (await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM users'))?.count || 0;
        const bookCount = (await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM books'))?.count || 0;
        const sourceCount = (await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM book_sources'))?.count || 0;
        const visitorCount = (await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM visitor_logs'))?.count || 0;
        const contentCount = (await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM book_contents'))?.count || 0;
        res.json({
            code: 0,
            data: { userCount, bookCount, sourceCount, visitorCount, contentCount },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 所有书籍
async function getAllBooks(req, res) {
    try {
        const { page = '1', size = '20', keyword } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(size);
        let whereSql = 'WHERE 1=1';
        const params = [];
        if (keyword) {
            whereSql += ' AND (name LIKE ? OR author LIKE ?)';
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        const totalRow = await (0, database_1.queryOne)(`SELECT COUNT(*) as count FROM books ${whereSql}`, params);
        const total = totalRow?.count || 0;
        const books = await (0, database_1.query)(`SELECT
         id,
         book_url AS bookUrl,
         toc_url AS tocUrl,
         origin AS sourceUrl,
         origin_name AS sourceName,
         name,
         author,
         kind,
         cover_url AS coverUrl,
         intro,
         total_chapter_num AS totalChapterNum,
         latest_chapter_title AS latestChapterTitle,
         word_count AS wordCount,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM books ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(size), offset]);
        res.json({
            code: 0,
            data: { list: books, total, page: parseInt(page), size: parseInt(size) },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 删除书籍（级联清理关联数据）
async function deleteBook(req, res) {
    try {
        const { bookUrl } = req.body;
        await (0, database_1.transaction)(async (conn) => {
            await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [bookUrl]);
            await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [bookUrl]);
            await conn.execute('DELETE FROM user_books WHERE book_url = ?', [bookUrl]);
            await conn.execute('DELETE FROM books WHERE book_url = ?', [bookUrl]);
        });
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 书籍去重（按书名+作者去重，保留章节最多的那条；无作者则按书名去重）
// 去重前先净化所有作者字段，去掉"作者："前缀
async function dedupeBooks(req, res) {
    try {
        // 第零步：净化作者字段，去掉"作者："前缀
        await (0, database_1.execute)(`UPDATE books SET author = TRIM(SUBSTRING(author, 4))
       WHERE author LIKE '作者：%' OR author LIKE '作者:%'`);
        let totalRemoved = 0;
        let groups = 0;
        let lowChapterRemoved = 0;
        // 第零步B：删除章节数少于10章的书籍（视为无效数据）
        const lowChapterRows = await (0, database_1.query)(`SELECT book_url FROM books WHERE total_chapter_num < 10`);
        for (const row of lowChapterRows) {
            await (0, database_1.transaction)(async (conn) => {
                await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
                await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
                await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
                await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
            });
            lowChapterRemoved++;
        }
        if (lowChapterRemoved > 0) {
            console.log(`[书籍去重] 清理少于10章的书籍 ${lowChapterRemoved} 条`);
        }
        // 清洗作者字段：去掉"作者："前缀、空格，转小写
        const cleanAuthorSql = `LOWER(TRIM(REPLACE(REPLACE(REPLACE(author, '作者：', ''), '作者:', ''), ' ', '')))`;
        const cleanNameSql = `LOWER(TRIM(REPLACE(name, ' ', '')))`;
        // 第一步：有作者的，按书名+作者去重
        const withAuthor = await (0, database_1.query)(`SELECT ANY_VALUE(name) AS name, ANY_VALUE(author) AS author, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != '' AND author IS NOT NULL AND author != ''
         AND ${cleanAuthorSql} != ''
       GROUP BY ${cleanNameSql}, ${cleanAuthorSql}
       HAVING cnt > 1`);
        for (const dup of withAuthor) {
            const keepRow = await (0, database_1.queryOne)(`SELECT id, book_url FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND ${cleanAuthorSql} = LOWER(TRIM(REPLACE(REPLACE(REPLACE(?, '作者：', ''), '作者:', ''), ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC LIMIT 1`, [dup.name, dup.author]);
            if (!keepRow)
                continue;
            const deleteRows = await (0, database_1.query)(`SELECT book_url FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND ${cleanAuthorSql} = LOWER(TRIM(REPLACE(REPLACE(REPLACE(?, '作者：', ''), '作者:', ''), ' ', '')))
           AND id != ?`, [dup.name, dup.author, keepRow.id]);
            for (const row of deleteRows) {
                await (0, database_1.transaction)(async (conn) => {
                    await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
                });
                totalRemoved++;
            }
            groups++;
        }
        // 第二步：没有作者的（或清洗后为空的），按书名去重
        const noAuthor = await (0, database_1.query)(`SELECT ANY_VALUE(name) AS name, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != '' AND (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
       GROUP BY ${cleanNameSql}
       HAVING cnt > 1`);
        for (const dup of noAuthor) {
            const keepRow = await (0, database_1.queryOne)(`SELECT id, book_url FROM books
         WHERE (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
           AND ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC LIMIT 1`, [dup.name]);
            if (!keepRow)
                continue;
            const deleteRows = await (0, database_1.query)(`SELECT book_url FROM books
         WHERE (author IS NULL OR author = '' OR ${cleanAuthorSql} = '')
           AND ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
           AND id != ?`, [dup.name, keepRow.id]);
            for (const row of deleteRows) {
                await (0, database_1.transaction)(async (conn) => {
                    await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM user_books WHERE book_url = ?', [row.book_url]);
                    await conn.execute('DELETE FROM books WHERE book_url = ?', [row.book_url]);
                });
                totalRemoved++;
            }
            groups++;
        }
        // 第三步：混合情况——同名书籍中，有的有作者、有的没作者，按书名去重
        const mixedAuthor = await (0, database_1.query)(`SELECT ANY_VALUE(name) AS name, COUNT(*) AS cnt
       FROM books
       WHERE name IS NOT NULL AND name != ''
       GROUP BY ${cleanNameSql}
       HAVING cnt > 1`);
        // 排除已在第一步和第二步处理过的组
        const processedKeys = new Set();
        // 重新查询已处理的组（有作者的组）
        const doneWithAuthor = await (0, database_1.query)(`SELECT ${cleanNameSql} AS k, ${cleanAuthorSql} AS a
       FROM books
       WHERE author IS NOT NULL AND author != '' AND ${cleanAuthorSql} != ''
       GROUP BY ${cleanNameSql}, ${cleanAuthorSql}
       HAVING COUNT(*) > 1`);
        for (const r of doneWithAuthor)
            processedKeys.add(`${r.k}__${r.a}`);
        for (const dup of mixedAuthor) {
            const nameKey = dup.name ? cleanNameSql.replace(/[\s\S]/, '') : '';
            // 如果这个书名组已经在第一步或第二步被完整处理，跳过
            // 简单判断：如果该组内所有记录要么都有作者且相同，要么都没有作者，则已处理
            const groupRows = await (0, database_1.query)(`SELECT id, book_url, author, total_chapter_num
         FROM books
         WHERE ${cleanNameSql} = LOWER(TRIM(REPLACE(?, ' ', '')))
         ORDER BY total_chapter_num DESC, id ASC`, [dup.name]);
            if (groupRows.length <= 1)
                continue;
            // 检查是否全部有作者且相同（已被第一步处理）或全部没作者（已被第二步处理）
            const allHaveAuthor = groupRows.every((r) => r.author && r.author.trim() !== '');
            const allNoAuthor = groupRows.every((r) => !r.author || r.author.trim() === '');
            if (allHaveAuthor || allNoAuthor)
                continue;
            // 混合情况：保留第一条（章节最多的），删除其余
            const keepId = groupRows[0].id;
            for (let i = 1; i < groupRows.length; i++) {
                await (0, database_1.transaction)(async (conn) => {
                    await conn.execute('DELETE FROM book_contents WHERE book_url = ?', [groupRows[i].book_url]);
                    await conn.execute('DELETE FROM book_chapters WHERE book_url = ?', [groupRows[i].book_url]);
                    await conn.execute('DELETE FROM user_books WHERE book_url = ?', [groupRows[i].book_url]);
                    await conn.execute('DELETE FROM books WHERE book_url = ?', [groupRows[i].book_url]);
                });
                totalRemoved++;
            }
            groups++;
        }
        if (totalRemoved === 0 && lowChapterRemoved === 0) {
            res.json({ code: 0, msg: '没有发现重复书籍', data: { removed: 0, groups: 0, lowChapterRemoved: 0 } });
            return;
        }
        let msg = '';
        if (lowChapterRemoved > 0)
            msg += `清理少于10章的书籍 ${lowChapterRemoved} 条`;
        if (totalRemoved > 0)
            msg += `${msg ? '，' : ''}删除重复书籍 ${totalRemoved} 条`;
        res.json({
            code: 0,
            msg: msg || '去重完成',
            data: { removed: totalRemoved, groups, lowChapterRemoved },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 设置自动去重间隔（天数），0 表示关闭
async function setAutoDedupeInterval(req, res) {
    try {
        const { days } = req.body;
        const intervalDays = Math.max(0, Math.min(365, Number(days) || 0));
        await (0, database_1.execute)(`INSERT INTO site_config (config_key, config_value, description)
       VALUES ('auto_dedupe_interval_days', ?, '自动去重间隔天数，0=关闭')
       ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()`, [String(intervalDays), String(intervalDays)]);
        // 重载定时任务
        await autoDedupe_1.autoDedupeScheduler.reload();
        res.json({
            code: 0,
            msg: intervalDays > 0 ? `已设置每隔 ${intervalDays} 天自动去重` : '已关闭自动去重',
            data: { days: intervalDays },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 分类列表
async function getBookCategories(_req, res) {
    try {
        const list = await (0, database_1.query)(`SELECT id, name, sort_order AS sortOrder, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM book_categories
       ORDER BY sort_order ASC, id ASC`);
        res.json({ code: 0, data: list });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 新增分类
async function createBookCategory(req, res) {
    try {
        const category = (0, bookCategory_1.normalizeCategoryInput)(req.body);
        await (0, database_1.execute)('INSERT INTO book_categories (name, sort_order, is_active) VALUES (?, ?, ?)', [category.name, category.sortOrder, category.isActive ? 1 : 0]);
        res.json({ code: 0, msg: '新增成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 更新分类
async function updateBookCategory(req, res) {
    try {
        const { id } = req.body;
        const category = (0, bookCategory_1.normalizeCategoryInput)(req.body);
        await (0, database_1.execute)('UPDATE book_categories SET name = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?', [category.name, category.sortOrder, category.isActive ? 1 : 0, id]);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// 管理后台 - 删除分类
async function deleteBookCategory(req, res) {
    try {
        const { id } = req.body;
        await (0, database_1.execute)('DELETE FROM book_categories WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
//# sourceMappingURL=adminController.js.map