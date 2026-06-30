import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rootDir = path.resolve(process.cwd());

// 安全：JWT Secret 必须自定义，未设置时自动生成随机值并警告
function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  const randomSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[Security] JWT_SECRET 未设置或长度不足，已自动生成临时密钥。请在 .env 中设置 JWT_SECRET 以避免重启后 token 失效。');
  return randomSecret;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'le1234',
    password: process.env.DB_PASSWORD || 'le1234',
    database: process.env.DB_NAME || 'le1234',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },
  upload: {
    dir: path.resolve(rootDir, process.env.UPLOAD_DIR || 'data/uploads'),
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@legado.local',
  },
  legadoApp: {
    url: process.env.LEGADO_APP_URL || '',
  },
  update: {
    manifestUrl: process.env.UPDATE_MANIFEST_URL || '',
    online: process.env.UPDATE_ONLINE !== 'false',
    workDir: path.resolve(rootDir, process.env.UPDATE_WORK_DIR || 'data/updates'),
    publicKeyPath: path.resolve(rootDir, process.env.UPDATE_PUBLIC_KEY_PATH || 'data/updates/public.pem'),
    backupDir: path.resolve(rootDir, process.env.UPDATE_BACKUP_DIR || 'data/backups'),
    historyFile: path.resolve(rootDir, process.env.UPDATE_HISTORY_FILE || 'data/updates/history.json'),
    pm2Name: process.env.UPDATE_PM2_NAME || 'legado-server',
  },
  search: {
    globalConcurrency: parseInt(process.env.SEARCH_GLOBAL_CONCURRENCY || '3', 10),
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
    searchTtlSeconds: parseInt(process.env.REDIS_SEARCH_TTL || '600', 10),
  },
  security: {
    enableSourceJs: process.env.ENABLE_SOURCE_JS !== 'false',
  },
};
