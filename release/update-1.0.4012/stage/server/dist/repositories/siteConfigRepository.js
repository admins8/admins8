"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSiteConfigs = getAllSiteConfigs;
exports.getSiteConfigByKey = getSiteConfigByKey;
exports.upsertSiteConfig = upsertSiteConfig;
exports.upsertSiteConfigs = upsertSiteConfigs;
const database_1 = require("../config/database");
async function getAllSiteConfigs() {
    return (0, database_1.query)('SELECT id, config_key, config_value, description FROM site_config ORDER BY id');
}
async function getSiteConfigByKey(key) {
    return (0, database_1.queryOne)('SELECT config_key, config_value FROM site_config WHERE config_key = ?', [key]);
}
async function upsertSiteConfig(configKey, configValue) {
    await (0, database_1.execute)(`
    INSERT INTO site_config (config_key, config_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
  `, [configKey, configValue]);
}
async function upsertSiteConfigs(configs) {
    await (0, database_1.transaction)(async (conn) => {
        for (const item of configs) {
            await conn.execute(`
        INSERT INTO site_config (config_key, config_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()
      `, [item.config_key, item.config_value]);
        }
    });
}
//# sourceMappingURL=siteConfigRepository.js.map