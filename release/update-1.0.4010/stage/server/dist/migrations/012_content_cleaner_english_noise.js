"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
const contentCleaner_1 = require("../services/contentCleaner");
exports.name = '012_content_cleaner_english_noise';
/**
 * 为已有站点配置追加常见英文广告/站点提示行净化规则。
 *
 * 旧库已经存在 content_cleaner_rules 时，INSERT IGNORE 不会覆盖旧值，
 * 所以这里做一次兼容性合并，保留用户自定义规则并追加新增默认规则。
 */
async function up(db) {
    const [rows] = await db.query('SELECT config_value FROM site_config WHERE config_key = ? LIMIT 1', ['content_cleaner_rules']);
    const current = (0, contentCleaner_1.normalizeContentCleanerRules)(rows[0]?.config_value || null);
    const currentPatterns = current.removePatterns || [];
    const mergedPatterns = [...currentPatterns];
    for (const pattern of contentCleaner_1.defaultContentCleanerRules.removePatterns || []) {
        if (!mergedPatterns.includes(pattern)) {
            mergedPatterns.push(pattern);
        }
    }
    const nextRules = {
        ...current,
        removePatterns: mergedPatterns,
    };
    await db.query(`INSERT INTO site_config (config_key, config_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       config_value = VALUES(config_value),
       description = VALUES(description)`, ['content_cleaner_rules', JSON.stringify(nextRules), '正文净化规则']);
}
//# sourceMappingURL=012_content_cleaner_english_noise.js.map