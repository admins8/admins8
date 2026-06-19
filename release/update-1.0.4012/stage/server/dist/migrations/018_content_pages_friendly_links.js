"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '018_content_pages_friendly_links';
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS content_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      title VARCHAR(120) NOT NULL,
      content LONGTEXT DEFAULT NULL,
      seo_title VARCHAR(255) DEFAULT NULL,
      seo_keywords VARCHAR(500) DEFAULT NULL,
      seo_description TEXT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    await db.query(`
    CREATE TABLE IF NOT EXISTS friendly_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      url VARCHAR(500) NOT NULL,
      description VARCHAR(500) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      start_at DATETIME DEFAULT NULL,
      end_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_friendly_links_visible (is_active, start_at, end_at, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    await db.query(`
    INSERT IGNORE INTO content_pages
      (slug, title, content, seo_title, seo_keywords, seo_description, is_active, sort_order)
    VALUES
      ('about', '关于我们', '<p>请在后台编辑关于我们页面内容。</p>', '关于我们', '关于我们', '关于我们', 1, 1),
      ('contact', '联系我们', '<p>请在后台编辑联系方式。</p>', '联系我们', '联系我们', '联系我们', 1, 2),
      ('agreement', '用户协议', '<p>请在后台编辑用户协议。</p>', '用户协议', '用户协议', '用户协议', 1, 3),
      ('privacy', '隐私政策', '<p>请在后台编辑隐私政策。</p>', '隐私政策', '隐私政策', '隐私政策', 1, 4)
  `);
    await db.query(`
    INSERT IGNORE INTO site_config (config_key, config_value, description)
    VALUES ('friendly_links_enabled', 'true', '友情链接总开关')
  `);
}
//# sourceMappingURL=018_content_pages_friendly_links.js.map