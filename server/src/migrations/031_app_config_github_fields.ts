import type mysql from 'mysql2/promise';

export const name = '031_app_config_github_fields';

export async function up(db: mysql.Pool): Promise<void> {
  const columnsToAdd = [
    { name: 'github_token', ddl: 'ADD COLUMN github_token VARCHAR(255) NULL AFTER splash_path' },
    { name: 'github_owner', ddl: 'ADD COLUMN github_owner VARCHAR(100) NULL AFTER github_token' },
    { name: 'github_repo', ddl: 'ADD COLUMN github_repo VARCHAR(100) NULL AFTER github_owner' },
    { name: 'github_workflow', ddl: 'ADD COLUMN github_workflow VARCHAR(100) NULL DEFAULT "build-android.yml" AFTER github_repo' },
    { name: 'github_branch', ddl: 'ADD COLUMN github_branch VARCHAR(100) NULL DEFAULT "main" AFTER github_workflow' },
    { name: 'build_callback_secret', ddl: 'ADD COLUMN build_callback_secret VARCHAR(255) NULL AFTER github_branch' },
  ];

  for (const col of columnsToAdd) {
    const [exists] = await db.query(`SHOW COLUMNS FROM app_config LIKE ?`, [col.name]) as any;
    if (exists.length === 0) {
      await db.query(`ALTER TABLE app_config ${col.ddl}`);
      console.log(`[Migration 031] 已添加 ${col.name} 字段到 app_config 表`);
    } else {
      console.log(`[Migration 031] ${col.name} 字段已存在，跳过`);
    }
  }
}
