"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '023_reference_thread_count_concurrency';
async function up(db) {
    await db.query(`
    UPDATE site_config
    SET config_value = '16'
    WHERE config_key IN ('search_source_concurrency', 'source_switch_concurrency')
      AND config_value IN ('20', '10')
  `);
}
//# sourceMappingURL=023_reference_thread_count_concurrency.js.map