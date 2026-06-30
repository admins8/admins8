import type mysql from 'mysql2/promise';

export const name = '029_app_build_tasks_add_run_id';

export async function up(db: mysql.Pool): Promise<void> {
  // 检查 run_id 列是否已存在
  const [columns] = await db.query('SHOW COLUMNS FROM app_build_tasks LIKE "run_id"') as any;
  if (columns.length === 0) {
    await db.query(`ALTER TABLE app_build_tasks ADD COLUMN run_id INT UNSIGNED NULL DEFAULT NULL AFTER output_path`);
    console.log('[Migration 029] 已添加 run_id 字段到 app_build_tasks 表');
  } else {
    console.log('[Migration 029] run_id 字段已存在，跳过');
  }
}
