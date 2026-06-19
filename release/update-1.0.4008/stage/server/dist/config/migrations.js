"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const initSchema = __importStar(require("../migrations/001_init_schema"));
const userPermissions = __importStar(require("../migrations/002_user_permissions"));
const advertisements = __importStar(require("../migrations/003_advertisements"));
const adPopupSettings = __importStar(require("../migrations/004_ad_popup_settings"));
const sourceValidation = __importStar(require("../migrations/005_source_validation"));
const rankingExtensions = __importStar(require("../migrations/006_ranking_extensions"));
const searchPerfIndexes = __importStar(require("../migrations/007_search_performance_indexes"));
const bookCategoryColumn = __importStar(require("../migrations/008_book_category_column"));
const passwordResetTokens = __importStar(require("../migrations/009_password_reset_tokens"));
const emailConfigDefaults = __importStar(require("../migrations/010_email_config_defaults"));
const hotRankingsDisplayColumns = __importStar(require("../migrations/011_hot_rankings_display_columns"));
const contentCleanerEnglishNoise = __importStar(require("../migrations/012_content_cleaner_english_noise"));
const contentCleanerScriptNoise = __importStar(require("../migrations/013_content_cleaner_script_noise"));
const readingSettings = __importStar(require("../migrations/014_reading_settings"));
const seoConfigTemplates = __importStar(require("../migrations/015_seo_config_templates"));
const pageChannels = __importStar(require("../migrations/016_page_channels"));
const searchSwitchSettings = __importStar(require("../migrations/017_search_switch_settings"));
const contentPagesFriendlyLinks = __importStar(require("../migrations/018_content_pages_friendly_links"));
const userActivityRecords = __importStar(require("../migrations/019_user_activity_records"));
const rssSources = __importStar(require("../migrations/020_rss_sources"));
const clearRssSources = __importStar(require("../migrations/021_clear_rss_sources"));
const searchConcurrencyDefault20 = __importStar(require("../migrations/022_search_concurrency_default_20"));
const userLastLoginAt = __importStar(require("../migrations/023_user_last_login_at"));
const sourceValidationSchedule = __importStar(require("../migrations/024_source_validation_schedule"));
const pluginsCollector = __importStar(require("../migrations/025_plugins_collector"));
const migrations = [
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
];
async function runMigrations(db) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    const [rows] = await db.query('SELECT name FROM schema_migrations');
    const executed = new Set(rows.map(row => row.name));
    for (const migration of migrations) {
        if (executed.has(migration.name))
            continue;
        await migration.up(db);
        await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
        console.log(`[DB] migration applied: ${migration.name}`);
    }
}
//# sourceMappingURL=migrations.js.map