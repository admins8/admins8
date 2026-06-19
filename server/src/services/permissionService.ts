import type mysql from 'mysql2/promise';
import { query, transaction } from '../config/database';

export const PERMISSIONS = {
  SOURCE_MANAGE: 'source_manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SOURCE_MANAGE,
];

export function normalizePermissions(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(ALL_PERMISSIONS);
  return Array.from(new Set(input.filter((item): item is PermissionKey => {
    return typeof item === 'string' && allowed.has(item);
  })));
}

export function roleHasPermission(role: string | undefined, permission: PermissionKey): boolean {
  if (role === 'superadmin' || role === 'admin') return ALL_PERMISSIONS.includes(permission);
  return false;
}

export async function getUserPermissions(userId: number, role?: string): Promise<PermissionKey[]> {
  if (role === 'superadmin' || role === 'admin') {
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
