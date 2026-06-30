import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from './index';

let pool: mysql.Pool;

/**
 * 获取 MySQL 连接池（单例模式）
 */
export function getDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionLimit: config.db.connectionLimit,
      charset: 'utf8mb4',
      multipleStatements: true,
      connectTimeout: 10000,
    });
    // 确保连接使用 utf8mb4 字符集
    pool.on('connection', (connection: any) => {
      connection.query('SET NAMES utf8mb4');
    });
  }
  return pool;
}

/**
 * 关闭数据库连接池
 */
export function closeDb(): void {
  if (pool) {
    pool.end();
    pool = undefined as any;
  }
}

/**
 * 辅助查询函数 - 执行 SELECT 查询，返回行数组
 */
export async function query(sql: string, params?: any[]): Promise<any[]> {
  const db = getDb();
  const [rows] = await db.query(sql, params);
  return rows as any[];
}

/**
 * 辅助查询函数 - 执行 SELECT 查询，返回单行
 */
export async function queryOne(sql: string, params?: any[]): Promise<any> {
  const db = getDb();
  const [rows] = await db.query(sql, params);
  return (rows as any[])[0] || null;
}

/**
 * 辅助执行函数 - 执行 INSERT/UPDATE/DELETE，返回 affectedRows 和 insertId
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId: number }> {
  const db = getDb();
  const [result] = await db.execute(sql, params);
  return {
    affectedRows: (result as any).affectedRows,
    insertId: (result as any).insertId,
  };
}

/**
 * 事务执行器 - 在事务中执行回调函数
 */
export async function transaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const db = getDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 初始化数据库 - 创建所有表（MySQL 语法）
 * 注意：mysql2 需要开启 multipleStatements 才能一次执行多条语句
 */
export async function initDatabase(): Promise<void> {
  const db = getDb();

  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(200) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(500) DEFAULT '',
      role VARCHAR(20) DEFAULT 'user',
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS books (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_url VARCHAR(500) UNIQUE NOT NULL,
      toc_url VARCHAR(500) DEFAULT '',
      origin VARCHAR(200) DEFAULT '',
      origin_name VARCHAR(200) DEFAULT '',
      name VARCHAR(500) NOT NULL,
      author VARCHAR(200) DEFAULT '',
      kind TEXT DEFAULT NULL,
      cover_url VARCHAR(500) DEFAULT '',
      intro TEXT DEFAULT NULL,
      custom_cover_url VARCHAR(500) DEFAULT '',
      custom_intro TEXT DEFAULT NULL,
      custom_tag TEXT DEFAULT NULL,
      type INT DEFAULT 0,
      group_id INT DEFAULT 0,
      total_chapter_num INT DEFAULT 0,
      latest_chapter_title VARCHAR(500) DEFAULT '',
      latest_chapter_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_check_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_check_count INT DEFAULT 0,
      word_count VARCHAR(50) DEFAULT '',
      can_update TINYINT(1) DEFAULT 1,
      order_num INT DEFAULT 0,
      origin_order INT DEFAULT 0,
      variable TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_books_name (name),
      INDEX idx_books_author (author)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS book_sources (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_source_url VARCHAR(500) UNIQUE NOT NULL,
      book_source_name VARCHAR(200) NOT NULL,
      book_source_group TEXT DEFAULT NULL,
      book_source_type INT DEFAULT 0,
      book_url_pattern TEXT DEFAULT NULL,
      custom_order INT DEFAULT 0,
      enabled TINYINT(1) DEFAULT 1,
      enabled_explore TINYINT(1) DEFAULT 1,
      js_lib TEXT DEFAULT NULL,
      enabled_cookie_jar TINYINT(1) DEFAULT 1,
      concurrent_rate VARCHAR(200) DEFAULT NULL,
      header TEXT DEFAULT NULL,
      login_url TEXT DEFAULT NULL,
      login_ui TEXT DEFAULT NULL,
      login_check_js TEXT DEFAULT NULL,
      cover_decode_js TEXT DEFAULT NULL,
      book_source_comment TEXT DEFAULT NULL,
      variable_comment TEXT DEFAULT NULL,
      last_update_time BIGINT DEFAULT 0,
      respond_time INT DEFAULT 180000,
      weight INT DEFAULT 0,
      explore_url TEXT DEFAULT NULL,
      search_url TEXT DEFAULT NULL,
      rule_search TEXT DEFAULT NULL,
      rule_book_info TEXT DEFAULT NULL,
      rule_toc TEXT DEFAULT NULL,
      rule_content TEXT DEFAULT NULL,
      rule_review TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_book_sources_group (book_source_group(255)),
      INDEX idx_book_sources_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS book_chapters (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_url VARCHAR(500) NOT NULL,
      chapter_index INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      url VARCHAR(500) DEFAULT '',
      is_vip TINYINT(1) DEFAULT 0,
      is_pay TINYINT(1) DEFAULT 0,
      tag VARCHAR(200) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_book_chapter (book_url, chapter_index),
      INDEX idx_book_chapters_book_url (book_url)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS user_books (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      book_url VARCHAR(500) NOT NULL,
      dur_chapter_index INT DEFAULT 0,
      dur_chapter_pos INT DEFAULT 0,
      dur_chapter_title VARCHAR(500) DEFAULT '',
      dur_chapter_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      group_id INT DEFAULT 0,
      order_num INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_book (user_id, book_url),
      INDEX idx_user_books_user_id (user_id),
      CONSTRAINT fk_user_books_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS book_contents (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_url VARCHAR(500) NOT NULL,
      chapter_index INT NOT NULL,
      content LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_book_content (book_url, chapter_index),
      INDEX idx_book_contents_book_url (book_url)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS replace_rules (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) DEFAULT '',
      \`group\` VARCHAR(200) DEFAULT NULL,
      pattern VARCHAR(500) DEFAULT '',
      replacement VARCHAR(500) DEFAULT '',
      scope TEXT DEFAULT NULL,
      isEnabled TINYINT(1) DEFAULT 1,
      isRegex TINYINT(1) DEFAULT 0,
      order_num INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS read_records (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      book_name VARCHAR(500) NOT NULL,
      book_author VARCHAR(200) DEFAULT '',
      read_time INT DEFAULT 0,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_read_records_user_id (user_id),
      CONSTRAINT fk_read_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS hot_searches (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      count INT DEFAULT 0,
      tag_type VARCHAR(50) DEFAULT 'primary',
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS advertisements (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      position VARCHAR(50) NOT NULL COMMENT '广告位置',
      title VARCHAR(200) NOT NULL DEFAULT '' COMMENT '广告标题',
      image_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '广告图片URL',
      link_url VARCHAR(500) NOT NULL DEFAULT '' COMMENT '点击跳转URL',
      content TEXT COMMENT '广告文字/HTML 内容',
      ad_type VARCHAR(20) NOT NULL DEFAULT 'image' COMMENT '广告类型：image/text/html',
      target VARCHAR(20) NOT NULL DEFAULT '_blank' COMMENT '链接打开方式',
      sort_order INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
      start_time DATETIME NULL COMMENT '生效起始时间',
      end_time DATETIME NULL COMMENT '生效结束时间',
      popup_interval_seconds INT NOT NULL DEFAULT 3600 COMMENT '弹窗广告间隔秒数',
      popup_auto_close_seconds INT NOT NULL DEFAULT 10 COMMENT '弹窗广告自动关闭秒数',
      is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
      remark VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注说明',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_position (position),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广告位管理';

    CREATE TABLE IF NOT EXISTS hot_rankings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      book_url VARCHAR(500) DEFAULT '',
      author VARCHAR(200) DEFAULT '',
      cover_url VARCHAR(500) DEFAULT '',
      intro TEXT DEFAULT NULL,
      download_count INT DEFAULT 0,
      rating DECIMAL(3,1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      rank_type VARCHAR(32) NOT NULL DEFAULT 'popularity',
      category VARCHAR(64) NOT NULL DEFAULT '全部',
      review_count INT NOT NULL DEFAULT 0,
      chapter_count INT NOT NULL DEFAULT 0,
      word_count INT NOT NULL DEFAULT 0,
      is_complete TINYINT(1) NOT NULL DEFAULT 0,
      extra VARCHAR(200) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ranking_type_category (rank_type, category, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS hot_tags (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS site_config (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT,
      description VARCHAR(500) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS app_settings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_app_setting (user_id, \`key\`),
      CONSTRAINT fk_app_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS visitor_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      visitor_key CHAR(64) NOT NULL,
      ip_address VARCHAR(100) DEFAULT '',
      user_agent VARCHAR(500) DEFAULT '',
      path VARCHAR(500) DEFAULT '',
      visit_count INT DEFAULT 1,
      first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_visitor_key (visitor_key),
      INDEX idx_visitor_last_visit (last_visit_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS membership_config (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      product_type VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(50) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      sale_price DECIMAL(10,2) NOT NULL,
      duration_days INT NOT NULL,
      badge_icon VARCHAR(200) DEFAULT '',
      badge_color VARCHAR(20) DEFAULT '#FFD700',
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS member_orders (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      order_no VARCHAR(64) UNIQUE NOT NULL,
      trade_no VARCHAR(128) DEFAULT '',
      product_type VARCHAR(20) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      pay_amount DECIMAL(10,2) DEFAULT 0,
      pay_channel VARCHAR(20) DEFAULT '',
      status VARCHAR(20) DEFAULT 'pending',
      paid_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_order_no (order_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS payment_config (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      channel VARCHAR(20) UNIQUE NOT NULL,
      app_id VARCHAR(100) DEFAULT '',
      merchant_id VARCHAR(100) DEFAULT '',
      private_key TEXT,
      public_key TEXT,
      api_key VARCHAR(255) DEFAULT '',
      notify_url VARCHAR(500) DEFAULT '',
      is_active TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await db.query(sql);

  // 插入默认网站配置
  await db.query(
    `INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('site_title', '搜书网', '网站标题'),
      ('site_subtitle', '搜书网，图片格式，由网站管理员后台上传', '网站副标题')`
  );

  // 初始化管理员账号（检查是否存在任何管理员）
  const [adminRows] = await db.query("SELECT id FROM users WHERE role IN ('admin', 'superadmin')");
  if ((adminRows as any[]).length === 0) {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [config.admin.username, config.admin.email, hash, 'superadmin']
    );
    console.log('[DB] 超级管理员账号已初始化 (admin/admin123)');
  }

  // 初始化默认会员配置
  await db.query(
    `INSERT IGNORE INTO membership_config (product_type, name, price, sale_price, duration_days, badge_icon, badge_color, description, sort_order) VALUES
      ('monthly', '月会员', 30.00, 19.90, 30, 'vip-month', '#FFD700', '享受30天会员权益', 1),
      ('quarterly', '季会员', 90.00, 49.90, 90, 'vip-quarter', '#FF6B6B', '享受90天会员权益', 2),
      ('yearly', '年会员', 360.00, 168.00, 365, 'vip-year', '#9B59B6', '享受365天会员权益', 3)`
  );

  // 自动修复：为已存在的表添加缺失的列（兼容旧数据库）
  const missingColumns: Array<{ table: string; column: string; ddl: string }> = [
    { table: 'hot_rankings', column: 'cover_url', ddl: "ALTER TABLE hot_rankings ADD COLUMN cover_url VARCHAR(500) DEFAULT ''" },
    { table: 'hot_rankings', column: 'intro', ddl: 'ALTER TABLE hot_rankings ADD COLUMN intro TEXT DEFAULT NULL' },
    { table: 'hot_rankings', column: 'rank_type', ddl: "ALTER TABLE hot_rankings ADD COLUMN rank_type VARCHAR(32) NOT NULL DEFAULT 'popularity'" },
    { table: 'hot_rankings', column: 'category', ddl: "ALTER TABLE hot_rankings ADD COLUMN category VARCHAR(64) NOT NULL DEFAULT '全部'" },
    { table: 'hot_rankings', column: 'review_count', ddl: 'ALTER TABLE hot_rankings ADD COLUMN review_count INT NOT NULL DEFAULT 0' },
    { table: 'hot_rankings', column: 'chapter_count', ddl: 'ALTER TABLE hot_rankings ADD COLUMN chapter_count INT NOT NULL DEFAULT 0' },
    { table: 'hot_rankings', column: 'word_count', ddl: 'ALTER TABLE hot_rankings ADD COLUMN word_count INT NOT NULL DEFAULT 0' },
    { table: 'hot_rankings', column: 'is_complete', ddl: 'ALTER TABLE hot_rankings ADD COLUMN is_complete TINYINT(1) NOT NULL DEFAULT 0' },
    { table: 'hot_rankings', column: 'extra', ddl: "ALTER TABLE hot_rankings ADD COLUMN extra VARCHAR(200) NOT NULL DEFAULT ''" },
    { table: 'books', column: 'category', ddl: "ALTER TABLE books ADD COLUMN category VARCHAR(128) DEFAULT ''" },
    { table: 'users', column: 'last_login_at', ddl: 'ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL' },
    { table: 'users', column: 'membership_type', ddl: "ALTER TABLE users ADD COLUMN membership_type VARCHAR(20) DEFAULT 'free'" },
    { table: 'users', column: 'membership_expire_at', ddl: 'ALTER TABLE users ADD COLUMN membership_expire_at DATETIME DEFAULT NULL' },
    { table: 'users', column: 'membership_start_at', ddl: 'ALTER TABLE users ADD COLUMN membership_start_at DATETIME DEFAULT NULL' },
    { table: 'users', column: 'member_badge', ddl: "ALTER TABLE users ADD COLUMN member_badge VARCHAR(50) DEFAULT ''" },
  ];

  for (const { table, column, ddl } of missingColumns) {
    try {
      const [colRows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if ((colRows as any[])[0]?.cnt === 0) {
        await db.query(ddl);
        console.log(`[DB] 自动修复: 为 ${table} 表添加 ${column} 列`);
      }
    } catch (e: any) {
      console.log(`[DB] 自动修复 ${table}.${column} 失败: ${e.message}`);
    }
  }

  // 自动修复：为已存在的表添加缺失的索引
  try {
    const [idxRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hot_rankings' AND INDEX_NAME = 'idx_ranking_type_category'`
    );
    if ((idxRows as any[])[0]?.cnt === 0) {
      await db.query('ALTER TABLE hot_rankings ADD INDEX idx_ranking_type_category (rank_type, category, sort_order)');
      console.log('[DB] 自动修复: 为 hot_rankings 表添加 idx_ranking_type_category 索引');
    }
  } catch (e: any) {
    console.log(`[DB] 自动修复索引失败: ${e.message}`);
  }

  console.log('[DB] MySQL 数据库表初始化完成');
}
