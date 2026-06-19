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