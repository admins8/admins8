import type mysql from 'mysql2/promise';

export const name = '027_app_management';

export async function up(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      app_name VARCHAR(100) NOT NULL DEFAULT '搜猫阅读',
      app_package VARCHAR(100) NOT NULL DEFAULT 'com.soumal.reader',
      api_base_url VARCHAR(255) NOT NULL DEFAULT 'https://soumal.com',
      theme_color VARCHAR(20) DEFAULT '#409EFF',
      about_content TEXT,
      privacy_policy_url VARCHAR(255),
      user_agreement_url VARCHAR(255),
      icon_path VARCHAR(255),
      splash_path VARCHAR(255),
      github_token VARCHAR(255),
      github_owner VARCHAR(100),
      github_repo VARCHAR(100),
      github_workflow VARCHAR(100) DEFAULT 'build-android.yml',
      github_branch VARCHAR(100) DEFAULT 'main',
      build_callback_secret VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    INSERT INTO app_config (app_name, app_package, api_base_url) VALUES ('搜猫阅读', 'com.soumal.reader', 'https://soumal.com');
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_versions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      platform ENUM('android', 'harmony') NOT NULL DEFAULT 'android',
      version_name VARCHAR(20) NOT NULL,
      version_code INT UNSIGNED NOT NULL,
      changelog TEXT,
      download_url VARCHAR(255),
      force_update TINYINT(1) DEFAULT 0,
      is_published TINYINT(1) DEFAULT 0,
      file_size BIGINT UNSIGNED DEFAULT 0,
      build_task_id INT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_app_versions_platform (platform),
      INDEX idx_app_versions_version_code (version_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_build_tasks (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      platform ENUM('android', 'harmony') NOT NULL DEFAULT 'android',
      version_name VARCHAR(20) NOT NULL,
      version_code INT UNSIGNED NOT NULL,
      status ENUM('pending', 'building', 'success', 'failed') NOT NULL DEFAULT 'pending',
      build_log TEXT,
      output_path VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      INDEX idx_app_build_tasks_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
