"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = void 0;
exports.normalizePermissions = normalizePermissions;
exports.roleHasPermission = roleHasPermission;
exports.getUserPermissions = getUserPermissions;
exports.getUserPermissionMap = getUserPermissionMap;
exports.setUserPermissions = setUserPermissions;
const database_1 = require("../config/database");
exports.PERMISSIONS = {
    SOURCE_MANAGE: 'source_manage',
};
const ALL_PERMISSIONS = [
    exports.PERMISSIONS.SOURCE_MANAGE,
];
function normalizePermissions(input) {
    if (!Array.isArray(input))
        return [];
    const allowed = new Set(ALL_PERMISSIONS);
    return Array.from(new Set(input.filter((item) => {
        return typeof item === 'string' && allowed.has(item);
    })));
}
function roleHasPermission(role, permission) {
    if (role === 'superadmin' || role === 'admin')
        return ALL_PERMISSIONS.includes(permission);
    return false;
}
async function getUserPermissions(userId, role) {
    if (role === 'superadmin' || role === 'admin') {
        return [...ALL_PERMISSIONS];
    }
    const rows = await (0, database_1.query)('SELECT permission_key FROM user_permissions WHERE user_id = ?', [userId]);
    return normalizePermissions(rows.map((row) => row.permission_key));
}
async function getUserPermissionMap(userIds) {
    const permissionMap = new Map();
    if (userIds.length === 0)
        return permissionMap;
    const placeholders = userIds.map(() => '?').join(',');
    const rows = await (0, database_1.query)(`SELECT user_id, permission_key FROM user_permissions WHERE user_id IN (${placeholders})`, userIds);
    for (const row of rows) {
        const userId = Number(row.user_id);
        const current = permissionMap.get(userId) || [];
        const normalized = normalizePermissions([row.permission_key]);
        if (normalized.length > 0 && !current.includes(normalized[0])) {
            current.push(normalized[0]);
        }
        permissionMap.set(userId, current);
    }
    return permissionMap;
}
async function setUserPermissions(userId, permissions) {
    const normalized = normalizePermissions(permissions);
    await (0, database_1.transaction)(async (conn) => {
        await conn.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
        for (const permission of normalized) {
            await conn.execute('INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)', [userId, permission]);
        }
    });
}
//# sourceMappingURL=permissionService.js.map