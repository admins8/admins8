"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHotSearches = getHotSearches;
exports.getAllHotSearches = getAllHotSearches;
exports.addHotSearch = addHotSearch;
exports.updateHotSearch = updateHotSearch;
exports.deleteHotSearch = deleteHotSearch;
exports.getHotRankings = getHotRankings;
exports.getRankingsGrouped = getRankingsGrouped;
exports.getRankingMeta = getRankingMeta;
exports.getLocalLibrary = getLocalLibrary;
exports.getAllHotRankings = getAllHotRankings;
exports.addHotRanking = addHotRanking;
exports.updateHotRanking = updateHotRanking;
exports.deleteHotRanking = deleteHotRanking;
exports.refreshRankingsFromUserData = refreshRankingsFromUserData;
exports.getHotTags = getHotTags;
exports.getAllHotTags = getAllHotTags;
exports.addHotTag = addHotTag;
exports.updateHotTag = updateHotTag;
exports.deleteHotTag = deleteHotTag;
const database_1 = require("../config/database");
const rankingService_1 = require("../services/rankingService");
const webBookService_1 = require("../services/webBookService");
const localLibrary_1 = require("../services/localLibrary");
// ========== 热门搜索 ==========
async function getHotSearches(req, res) {
    try {
        const items = await (0, database_1.query)('SELECT id, name, count, tag_type, sort_order, is_active FROM hot_searches WHERE is_active = 1 ORDER BY sort_order ASC, count DESC');
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function getAllHotSearches(req, res) {
    try {
        const items = await (0, database_1.query)('SELECT * FROM hot_searches ORDER BY sort_order ASC, created_at DESC');
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function addHotSearch(req, res) {
    try {
        const { name, count, tag_type, sort_order } = req.body;
        const result = await (0, database_1.execute)('INSERT INTO hot_searches (name, count, tag_type, sort_order) VALUES (?, ?, ?, ?)', [name, count || 0, tag_type || 'primary', sort_order || 0]);
        res.json({ code: 0, data: { id: result.insertId } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function updateHotSearch(req, res) {
    try {
        const { id, name, count, tag_type, sort_order, is_active } = req.body;
        await (0, database_1.execute)('UPDATE hot_searches SET name = ?, count = ?, tag_type = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?', [name, count, tag_type, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function deleteHotSearch(req, res) {
    try {
        const { id } = req.body;
        await (0, database_1.execute)('DELETE FROM hot_searches WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// ========== 热门排行榜 ==========
/**
 * 公开接口：获取首页排行榜数据。
 * - 不传参时返回 popularity 榜单（首页右侧入口卡片用）
 * - 传 type/category 时按类型 + 分类筛选
 */
async function getHotRankings(req, res) {
    try {
        // 确保分类缓存已初始化
        const categories = await (0, rankingService_1.getActiveCategories)();
        const { type, category, limit } = req.query;
        const conditions = ['is_active = 1'];
        const params = [];
        if (type) {
            if (!(0, rankingService_1.isValidRankType)(type)) {
                res.json({ code: 400, msg: '未知的榜单类型' });
                return;
            }
            conditions.push('rank_type = ?');
            params.push(type);
        }
        else {
            conditions.push("rank_type = 'popularity'");
        }
        if (category && category !== '全部') {
            if (!categories.includes(category)) {
                res.json({ code: 400, msg: '未知的分类' });
                return;
            }
            conditions.push('category = ?');
            params.push(category);
        }
        const max = Math.min(Number(limit) || 50, 200);
        const sql = `SELECT id, name, book_url, author, download_count, rating, sort_order, intro, cover_url,
              rank_type, category, review_count, chapter_count, word_count, is_complete, extra
       FROM hot_rankings
       WHERE ${conditions.join(' AND ')}
       ORDER BY sort_order ASC, download_count DESC
       LIMIT ${max}`;
        const items = await (0, database_1.query)(sql, params);
        const deduped = (0, rankingService_1.dedupeRankingItems)(items);
        res.json({ code: 0, data: deduped });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/**
 * 公开接口：按 6 类榜单分组返回（独立排行榜页用，单次拉取所有榜单）。
 */
async function getRankingsGrouped(req, res) {
    try {
        // 确保分类缓存已初始化（从 book_categories 表加载）
        const categories = await (0, rankingService_1.getActiveCategories)();
        const { category, perRank } = req.query;
        const cat = category && categories.includes(category) ? category : '全部';
        const max = Math.min(Number(perRank) || 20, 100);
        const data = {};
        for (const meta of rankingService_1.RANK_TYPES) {
            const conditions = ['is_active = 1', 'rank_type = ?'];
            const params = [meta.code];
            if (cat !== '全部') {
                conditions.push('category = ?');
                params.push(cat);
            }
            const items = await (0, database_1.query)(`SELECT id, name, book_url, author, download_count, rating, sort_order, intro, cover_url,
                rank_type, category, review_count, chapter_count, word_count, is_complete, extra
         FROM hot_rankings
         WHERE ${conditions.join(' AND ')}
         ORDER BY sort_order ASC, download_count DESC
         LIMIT ${max}`, params);
            data[meta.code] = (0, rankingService_1.dedupeRankingItems)(items);
        }
        res.json({
            code: 0,
            data: {
                meta: rankingService_1.RANK_TYPES,
                categories: (0, rankingService_1.getCachedCategories)(),
                category: cat,
                rankings: data,
            },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/**
 * 公开接口：返回所有榜单类型与分类（分类从 book_categories 表动态加载）。
 */
async function getRankingMeta(_req, res) {
    try {
        const categories = await (0, rankingService_1.getActiveCategories)();
        res.json({
            code: 0,
            data: {
                types: rankingService_1.RANK_TYPES,
                categories,
            },
        });
    }
    catch (err) {
        res.json({
            code: 0,
            data: {
                types: rankingService_1.RANK_TYPES,
                categories: ['全部'],
            },
        });
    }
}
async function getLocalLibrary(req, res) {
    try {
        const paging = (0, localLibrary_1.normalizeLocalLibraryQuery)(req.query);
        const { where, params } = (0, localLibrary_1.buildLocalLibraryWhere)(paging.keyword, paging.category);
        const rows = await (0, database_1.query)(`SELECT id,
              book_url AS bookUrl,
              toc_url AS tocUrl,
              origin,
              origin_name AS originName,
              name,
              author,
              kind,
              category,
              cover_url AS coverUrl,
              intro,
              total_chapter_num AS totalChapterNum,
              latest_chapter_title AS latestChapterTitle,
              word_count AS wordCount,
              updated_at AS updatedAt,
              EXISTS(SELECT 1 FROM collector_rules cr WHERE cr.name = books.origin_name AND cr.enabled = 1) AS isCollectorLocal
         FROM books
         ${where}
        ORDER BY total_chapter_num DESC, updated_at DESC, id DESC`, params);
        const deduped = (0, localLibrary_1.dedupeLocalLibraryBooks)(rows);
        const items = deduped.slice(paging.offset, paging.offset + paging.pageSize);
        res.json({
            code: 0,
            data: {
                items,
                total: deduped.length,
                page: paging.page,
                pageSize: paging.pageSize,
            },
        });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function getAllHotRankings(req, res) {
    try {
        const categories = await (0, rankingService_1.getActiveCategories)();
        const { type, category } = req.query;
        const conditions = [];
        const params = [];
        if (type && (0, rankingService_1.isValidRankType)(type)) {
            conditions.push('rank_type = ?');
            params.push(type);
        }
        if (category && categories.includes(category) && category !== '全部') {
            conditions.push('category = ?');
            params.push(category);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const items = await (0, database_1.query)(`SELECT * FROM hot_rankings ${where} ORDER BY rank_type ASC, sort_order ASC, created_at DESC`, params);
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function addHotRanking(req, res) {
    try {
        const norm = (0, rankingService_1.normalizeRankingInput)(req.body || {});
        const result = await (0, database_1.execute)(`INSERT INTO hot_rankings
        (name, book_url, author, download_count, rating, sort_order, intro, cover_url,
         rank_type, category, review_count, chapter_count, word_count, is_complete, extra, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            norm.name, norm.book_url, norm.author, norm.download_count, norm.rating,
            norm.sort_order, norm.intro, norm.cover_url,
            norm.rank_type, norm.category, norm.review_count, norm.chapter_count,
            norm.word_count, norm.is_complete, norm.extra, norm.is_active,
        ]);
        res.json({ code: 0, data: { id: result.insertId } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function updateHotRanking(req, res) {
    try {
        const { id } = req.body || {};
        if (!id) {
            res.json({ code: 400, msg: 'id 不能为空' });
            return;
        }
        const norm = (0, rankingService_1.normalizeRankingInput)(req.body || {});
        await (0, database_1.execute)(`UPDATE hot_rankings SET
         name = ?, book_url = ?, author = ?, download_count = ?, rating = ?,
         sort_order = ?, intro = ?, cover_url = ?,
         rank_type = ?, category = ?, review_count = ?, chapter_count = ?,
         word_count = ?, is_complete = ?, extra = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`, [
            norm.name, norm.book_url, norm.author, norm.download_count, norm.rating,
            norm.sort_order, norm.intro, norm.cover_url,
            norm.rank_type, norm.category, norm.review_count, norm.chapter_count,
            norm.word_count, norm.is_complete, norm.extra, norm.is_active,
            id,
        ]);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function deleteHotRanking(req, res) {
    try {
        const { id } = req.body;
        await (0, database_1.execute)('DELETE FROM hot_rankings WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/**
 * 管理接口：根据用户阅读情况自动刷新排行榜（覆盖式生成 6 类榜单数据）。
 * 数据来源：books + user_books JOIN，统计每本书的读者数、章节数等。
 */
async function refreshRankingsFromUserData(_req, res) {
    try {
        const engine = new webBookService_1.WebBookEngine();
        // 预热分类缓存：给下面 autoDetectCategory 使用
        await (0, rankingService_1.getActiveCategories)(true);
        const rows = await (0, database_1.query)(`SELECT
         b.id,
         b.name,
         b.author,
         b.cover_url AS coverUrl,
         b.intro,
         b.kind,
         b.book_url AS bookUrl,
         b.origin AS origin,
         b.total_chapter_num AS chapterCount,
         b.word_count AS wordCountStr,
         b.latest_chapter_time AS latestChapterTime,
         COUNT(DISTINCT ub.user_id) AS readers
       FROM books b
       LEFT JOIN user_books ub ON ub.book_url = b.book_url
       WHERE b.name IS NOT NULL AND b.name <> ''
       GROUP BY b.id
       ORDER BY readers DESC
       LIMIT 500`);
        // 完本识别：kind/书名/简介里含完本/完结/全本/全集/已完结/全文完 等关键字
        const completeRegex = /(完本|完结|全本|全集|已完结|全文完|end|complete)/i;
        // 从文本里粗略提取字数（万字）："XXX万字" / "XXX字"
        const wcRegex = /(\d+(?:\.\d+)?)\s*万?[字章]/;
        // 章节标题里常含字数提示："第XXX章 ..." 只取章节计数用；下面真正获取时是 engine 直接拉
        // 去重：按书名+作者归一化，只为"补章节数/字数"时避免重复请求
        const seenBook = new Set();
        const seeds = [];
        for (const r of rows) {
            // —— 1) 先处理已有字段
            const wordCountStr = String(r.wordCountStr || '');
            let wordCount = 0;
            const directMatch = wordCountStr.match(/(\d+(?:\.\d+)?)/);
            if (directMatch)
                wordCount = Math.round(parseFloat(directMatch[1]));
            if (!wordCount) {
                const blob = `${r.intro || ''} ${r.kind || ''}`;
                const m = blob.match(wcRegex);
                if (m)
                    wordCount = Math.round(parseFloat(m[1]));
            }
            let chapterCount = Number(r.chapterCount) || 0;
            const isCompleteFromText = completeRegex.test(String(r.kind || '')) ||
                completeRegex.test(String(r.name || '')) ||
                completeRegex.test(String(r.intro || ''));
            let isComplete = isCompleteFromText ? 1 : 0;
            // —— 2) 如果仍缺章节数/字数，且这本书还没被处理过，则后台尝试从书源抓一次
            const bookKey = String(r.name || '').trim().toLowerCase() + '|' + String(r.author || '').trim().toLowerCase();
            if ((!chapterCount || !wordCount || !isComplete) && !seenBook.has(bookKey) && r.bookUrl && r.origin) {
                seenBook.add(bookKey);
                // origin 形如 "http://xxx.com/##@鱼"，书源 URL 是 "##" 之前的部分
                const sourceUrl = String(r.origin).split('#')[0].replace(/\/+$/, '');
                if (!sourceUrl)
                    continue;
                try {
                    const source = await (0, database_1.queryOne)('SELECT id, book_source_url, book_source_name, rule_book_info, rule_toc, rule_content, enabled FROM book_sources WHERE book_source_url LIKE ? AND enabled = 1 LIMIT 1', [sourceUrl + '%']);
                    if (source) {
                        const toc = await Promise.race([
                            engine.getChapterList(source, { bookUrl: r.bookUrl, name: r.name, author: r.author }),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('toc timeout')), 6000)),
                        ]);
                        if (Array.isArray(toc) && toc.length > 0) {
                            chapterCount = toc.length;
                            if (!wordCount) {
                                const est = Math.round((chapterCount * 5000) / 10000);
                                wordCount = est;
                            }
                            // 从最后 10 章的标题里检测是否包含"完本/结局/终章/全文完"等字样
                            if (!isComplete) {
                                const tail = toc.slice(-10);
                                for (const ch of tail) {
                                    const title = String((ch && (ch.title || ch.name)) || '').trim();
                                    if (completeRegex.test(title)) {
                                        isComplete = 1;
                                        break;
                                    }
                                }
                            }
                            try {
                                await (0, database_1.execute)('UPDATE books SET total_chapter_num = ?, word_count = ? WHERE id = ?', [chapterCount, String(wordCount), r.id]);
                            }
                            catch { /* ignore */ }
                        }
                    }
                }
                catch { /* 单个书源失败不影响整体榜单 */ }
            }
            seeds.push({
                name: r.name,
                author: r.author || '',
                coverUrl: r.coverUrl || '',
                intro: r.intro || '',
                kind: r.kind || '',
                bookUrl: r.bookUrl || '',
                readers: Number(r.readers) || 0,
                reviews: 0,
                chapterCount,
                wordCount,
                isComplete: isComplete ? 1 : 0,
                latestChapterTime: r.latestChapterTime ? new Date(r.latestChapterTime).toISOString() : '',
            });
        }
        // 排序构建 6 类榜单
        const auto = (0, rankingService_1.buildAutoRankingsFromBooks)(seeds, 20);
        await (0, database_1.execute)(`DELETE FROM hot_rankings WHERE rank_type IN ('popularity','new','review','chapter','complete','wordcount')`);
        let inserted = 0;
        for (const type of Object.keys(auto)) {
            const list = auto[type];
            for (const r of list) {
                await (0, database_1.execute)(`INSERT INTO hot_rankings
             (name, book_url, author, download_count, rating, sort_order, intro, cover_url,
              rank_type, category, review_count, chapter_count, word_count, is_complete, extra, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    r.name, r.book_url, r.author, r.download_count, r.rating,
                    r.sort_order, r.intro, r.cover_url,
                    r.rank_type, r.category, r.review_count, r.chapter_count,
                    r.word_count, r.is_complete, r.extra, r.is_active,
                ]);
                inserted += 1;
            }
        }
        res.json({ code: 0, data: { inserted, sourceCount: seeds.length }, msg: '排行榜已根据用户阅读情况刷新' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// ========== 热门标签 ==========
async function getHotTags(req, res) {
    try {
        const items = await (0, database_1.query)('SELECT id, name, sort_order FROM hot_tags WHERE is_active = 1 ORDER BY sort_order ASC, name ASC');
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function getAllHotTags(req, res) {
    try {
        const items = await (0, database_1.query)('SELECT * FROM hot_tags ORDER BY sort_order ASC, created_at DESC');
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function addHotTag(req, res) {
    try {
        const { name, sort_order } = req.body;
        const result = await (0, database_1.execute)('INSERT INTO hot_tags (name, sort_order) VALUES (?, ?)', [name, sort_order || 0]);
        res.json({ code: 0, data: { id: result.insertId } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function updateHotTag(req, res) {
    try {
        const { id, name, sort_order, is_active } = req.body;
        await (0, database_1.execute)('UPDATE hot_tags SET name = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?', [name, sort_order, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function deleteHotTag(req, res) {
    try {
        const { id } = req.body;
        await (0, database_1.execute)('DELETE FROM hot_tags WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
//# sourceMappingURL=homeController.js.map