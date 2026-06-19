"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const config_1 = require("./config");
const database_1 = require("./config/database");
const productionGuard_1 = require("./config/productionGuard");
const errorHandler_1 = require("./middleware/errorHandler");
const licenseGuard_1 = require("./middleware/licenseGuard");
const visitorStats_1 = require("./services/visitorStats");
const autoDedupe_1 = require("./services/autoDedupe");
const sourceValidationSchedule_1 = require("./services/sourceValidationSchedule");
const licenseService_1 = require("./services/licenseService");
const versionService_1 = require("./services/versionService");
const seoService_1 = require("./services/seoService");
// 导入路由
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const book_1 = __importDefault(require("./routes/book"));
const source_1 = __importDefault(require("./routes/source"));
const rssSource_1 = __importDefault(require("./routes/rssSource"));
const admin_1 = __importDefault(require("./routes/admin"));
const home_1 = __importDefault(require("./routes/home"));
const siteConfig_1 = __importDefault(require("./routes/siteConfig"));
const upload_1 = __importDefault(require("./routes/upload"));
const ad_1 = __importDefault(require("./routes/ad"));
const license_1 = __importDefault(require("./routes/license"));
const update_1 = __importDefault(require("./routes/update"));
const database_2 = __importDefault(require("./routes/database"));
const page_1 = require("./routes/page");
const app = (0, express_1.default)();
// ============ 中间件 ============
// 生产环境建议通过环境变量 CORS_ORIGIN 配置允许的域名，默认只允许同源
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : (process.env.NODE_ENV === 'production' ? [] : true);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(visitorStats_1.visitorTracker);
// 授权域名校验：放在路由之前
app.use((0, licenseGuard_1.licenseDomainGuard)());
// 静态文件 - 上传的文件
const uploadDir = config_1.config.upload.dir;
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadDir));
// ============ API 路由 ============
app.use('/api/auth', auth_1.default);
app.use('/api/user', user_1.default);
app.use('/api/book', book_1.default);
app.use('/api/sources', source_1.default);
app.use('/api/rss-sources', rssSource_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/home', home_1.default);
app.use('/api/config', siteConfig_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/ads', ad_1.default);
app.use('/api/license', license_1.default);
app.use('/api/admin/update', update_1.default);
app.use('/api/admin/database', database_2.default);
app.use('/api/pages', page_1.publicPageRoutes);
app.use('/api/admin/pages', page_1.adminPageRoutes);
app.get('/robots.txt', async (_req, res) => {
    const domain = await (0, seoService_1.getSeoDomain)();
    res.type('text/plain; charset=utf-8').send((0, seoService_1.buildRobotsTxt)(domain));
});
app.get('/sitemap.xml', async (_req, res) => {
    const urls = await (0, seoService_1.collectSitemapUrls)();
    res.type('application/xml; charset=utf-8').send((0, seoService_1.buildSitemapXml)(urls));
});
app.get('/book/:slug.html', async (req, res, next) => {
    const id = Number(String(req.params.slug || '').split('-')[0]);
    if (!id)
        return next();
    const book = await (0, database_1.query)('SELECT * FROM books WHERE id=? LIMIT 1', [id]).then(rows => rows[0]).catch(() => null);
    if (!book)
        return res.status(404).type('html').send('<h1>404</h1><p>书籍不存在</p>');
    const domain = await (0, seoService_1.getSeoDomain)();
    const canonical = (0, seoService_1.buildSeoBookUrl)(domain, book);
    const title = `${escapeHtml(book.name)}最新章节_${escapeHtml(book.name)}全文阅读_${escapeHtml(book.author || '')}_搜书网`;
    const description = escapeHtml(`搜书网提供${book.author || ''}作品《${book.name}》的最新章节目录、简介和可用书源。${String(book.intro || '').slice(0, 120)}`);
    const chapters = await (0, database_1.query)('SELECT chapter_index, title FROM book_chapters WHERE book_url=? ORDER BY chapter_index ASC LIMIT 50', [book.book_url]).catch(() => []);
    const chapterItems = chapters.map(ch => `<li><a href="${canonical}#chapter-${Number(ch.chapter_index)}">${escapeHtml(ch.title)}</a></li>`).join('\n');
    res.type('html').send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <meta name="keywords" content="${escapeHtml(`${book.name},${book.author || ''},${book.name}最新章节,${book.name}全文阅读`)}" />
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
</head>
<body>
  <main>
    <h1>${escapeHtml(book.name)}</h1>
    <p>作者：${escapeHtml(book.author || '未知')}</p>
    <p>分类：${escapeHtml(book.kind || book.category || '小说')}</p>
    <p>最新章节：${escapeHtml(book.latest_chapter_title || '')}</p>
    <section><h2>作品简介</h2><p>${escapeHtml(book.intro || '暂无简介')}</p></section>
    <section><h2>${escapeHtml(book.name)}章节目录</h2><ul>${chapterItems || '<li>目录整理中</li>'}</ul></section>
    <p><a href="/">返回首页</a> · <a href="/library">进入书库</a></p>
  </main>
</body>
</html>`);
});
app.get('/tag/:name.html', async (req, res) => {
    const tag = decodeURIComponent(String(req.params.name || '').replace(/\.html$/i, ''));
    const domain = await (0, seoService_1.getSeoDomain)();
    const books = await (0, database_1.query)('SELECT id, name, author, updated_at FROM books WHERE kind LIKE ? OR name LIKE ? ORDER BY updated_at DESC LIMIT 50', [`%${tag}%`, `%${tag}%`]).catch(() => []);
    const items = books.map(book => `<li><a href="${(0, seoService_1.buildSeoBookUrl)(domain, book)}">${escapeHtml(book.name)}</a> <span>${escapeHtml(book.author || '')}</span></li>`).join('\n');
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>${escapeHtml(tag)}小说推荐_搜书网</title><meta name="description" content="${escapeHtml(`搜书网为你推荐${tag}相关小说、热门书籍和最新入库作品。`)}" /></head><body><main><h1>${escapeHtml(tag)}小说推荐</h1><ul>${items || '<li>暂无相关作品</li>'}</ul><p><a href="/">返回首页</a></p></main></body></html>`);
});
// 健康检查
app.get('/api/health', (_req, res) => {
    res.json({
        code: 0,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: (0, versionService_1.getCurrentVersion)(),
        },
    });
});
// ============ 前端静态文件 ============
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeJsonForHtml(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
function renderSeoTemplate(template, configs) {
    const year = String(new Date().getFullYear());
    return String(template || '')
        .replace(/\{siteName\}/g, configs.site_title || '搜书网')
        .replace(/\{网站名\}/g, configs.site_title || '搜书网')
        .replace(/\{年份\}/g, year)
        .replace(/\{year\}/g, year);
}
async function renderIndexHtml(indexPath) {
    let html = fs_1.default.readFileSync(indexPath, 'utf-8');
    try {
        const configs = await (0, database_1.query)('SELECT config_key, config_value FROM site_config');
        const configMap = configs.reduce((map, item) => {
            map[item.config_key] = item.config_value || '';
            return map;
        }, {});
        const title = escapeHtml(renderSeoTemplate(configMap.home_title || configMap.site_title || '', configMap));
        const keywords = escapeHtml(renderSeoTemplate(configMap.home_keywords || '', configMap));
        const description = escapeHtml(renderSeoTemplate(configMap.home_description || '', configMap));
        const webDomain = escapeHtml(configMap.web_domain || '');
        const wapDomain = escapeHtml(configMap.wap_domain || '');
        const icpNumber = escapeHtml(configMap.icp_number || '');
        const copyright = escapeHtml(configMap.copyright || '');
        const configJson = escapeJsonForHtml(configMap);
        html = html
            .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
            .replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i, `<meta name="keywords" content="${keywords}" />`)
            .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`)
            .replace(/<meta\s+name="web_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="web_domain" content="${webDomain}" />`)
            .replace(/<meta\s+name="wap_domain"\s+content="[^"]*"\s*\/?>/i, `<meta name="wap_domain" content="${wapDomain}" />`)
            .replace(/<meta\s+name="icp_number"\s+content="[^"]*"\s*\/?>/i, `<meta name="icp_number" content="${icpNumber}" />`)
            .replace(/<meta\s+name="copyright"\s+content="[^"]*"\s*\/?>/i, `<meta name="copyright" content="${copyright}" />`)
            .replace(/<script\s+id="site-config-json"\s+type="application\/json">[\s\S]*?<\/script>/i, `<script id="site-config-json" type="application/json">${configJson}</script>`);
    }
    catch (err) {
        console.error('[HTML] 注入网站配置失败:', err);
    }
    return html;
}
const webDistPath = path_1.default.resolve(__dirname, '../../web/dist');
if (fs_1.default.existsSync(webDistPath)) {
    app.use(express_1.default.static(webDistPath, { index: false }));
    // SPA fallback
    app.get('*', async (_req, res) => {
        const html = await renderIndexHtml(path_1.default.join(webDistPath, 'index.html'));
        res.type('html').send(html);
    });
}
// ============ 错误处理 ============
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
// ============ 启动服务 ============
async function start() {
    try {
        (0, productionGuard_1.assertProductionReady)({
            jwtSecret: config_1.config.jwt.secret,
            adminPassword: config_1.config.admin.password,
            sourceJsEnabled: config_1.config.security.enableSourceJs,
            redisEnabled: config_1.config.redis.enabled,
        });
        // 先校验授权文件，未通过则拒绝启动
        const licenseResult = (0, licenseService_1.verifyLicense)();
        if (!licenseResult.valid) {
            console.error('[License] 授权校验失败：', licenseResult.reason);
            console.error('[License] 请把供应商签发的 license.lic 放到 license/ 目录下');
            process.exit(2);
        }
        (0, licenseService_1.setActiveLicense)(licenseResult.payload);
        console.log(`[License] 已激活 ${licenseResult.payload.licenseId} -> ${licenseResult.payload.customerId}`);
        console.log(`[License] 授权域名: ${licenseResult.payload.domains.join(', ')}`);
        // 初始化数据库（异步，创建表和默认数据）
        await (0, database_1.initDatabase)();
        console.log('[DB] MySQL 数据库初始化完成');
        // 启动自动去重定时任务
        autoDedupe_1.autoDedupeScheduler.start();
        sourceValidationSchedule_1.sourceValidationScheduler.start();
        app.listen(config_1.config.port, () => {
            console.log(`\n🚀 Legado Web 服务已启动`);
            console.log(`   地址: http://localhost:${config_1.config.port}`);
            console.log(`   API:  http://localhost:${config_1.config.port}/api`);
            console.log(`   环境: ${process.env.NODE_ENV || 'development'}\n`);
        });
    }
    catch (err) {
        console.error('[启动失败]', err);
        process.exit(1);
    }
}
// 优雅退出
process.on('SIGINT', () => {
    console.log('\n[关闭] 正在关闭服务...');
    (0, database_1.closeDb)();
    process.exit(0);
});
process.on('SIGTERM', () => {
    (0, database_1.closeDb)();
    process.exit(0);
});
start();
exports.default = app;
//# sourceMappingURL=app.js.map