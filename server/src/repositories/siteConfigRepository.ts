import { execute, query, queryOne, transaction } from '../config/database';

export interface SiteConfigItem {
  id?: number;
  config_key: string;
  config_value: string;
  description?: string;
}

export async function getAllSiteConfigs(): Promise<SiteConfigItem[]> {
  return query('SELECT id, config_key, config_value, description FROM site_config ORDER BY id');
}

export async function getSiteConfigByKey(key: string): Promise<SiteConfigItem | null> {
  return queryOne('SELECT config_key, config_value FROM site_config WHERE config_key = ?', [key]);
}

export async function upsertSiteConfig(configKey: string, configValue: string): Promise<void> {
  await execute(`
    INSERT INTO site_config (config_key, config_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
  `, [configKey, configValue]);
}

export async function upsertSiteConfigs(configs: Array<{ config_key: string; config_value: string }>): Promise<void> {
  await transaction(async (conn) => {
    for (const item of configs) {
      await conn.execute(`
        INSERT INTO site_config (config_key, config_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
      `, [item.config_key, item.config_value]);
    }
  });
}
