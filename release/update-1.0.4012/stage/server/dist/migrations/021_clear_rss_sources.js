"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '021_clear_rss_sources';
async function up(db) {
    await db.query('DELETE FROM rss_sources');
}
//# sourceMappingURL=021_clear_rss_sources.js.map