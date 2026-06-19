export interface UserRow {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    avatar_url: string;
    role: string;
    is_active: number;
    created_at?: string;
    last_login_at?: string | null;
}
export interface PasswordResetTokenRow {
    id: number;
    user_id: number;
    expires_at: Date | string;
    used_at: Date | string | null;
}
export declare function findUserByUsernameOrEmail(usernameOrEmail: string): Promise<UserRow | null>;
export declare function findUserIdByUsernameOrEmail(username: string, email: string): Promise<{
    id: number;
} | null>;
export declare function findUserByEmail(email: string): Promise<Pick<UserRow, 'id' | 'username' | 'email'> | null>;
export declare function findPublicUserById(id: number): Promise<(Omit<UserRow, 'password_hash' | 'is_active' | 'created_at'> & {
    createdAt?: string;
}) | null>;
export declare function createUser(username: string, email: string, passwordHash: string): Promise<number>;
export declare function updateUserProfileRow(userId: number, email?: string, avatarUrl?: string): Promise<void>;
export declare function updateUserLastLoginAt(userId: number): Promise<void>;
export declare function findOtherUserByEmail(email: string, userId: number): Promise<{
    id: number;
} | null>;
export declare function getPasswordHash(userId: number): Promise<{
    password_hash: string;
} | null>;
export declare function updatePassword(userId: number, passwordHash: string): Promise<void>;
export declare function createPasswordResetToken(userId: number, email: string, token: string, expiresAt: Date): Promise<void>;
export declare function resetPasswordWithToken(email: string, token: string, passwordHash: string): Promise<'not_found' | 'used' | 'expired' | 'ok'>;
export declare function countUserBooks(userId: number): Promise<number>;
//# sourceMappingURL=userRepository.d.ts.map