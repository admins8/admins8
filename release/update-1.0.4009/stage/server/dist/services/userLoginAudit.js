"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATE_LAST_LOGIN_SQL = void 0;
exports.buildAdminUserSelectSql = buildAdminUserSelectSql;
exports.UPDATE_LAST_LOGIN_SQL = 'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?';
function buildAdminUserSelectSql(whereSql) {
    return `SELECT id, username, email, role, is_active, created_at, last_login_at, updated_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
}
//# sourceMappingURL=userLoginAudit.js.map