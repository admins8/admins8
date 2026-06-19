export declare const UPDATE_LAST_LOGIN_SQL = "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?";
export declare function buildAdminUserSelectSql(whereSql: string): string;
//# sourceMappingURL=userLoginAudit.d.ts.map