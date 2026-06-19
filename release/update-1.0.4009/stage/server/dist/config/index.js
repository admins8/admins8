"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const rootDir = path_1.default.resolve(process.cwd());
// 生产环境安全警告
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'legado-web-secret-key') {
        console.warn('[SECURITY] 生产环境必须设置强 JWT_SECRET，当前使用默认弱密钥！');
    }
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
        console.warn('[SECURITY] 生产环境必须设置强 ADMIN_PASSWORD，当前使用默认弱密码！');
    }
}
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    jwt: {
        secret: process.env.JWT_SECRET || 'legado-web-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'soumal',
        password: process.env.DB_PASSWORD || 'soumal',
        database: process.env.DB_NAME || 'soumal',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
    },
    redis: {
        enabled: process.env.REDIS_ENABLED !== 'false',
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        searchTtlSeconds: parseInt(process.env.SEARCH_CACHE_TTL_SECONDS || '600', 10),
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '1000', 10),
    },
    upload: {
        dir: path_1.default.resolve(rootDir, process.env.UPLOAD_DIR || 'data/uploads'),
    },
    log: {
        level: process.env.LOG_LEVEL || 'info',
    },
    security: {
        enableSourceJs: process.env.ENABLE_SOURCE_JS === 'true',
    },
    admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        email: process.env.ADMIN_EMAIL || 'admin@legado.local',
    },
    legadoApp: {
        url: process.env.LEGADO_APP_URL || '',
    },
    search: {
        sourceConcurrency: parseInt(process.env.SEARCH_SOURCE_CONCURRENCY || '10', 10),
        globalConcurrency: parseInt(process.env.SEARCH_GLOBAL_CONCURRENCY || '10', 10),
    },
    update: {
        // GitHub Pages 升级清单地址，例如：
        // https://admins88.github.io/legado-home/manifest.json
        manifestUrl: process.env.UPDATE_MANIFEST_URL || 'https://admins88.github.io/legado-home/manifest.json',
        // 升级临时工作目录（下载/解压）
        workDir: path_1.default.resolve(rootDir, process.env.UPDATE_WORK_DIR || 'data/updates'),
        // 升级前 dist 备份目录
        backupDir: path_1.default.resolve(rootDir, process.env.UPDATE_BACKUP_DIR || 'data/backups'),
        // 升级历史记录文件
        historyFile: path_1.default.resolve(rootDir, process.env.UPDATE_HISTORY_FILE || 'data/update-history.json'),
        // PM2 进程名（执行 reload 用）。本地测试可设为 false/none/空字符串跳过。
        pm2Name: ['false', 'none', ''].includes(String(process.env.UPDATE_PM2_NAME || '').toLowerCase())
            ? ''
            : (process.env.UPDATE_PM2_NAME || 'legado-server'),
        // 公钥路径（默认复用 license 公钥）
        publicKeyPath: path_1.default.resolve(rootDir, process.env.LICENSE_PUBLIC_KEY_PATH || 'license/public.pem'),
        // 在线检查/下载是否启用
        online: process.env.UPDATE_ONLINE !== 'false',
    },
};
//# sourceMappingURL=index.js.map