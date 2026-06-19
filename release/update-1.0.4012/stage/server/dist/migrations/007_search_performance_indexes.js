"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '007_search_performance_indexes';
/**
 * 搜索性能优化：给常用查询路径添加复合 / 单列索引。
 * - 书源表主查询：WHERE enabled = ?  ORDER BY weight DESC, custom_order ASC
 * - book_source_url （查询单个书源）
 * - books.book_url （缓存 / 详情）
 * - chapters / contents （按 book_url + chapter_index）
 * - user_books（书架）、hot_searches、hot_rankings 热门路径
 *
 * 由于 MySQL < 8.0 不支持 `CREATE INDEX IF NOT EXISTS`，
 * 这里通过 INFORMATION_SCHEMA.STATISTICS 判断后再执行建索引，避免重复创建报错。
 */
async function ensureIndex(db, tableName, indexName, ddl) {
    const [rows] = await db.query("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1", [tableName, indexName]);
    if (rows.length > 0)
        return;
    await db.query(ddl);
}
async function up(db) {
    // 书源表核心复合索引：搜索时 WHERE enabled=1 ORDER BY weight DESC, custom_order ASC
    await ensureIndex(db, 'book_sources', 'idx_book_sources_enabled_weight_order', 'CREATE INDEX idx_book_sources_enabled_weight_order ON book_sources (enabled, weight DESC, custom_order ASC)');
    // book_source_url 唯一索引：查找单个书源 / 换源定位
    await ensureIndex(db, 'book_sources', 'idx_book_sources_source_url', 'CREATE UNIQUE INDEX idx_book_sources_source_url ON book_sources (book_source_url)');
    // books.book_url 主键路径外补充索引
    await ensureIndex(db, 'books', 'idx_books_book_url', 'CREATE UNIQUE INDEX idx_books_book_url ON books (book_url)');
    // 按书本 + 作者联合查询（换源 / 去重）
    await ensureIndex(db, 'books', 'idx_books_name_author', 'CREATE INDEX idx_books_name_author ON books (name, author)');
    // 章节列表：按 book_url 取列表 / 按 (book_url, chapter_index) 定位单章
    await ensureIndex(db, 'book_chapters', 'idx_book_chapters_book_url_index', 'CREATE INDEX idx_book_chapters_book_url_index ON book_chapters (book_url, chapter_index)');
    await ensureIndex(db, 'book_contents', 'idx_book_contents_book_url_index', 'CREATE INDEX idx_book_contents_book_url_index ON book_contents (book_url, chapter_index)');
    // 书架查询路径
    await ensureIndex(db, 'user_books', 'idx_user_books_user_book', 'CREATE INDEX idx_user_books_user_book ON user_books (user_id, book_url)');
    // 热门搜索 / 排行榜：首页热门区域展示
    await ensureIndex(db, 'hot_searches', 'idx_hot_searches_active', 'CREATE INDEX idx_hot_searches_active ON hot_searches (is_active, sort_order)');
    await ensureIndex(db, 'hot_rankings', 'idx_hot_rankings_active', 'CREATE INDEX idx_hot_rankings_active ON hot_rankings (is_active, sort_order)');
}
//# sourceMappingURL=007_search_performance_indexes.js.map