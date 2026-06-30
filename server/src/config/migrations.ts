import type mysql from 'mysql2/promise';
import * as initSchema from '../migrations/001_init_schema';
import * as userPermissions from '../migrations/002_user_permissions';
import * as advertisements from '../migrations/003_advertisements';
import * as adPopupSettings from '../migrations/004_ad_popup_settings';
import * as sourceValidation from '../migrations/005_source_validation';
import * as rankingExtensions from '../migrations/006_ranking_extensions';
import * as searchPerfIndexes from '../migrations/007_search_performance_indexes';
import * as bookCategoryColumn from '../migrations/008_book_category_column';
import * as passwordResetTokens from '../migrations/009_password_reset_tokens';
import * as emailConfigDefaults from '../migrations/010_email_config_defaults';
import * as hotRankingsDisplayColumns from '../migrations/011_hot_rankings_display_columns';
import * as contentCleanerEnglishNoise from '../migrations/012_content_cleaner_english_noise';
import * as contentCleanerScriptNoise from '../migrations/013_content_cleaner_script_noise';
import * as readingSettings from '../migrations/014_reading_settings';
import * as seoConfigTemplates from '../migrations/015_seo_config_templates';
import * as pageChannels from '../migrations/016_page_channels';
import * as searchSwitchSettings from '../migrations/017_search_switch_settings';
import * as contentPagesFriendlyLinks from '../migrations/018_content_pages_friendly_links';
import * as userActivityRecords from '../migrations/019_user_activity_records';
import * as rssSources from '../migrations/020_rss_sources';
import * as clearRssSources from '../migrations/021_clear_rss_sources';
import * as searchConcurrencyDefault20 from '../migrations/022_search_concurrency_default_20';
import * as userLastLoginAt from '../migrations/023_user_last_login_at';
import * as sourceValidationSchedule from '../migrations/024_source_validation_schedule';
import * as pluginsCollector from '../migrations/025_plugins_collector';
import * as baiduPushPlugin from '../migrations/026_baidu_push_plugin';
import * as appManagement from '../migrations/027_app_management';
import * as seedFemaleChannel from '../migrations/028_seed_female_channel';
import * as appBuildTasksAddRunId from '../migrations/029_app_build_tasks_add_run_id';
import * as authorFollows from '../migrations/030_author_follows';
import * as appConfigGitHubFields from '../migrations/031_app_config_github_fields';

interface Migration {
  name: string;
  up(db: mysql.Pool): Promise<void>;
}

const migrations: Migration[] = [
  initSchema,
  userPermissions,
  advertisements,
  adPopupSettings,
  sourceValidation,
  rankingExtensions,
  searchPerfIndexes,
  bookCategoryColumn,
  passwordResetTokens,
  emailConfigDefaults,
  hotRankingsDisplayColumns,
  contentCleanerEnglishNoise,
  contentCleanerScriptNoise,
  readingSettings,
  seoConfigTemplates,
  pageChannels,
  searchSwitchSettings,
  contentPagesFriendlyLinks,
  userActivityRecords,
  rssSources,
  clearRssSources,
  searchConcurrencyDefault20,
  userLastLoginAt,
  sourceValidationSchedule,
  pluginsCollector,
  baiduPushPlugin,
  appManagement,
  seedFemaleChannel,
  appBuildTasksAddRunId,
  authorFollows,
  appConfigGitHubFields,
];

export async function runMigrations(db: mysql.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [rows] = await db.query('SELECT name FROM schema_migrations');
  const executed = new Set((rows as Array<{ name: string }>).map(row => row.name));

  for (const migration of migrations) {
    if (executed.has(migration.name)) continue;
    await migration.up(db);
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
    console.log(`[DB] migration applied: ${migration.name}`);
  }
}
