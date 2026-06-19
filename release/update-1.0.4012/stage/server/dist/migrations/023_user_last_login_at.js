"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.up = up;
exports.name = '023_user_last_login_at';
async function ensureColumn(db, tableName, colName, ddl) {
    const [rows] = await db.query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1', [tableName, colName]);
    if (rows.length > 0)
        return;
    await db.query(ddl);
}
async function up(db) {
    await ensureColumn(db, 'users', 'last_login_at', 'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL AFTER created_at');
}
//# sourceMappingURL=023_user_last_login_at.js.map