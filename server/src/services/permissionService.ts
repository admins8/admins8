import type mysql from 'mysql2/promise';
import { query, transaction } from '../config/database';

export const PERMISSIONS = {
  SITE_CONFIG: 'site_config',           // 网站配置
  CONTENT_MANAGE: 'content_manage',     // 内容管理
  BOOK_MANAGE: 'book_manage',           // 书籍管理
  SOURCE_MANAGE: 'source_manage',       // 书源管理
  PLUGIN_MANAGE: 'plugin_manage',       // 插件管理
  USER_MANAGE: 'user_manage',           // 用户管理
  SYSTEM_UPGRADE: 'system_upgrade',     // 系统升级
  APP_MANAGE: 'app_manage',             // APP管理
  MEMBER_MANAGE: 'member_manage',       // 会员管理
  PAYMENT_MANAGE: 'payment_manage',     // 交易管理
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// 所有权限列表
const ALL_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SITE_CONFIG,
  PERMISSIONS.CONTENT_MANAGE,
  PERMISSIONS.BOOK_MANAGE,
  PERMISSIONS.SOURCE_MANAGE,
  PERMISSIONS.PLUGIN_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.SYSTEM_UPGRADE,
  PERMISSIONS.APP_MANAGE,
  PERMISSIONS.MEMBER_MANAGE,
  PERMISSIONS.PAYMENT_MANAGE,
];

// 权限中文标签
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.SITE_CONFIG]: '网站配置',
  [PERMISSIONS.CONTENT_MANAGE]: '内容管理',
  [PERMISSIONS.BOOK_MANAGE]: '书籍管理',
  [PERMISSIONS.SOURCE_MANAGE]: '书源管理',
  [PERMISSIONS.PLUGIN_MANAGE]: '插件管理',
  [PERMISSIONS.USER_MANAGE]: '用户管理',
  [PERMISSIONS.SYSTEM_UPGRADE]: '系统升级',
  [PERMISSIONS.APP_MANAGE]: 'APP管理',
  [PERMISSIONS.MEMBER_MANAGE]: '会员管理',
  [PERMISSIONS.PAYMENT_MANAGE]: '交易管理',
};

export function normalizePermissions(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ALL_PERMISSIONS);
  return Array.from(new Set(input.filter((item): item is PermissionKey => {
    return typeof item === 'string' && allowed.has(item);
  })));
}

export function roleHasPermission(role: string | undefined, permission: PermissionKey): boolean {
  if (role === 'superadmin') return ALL_PERMISSIONS.includes(permission);
  return false;
}

export async function getUserPermissions(userId: number, role?: string): Promise<PermissionKey[]> {
  if (role === 'superadmin' || role === 'test') {
    return [...ALL_PERMISSIONS];
  }

  const rows = await query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [userId]);
  return normalizePermissions(rows.map((row: any) => row.permission_key));
}

export async function getUserPermissionMap(userIds: number[]): Promise<Map<number, PermissionKey[]>> {
  const permissionMap = new Map<number, PermissionKey[]>();
  if (userIds.length === 0) return permissionMap;

  const placeholders = userIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT user_id, permission_key FROM user_permissions WHERE user_id IN (${placeholders})`,
    userIds
  );

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

export async function setUserPermissions(userId: number, permissions: PermissionKey[]): Promise<void> {
  const normalized = normalizePermissions(permissions);
  await transaction(async (conn: mysql.PoolConnection) => {
    await conn.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
    for (const permission of normalized) {
      await conn.execute(
        'INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)',
        [userId, permission]
      );
    }
  });
}
