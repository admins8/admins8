import type mysql from 'mysql2/promise';

export const name = '017_search_switch_settings';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(
    `INSERT IGNORE INTO site_config (config_key, config_value, description) VALUES
      ('search_verify_toc', 'false', '搜索阶段是否强制验证目录'),
      ('search_source_concurrency', '20', '单次搜索书源并发数'),
      ('search_source_timeout_ms', '5000', '搜索书源请求超时时间毫秒'),
      ('search_toc_timeout_ms', '3000', '搜索目录验证超时时间毫秒'),
      ('source_switch_concurrency', '20', '单次换源书源并发数'),
      ('source_switch_timeout_ms', '5000', '换源搜索请求超时时间毫秒'),
      ('source_switch_toc_timeout_ms', '3000', '换源目录验证超时时间毫秒'),
      ('alternate_source_cache_ttl_seconds', '3600', '换源结果 Redis 缓存秒数')`
  );
}
