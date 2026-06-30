import { Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../config/database';
import { sendMail } from '../services/emailService';
import { getCache, setCache } from '../utils/memoryCache';

/** 获取所有配置 */
const CONFIG_CACHE_KEY = 'site:all_configs';
const CONFIG_CACHE_TTL = 30_000; // 30秒

/** 敏感配置key列表，公开接口不返回这些配置 */
const SENSITIVE_KEYS = new Set([
  'jwt_secret',
  'db_password',
  'smtp_password',
  'smtp_username',
  'admin_password',
  'wechat_private_key',
  'alipay_private_key',
  'api_key',
  'secret_key',
  'private_key',
]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.has(lower) ||
    lower.includes('password') ||
    lower.includes('secret') ||
    lower.includes('private_key') ||
    lower.includes('api_key') ||
    lower.includes('token');
}

function filterSensitiveConfigs(items: any[]): any[] {
  return items.map(item => ({
    ...item,
    config_value: isSensitiveKey(item.config_key) ? '******' : item.config_value,
  }));
}

export async function getAllConfigs(req: Request, res: Response): Promise<void> {
  try {
    const cached = getCache(CONFIG_CACHE_KEY);
    if (cached) {
      res.json({ code: 0, data: cached });
      return;
    }
    const items = await query('SELECT id, config_key, config_value, description FROM site_config ORDER BY id');
    const isAdmin = (req as any).user && ((req as any).user.role === 'admin' || (req as any).user.role === 'superadmin');
    const result = isAdmin ? items : filterSensitiveConfigs(items);
    setCache(CONFIG_CACHE_KEY, result, CONFIG_CACHE_TTL);
    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/** 获取单个配置 */
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const key = String(req.params.key || '');
    if (isSensitiveKey(key)) {
      res.json({ code: 403, msg: '该配置项不允许公开访问' });
      return;
    }
    const item = await queryOne('SELECT config_key, config_value FROM site_config WHERE config_key = ?', [key]);
    if (item) {
      res.json({ code: 0, data: item });
    } else {
      res.json({ code: 404, msg: '配置不存在' });
    }
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/** 更新配置 */
export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    const { config_key, config_value } = req.body;
    await execute("UPDATE site_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?", [config_value, config_key]);
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/** 批量更新配置 */
export async function updateConfigs(req: Request, res: Response): Promise<void> {
  try {
    const configs = req.body;
    await transaction(async (conn) => {
      for (const item of configs) {
        await conn.execute("UPDATE site_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?", [item.config_value, item.config_key]);
      }
    });
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

/** 测试邮箱配置 */
export async function testEmailConfig(req: Request, res: Response): Promise<void> {
  try {
    const { to } = req.body;
    if (!to) {
      res.json({ code: 400, msg: '请输入测试收件邮箱' });
      return;
    }
    await sendMail({
      to,
      subject: '搜猫阅读 - 邮箱配置测试',
      text: '如果您收到这封邮件，说明邮箱 SMTP 配置正确。',
      html: '<p>如果您收到这封邮件，说明邮箱 SMTP 配置正确。</p><p>—— 搜猫阅读系统</p>',
    });
    res.json({ code: 0, msg: '测试邮件已发送' });
  } catch (err: any) {
    res.json({ code: 500, msg: `发送失败: ${err.message}` });
  }
}
