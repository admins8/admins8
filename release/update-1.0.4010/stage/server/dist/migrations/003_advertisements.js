"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
const adDefaults_1 = require("../utils/adDefaults");
exports.name = '003_advertisements';
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS advertisements (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      position VARCHAR(50) NOT NULL COMMENT '广告位置：home_top/home_middle/home_bottom/reader_top/reader_middle/reader_bottom/reader_popup 等',
      title VARCHAR(200) NOT NULL DEFAULT '' COMMENT '广告标题',
      image_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '广告图片URL',
      link_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '点击跳转URL',
      content TEXT COMMENT '广告文字/HTML 内容（可用于代码位）',
      ad_type VARCHAR(20) NOT NULL DEFAULT 'image' COMMENT '广告类型：image/text/html',
      target VARCHAR(20) NOT NULL DEFAULT '_blank' COMMENT '链接打开方式',
      sort_order INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
      start_time DATETIME NULL COMMENT '生效起始时间，NULL 表示立即生效',
      end_time DATETIME NULL COMMENT '生效结束时间，NULL 表示永不过期',
      popup_interval_seconds INT NOT NULL DEFAULT ${adDefaults_1.DEFAULT_POPUP_INTERVAL_SECONDS} COMMENT '弹窗广告间隔秒数，仅 reader_popup 生效',
      popup_auto_close_seconds INT NOT NULL DEFAULT ${adDefaults_1.DEFAULT_POPUP_AUTO_CLOSE_SECONDS} COMMENT '弹窗广告自动关闭秒数，0 表示不自动关闭',
      is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用 1启用 0禁用',
      remark VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注说明',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_position (position),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广告位管理';
  `);
}
//# sourceMappingURL=003_advertisements.js.map