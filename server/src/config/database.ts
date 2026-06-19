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
      INDEX idx_book_chapters_bo