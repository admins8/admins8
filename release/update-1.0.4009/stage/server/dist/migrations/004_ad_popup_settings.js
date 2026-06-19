"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
const adDefaults_1 = require("../utils/adDefaults");
exports.name = '004_ad_popup_settings';
async function up(db) {
    const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'advertisements'
      AND COLUMN_NAME IN ('popup_interval_seconds', 'popup_auto_close_seconds')
  `);
    const existing = new Set(columns.map((row) => row.COLUMN_NAME));
    if (!existing.has('popup_interval_seconds')) {
        await db.query(`
      ALTER TABLE advertisements
        ADD COLUMN popup_interval_seconds INT NOT NULL DEFAULT ${adDefaults_1.DEFAULT_POPUP_INTERVAL_SECONDS} COMMENT '弹窗广告间隔秒数，仅 reader_popup 生效';
    `);
    }
    if (!existing.has('popup_auto_close_seconds')) {
        await db.query(`
      ALTER TABLE advertisements
        ADD COLUMN popup_auto_close_seconds INT NOT NULL DEFAULT ${adDefaults_1.DEFAULT_POPUP_AUTO_CLOSE_SECONDS} COMMENT '弹窗广告自动关闭秒数，0 表示不自动关闭';
    `);
    }
}
//# sourceMappingURL=004_ad_popup_settings.js.map