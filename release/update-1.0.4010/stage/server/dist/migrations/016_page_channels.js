"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '016_page_channels';
async function up(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS page_channels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      path VARCHAR(255) NOT NULL,
      compat_path VARCHAR(255) DEFAULT NULL,
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
    CREATE TABLE IF NOT EXISTS page_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel_code VARCHAR(64) NOT NULL,
      section_code VARCHAR(64) NOT NULL,
      title VARCHAR(100) NOT NULL,
      display_type VARCHAR(64) NOT NULL,
      more_link VARCHAR(255) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_channel_section (channel_code, section_code),
      INDEX idx_page_sections_channel (channel_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    await db.query(`
    CREATE TABLE IF NOT EXISTS page_section_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      section_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(100) DEFAULT NULL,
      cover_url VARCHAR(500) DEFAULT NULL,
      intro TEXT DEFAULT NULL,
      category VARCHAR(50) DEFAULT NULL,
      word_count VARCHAR(50) DEFAULT NULL,
      latest_chapter VARCHAR(255) DEFAULT NULL,
      link_url VARCHAR(500) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_page_items_section (section_id),
      CONSTRAINT fk_page_items_section FOREIGN KEY (section_id) REFERENCES page_sections(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
//# sourceMappingURL=016_page_channels.js.map