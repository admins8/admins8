export declare const PERMISSIONS: {
    readonly SOURCE_MANAGE: "source_manage";
};
export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export declare function normalizePermissions(input: unknown): PermissionKey[];
export declare function roleHasPermission(role: string | undefined, permission: PermissionKey): boolean;
export declare function getUserPermissions(userId: number, role?: string): Promise<PermissionKey[]>;
export declare function getUserPermissionMap(userIds: number[]): Promise<Map<number, PermissionKey[]>>;
export declare function setUserPermissions(userId: number, permissions: PermissionKey[]): Promise<void>;
//# sourceMappingURL=permissionService.d.ts.map