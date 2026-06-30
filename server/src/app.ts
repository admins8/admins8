import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { config } from './config';
import { initDatabase, closeDb, getDb } from './config/database';
import { runMigrations } from './config/migrations';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { syncStaticSeoShells } from './services/seoHtmlService';
import { visitorTracker } from './services/visitorStats';

// 导入路由
import authRoutes from './routes/auth';
import bookRoutes from './routes/book';
import sourceRoutes from './routes/source';
import adminRoutes from './routes/admin';
import homeRoutes from './routes/home';
import siteConfigRoutes from './routes/siteConfig';
import adRoutes from './routes/ad';
import appRoutes from './routes/app';
import databaseRoutes from './routes/database';
import licenseRoutes from './routes/license';
import { publicPageRoutes, adminPageRoutes } from './routes/page';
import rssSourceRoutes from './routes/rssSource';
import updateRoutes from './routes/update';
import uploadRoutes from './routes/upload';
import userRoutes from './routes/user';
import collectorRoutes from './routes/collector';
import memberRoutes from './routes/member';
import paymentRoutes from './routes/payment';
import { startCollectorScheduler } from './services/collectorScheduler';

const app = express();

// ============ 中间件 ============
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression()); // 启用 Gzip 压缩
// CORS 白名单：优先从环境变量读取，生产环境应配置具体域名
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOrigin = CORS_ORIGINS.length > 0
  ? CORS_ORIGINS
  : true; // 开发环境允许所有来源

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 静态文件 - 上传的文件
const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// ============ API 路由 ============
app.use('/api/auth', authRoutes);
app.use('/api/book', bookRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/config', siteConfigRoutes);
app.use('/api/admin/ads', adRoutes);
app.use('/api/ads', adRoutes); // 兼容前端请求路径
app.use('/api/app', appRoutes);
app.use('/api/admin/database', databaseRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/pages', publicPageRoutes);
app.use('/api/admin/pages', adminPageRoutes);
app.use('/api/rss-sources', rssSourceRoutes);
app.use('/api/admin/update', updateRoutes);
app.use('/api/admin/upload', uploadRoutes);
app.use('/api/upload', uploadRoutes); // 兼容前端请求路径
app.use('/api/user', userRoutes);
app.use('/api/admin', collectorRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/payment', paymentRoutes);

// 访客统计中间件（挂在 API 路由之后，捕获前端页面访问）
app.use(visitorTracker);

// 图片代理：解决 HTTPS 页面加载 HTTP 封面的 Mixed Content 问题
// 安全：过滤内网 IP 和私有地址，防止 SSRF
function isPrivateIp(hostname: string): boolean {
  // 拒绝 localhost、纯 IP 私有地址
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^0\./,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return privateRanges.some(r => r.test(hostname));
}

app.get('/api/proxy-image', (req, res) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    res.status(400).send('Invalid url parameter');
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).send('Invalid url parameter');
    return;
  }
  if (isPrivateIp(parsed.hostname)) {
    res.status(403).send('Access to internal addresses is forbidden');
    return;
  }
  const client = targetUrl.startsWith('https:') ? https : http;
  const proxyReq = client.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'];
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[proxy-image] error:', err.message, targetUrl);
    res.status(502).send('Proxy error');
  });
  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    res.status(504).send('Proxy timeout');
  });
});

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    code: 0,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// ============ 前端静态文件 ============
// 优先使用 web/dist（新编译产物），回退到 web/dist（旧路径兼容）
const webDistPath = fs.existsSync(path.resolve(__dirname, '../../web/dist'))
  ? path.resolve(__dirname, '../../web/dist')
  : fs.existsSync(path.resolve(__dirname, '../../web/dist'))
    ? path.resolve(__dirname, '../../web/dist')
    : path.resolve(__dirname, '../../_web_build/dist');
if (fs.existsSync(webDistPath)) {
  // SPA fallback - 排除 API、uploads 和静态资源路径
  // 必须在 express.static 之前注册，避免预渲染文件（如 book-detail）被当成静态文件下载
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next(); // 交给后面的 notFoundHandler
    }
    // 只有请求 HTML 页面时才返回 SPA 入口
    const acceptHeader = req.headers.accept || '';
    const isHtmlRequest = acceptHeader.includes('text/html') || req.path === '/' || !req.path.includes('.');
    if (!isHtmlRequest) {
      return next(); // 让 express.static 处理静态资源
    }
    // 使用 fs.readFileSync + res.send 避免 Windows 上 sendFile 的文件截断问题
    const indexHtml = fs.readFileSync(path.join(webDistPath, 'index.html'), 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(indexHtml);
  });
  // 禁用 index 自动发送，避免 express.static 截断 index.html
  app.use(express.static(webDistPath, { index: false }));
}

// ============ 错误处理 ============
app.use(notFoundHandler);
app.use(errorHandler);

// ============ 启动服务 ============
async function start() {
  try {
    // 初始化数据库（异步，创建表和默认数据）
    await initDatabase();
    console.log('[DB] MySQL 数据库初始化完成');

    // 执行数据库迁移
    await runMigrations(getDb());

    // 预渲染 SEO HTML（友情链接等）
    if (fs.existsSync(webDistPath)) {
      syncStaticSeoShells(webDistPath).catch((err: unknown) =>
        console.error('[SEO] 预渲染失败:', err instanceof Error ? err.message : err)
      );
    }

    app.listen(config.port, () => {
      console.log(`\n🚀 Legado Web 服务已启动`);
      console.log(`   地址: http://localhost:${config.port}`);
      console.log(`   API:  http://localhost:${config.port}/api`);
      console.log(`   环境: ${process.env.NODE_ENV || 'development'}\n`);
    });

    // 启动定时采集调度器
    startCollectorScheduler().catch((err: unknown) =>
      console.error('[Scheduler] 启动失败:', err instanceof Error ? err.message : err)
    );
  } catch (err) {
    console.error('[启动失败]', err);
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[关闭] 正在关闭服务...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

start();

export default app;
