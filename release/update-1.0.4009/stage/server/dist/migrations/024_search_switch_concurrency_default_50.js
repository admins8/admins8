"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '024_search_switch_concurrency_default_50';
async function up(db) {
    await db.query(`
    UPDATE site_config
    SET config_value = '50'
    WHERE config_key IN ('search_source_concurrency', 'source_switch_concurrency')
      AND config_value IN ('10', '16', '20', '24', '32')
  `);
}
//# sourceMappingURL=024_search_switch_concurrency_default_50.js.map