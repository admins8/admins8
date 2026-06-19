"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.query = query;
exports.queryOne = queryOne;
exports.execute = execute;
exports.transaction = transaction;
exports.initDatabase = initDatabase;
const promise_1 = __importDefault(require("mysql2/promise"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_1 = require("./index");
const migrations_1 = require("./migrations");
let pool;
/**
 * 获取 MySQL 连接池（单例模式）
 */
function getDb() {
    if (!pool) {
        pool = promise_1.default.createPool({
            host: index_1.config.db.host,
            port: index_1.config.db.port,
            user: index_1.config.db.user,
            password: index_1.config.db.password,
            database: index_1.config.db.database,
            connectionLimit: index_1.config.db.connectionLimit,
            charset: 'utf8mb4',
            connectTimeout: 10000,
        });
        // 确保连接使用 utf8mb4 字符集
        pool.on('connection', (connection) => {
            connection.query('SET NAMES utf8mb4');
        });
    }
    return pool;
}
/**
 * 关闭数据库连接池
 */
function closeDb() {
    if (pool) {
        pool.end();
        pool = undefined;
    }
}
/**
 * 辅助查询函数 - 执行 SELECT 查询，返回行数组
 */
async function query(sql, params) {
    const db = getDb();
    const [rows] = await db.query(sql, params);
    return rows;
}
/**
 * 辅助查询函数 - 执行 SELECT 查询，返回单行
 */
async function queryOne(sql, params) {
    const db = getDb();
    const [rows] = await db.query(sql, params);
    return rows[0] || null;
}
/**
 * 辅助执行函数 - 执行 INSERT/UPDATE/DELETE，返回 affectedRows 和 insertId
 */
async function execute(sql, params) {
    const db = getDb();
    const [result] = await db.execute(sql, params);
    return {
        affectedRows: result.affectedRows,
        insertId: result.insertId,
    };
}
/**
 * 事务执行器 - 在事务中执行回调函数
 */
async function transaction(fn) {
    const db = getDb();
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
/**
 * 初始化数据库 - 创建所有表（MySQL 语法）
 */
async function initDatabase() {
    const db = getDb();
    await (0, migrations_1.runMigrations)(db);
    // 插入默认网站配置
    await db.query(`INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('site_title', '搜书网', '网站标题'),
      ('site_subtitle', '搜书网，图片格式，由网站管理员后台上传', '网站副标题'),
      ('site_logo', '', '网站Logo图片地址'),
      ('web_domain', '', 'Web域名'),
      ('wap_domain', '', 'WAP域名'),
      ('icp_number', '', 'ICP备案号'),
      ('analytics_code', '', '统计代码'),
      ('copyright', '© 2026 搜书网 All Rights Reserved.', '版权信息'),
      ('home_title', '{siteName}', '首页标题'),
      ('home_keywords', '小说,免费小说,网络小说,小说搜索,{年份}', '首页关键字'),
      ('home_description', '{siteName}提供热门小说搜索、在线阅读和排行榜推荐。', '首页描述'),
      ('detail_title_template', '{bookName}全文免费阅读_{bookName}最新章节_{siteName}', '小说详情页标题模板'),
      ('detail_keywords_template', '{bookName},{author},{bookName}最新章节,{bookName}全文阅读,{年份}', '小说详情页关键词模板'),
      ('detail_description_template', '{bookName}是{author}创作的小说，最新章节：{latestChapter}。{intro}', '小说详情页描述模板'),
      ('reader_title_template', '{chapterTitle}_{bookName}全文阅读_{siteName}', '阅读页标题模板'),
      ('reader_keywords_template', '{bookName},{chapterTitle},{author},免费阅读,{年份}', '阅读页关键词模板'),
      ('reader_description_template', '正在阅读{bookName}的{chapterTitle}，作者：{author}。', '阅读页描述模板'),
      ('search_title_template', '{keyword}搜索结果_{siteName}', '搜索页标题模板'),
      ('search_keywords_template', '{keyword},小说搜索,免费小说,{年份}', '搜索页关键词模板'),
      ('search_description_template', '在{siteName}搜索{keyword}，查看相关小说和可用书源。', '搜索页描述模板'),
      ('ranking_title_template', '小说排行榜_{siteName}', '排行榜页标题模板'),
      ('ranking_keywords_template', '小说排行榜,热门小说,完本小说,免费小说,{年份}', '排行榜页关键词模板'),
      ('ranking_description_template', '{siteName}提供热门小说排行榜、分类榜单和推荐书单。', '排行榜页描述模板'),
      ('content_cleaner_rules', '{"removeTags":["script","style","iframe"],"removeTexts":[],"removePatterns":["第\\\\s*\\\\d+\\\\s*/\\\\s*\\\\d+\\\\s*页","请收藏本站.*?$","最新网址.*?$","本章未完.*?$","^\\\\s*Please\\\\s+(?:visit|bookmark|remember)\\\\b.*?(?:www\\\\.|https?://|latest\\\\s+chapter|chapter|site|website).*?$","^\\\\s*If\\\\s+you\\\\s+find\\\\s+any\\\\s+errors\\\\b.*?$","^\\\\s*(?:This\\\\s+chapter\\\\s+is\\\\s+updated|Read\\\\s+the\\\\s+latest\\\\s+chapter|Download\\\\s+.*?app)\\\\b.*?$","^\\\\s*(?:www\\\\.|https?://)[^\\\\s\\\\u4e00-\\\\u9fa5]+\\\\s*$","^\\\\s*window\\\\.[A-Za-z_$][\\\\w$]*\\\\s*=\\\\s*[\\"\\\\''][A-Za-z0-9+/=\\\\s]{40,}[\\"\\\\''];?\\\\s*$"],"replacements":[]}', '正文净化规则'),
      ('guest_search_enabled', '1', '未登录用户是否允许搜索书籍'),
      ('guest_read_chapter_limit', '3', '未登录用户可阅读的章节数量，-1 表示不限，0 表示不可阅读')`);
    // 初始化管理员账号（检查是否存在任何管理员）
    const [adminRows] = await db.query("SELECT id FROM users WHERE role IN ('admin', 'superadmin')");
    if (adminRows.length === 0) {
        const hash = await bcryptjs_1.default.hash(index_1.config.admin.password, 10);
        await db.query('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', [index_1.config.admin.username, index_1.config.admin.email, hash, 'superadmin']);
        console.log('[DB] 超级管理员账号已初始化 (admin/admin123)');
    }
    console.log('[DB] MySQL 数据库表初始化完成');
}
//# sourceMappingURL=database.js.map