"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '022_search_concurrency_default_20';
async function up(db) {
    await db.query(`
    UPDATE site_config
    SET config_value = '20'
    WHERE config_key = 'search_source_concurrency'
      AND config_value = '10'
  `);
}
//# sourceMappingURL=022_search_concurrency_default_20.js.map