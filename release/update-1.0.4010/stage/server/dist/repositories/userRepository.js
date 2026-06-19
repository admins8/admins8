"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByUsernameOrEmail = findUserByUsernameOrEmail;
exports.findUserIdByUsernameOrEmail = findUserIdByUsernameOrEmail;
exports.findUserByEmail = findUserByEmail;
exports.findPublicUserById = findPublicUserById;
exports.createUser = createUser;
exports.updateUserProfileRow = updateUserProfileRow;
exports.updateUserLastLoginAt = updateUserLastLoginAt;
exports.findOtherUserByEmail = findOtherUserByEmail;
exports.getPasswordHash = getPasswordHash;
exports.updatePassword = updatePassword;
exports.createPasswordResetToken = createPasswordResetToken;
exports.resetPasswordWithToken = resetPasswordWithToken;
exports.countUserBooks = countUserBooks;
const database_1 = require("../config/database");
const userLoginAudit_1 = require("../services/userLoginAudit");
async function findUserByUsernameOrEmail(usernameOrEmail) {
    return (0, database_1.queryOne)('SELECT * FROM users WHERE username = ? OR email = ?', [usernameOrEmail, usernameOrEmail]);
}
async function findUserIdByUsernameOrEmail(username, email) {
    return (0, database_1.queryOne)('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
}
async function findUserByEmail(email) {
    return (0, database_1.queryOne)('SELECT id, username, email FROM users WHERE email = ?', [email]);
}
async function findPublicUserById(id) {
    return (0, database_1.queryOne)('SELECT id, username, email, role, avatar_url, created_at AS createdAt FROM users WHERE id = ?', [id]);
}
async function createUser(username, email, passwordHash) {
    const result = await (0, database_1.execute)('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
    return result.insertId;
}
async function updateUserProfileRow(userId, email, avatarUrl) {
    await (0, database_1.execute)('UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?', [email ?? null, avatarUrl ?? null, userId]);
}
async function updateUserLastLoginAt(userId) {
    await (0, database_1.execute)(userLoginAudit_1.UPDATE_LAST_LOGIN_SQL, [userId]);
}
async function findOtherUserByEmail(email, userId) {
    return (0, database_1.queryOne)('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
}
async function getPasswordHash(userId) {
    return (0, database_1.queryOne)('SELECT password_hash FROM users WHERE id = ?', [userId]);
}
async function updatePassword(userId, passwordHash) {
    await (0, database_1.execute)('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, userId]);
}
async function createPasswordResetToken(userId, email, token, expiresAt) {
    await (0, database_1.execute)('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
    await (0, database_1.execute)('INSERT INTO password_reset_tokens (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)', [userId, email, token, expiresAt]);
}
async function resetPasswordWithToken(email, token, passwordHash) {
    return (0, database_1.transaction)(async (conn) => {
        const [rows] = await conn.query(`SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE email = ? AND token = ?
       ORDER BY created_at DESC
       LIMIT 1`, [email, token]);
        const record = rows[0];
        if (!record)
            return 'not_found';
        if (record.used_at)
            return 'used';
        if (new Date(record.expires_at).getTime() < Date.now())
            return 'expired';
        await conn.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, record.user_id]);
        await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ?', [record.user_id]);
        return 'ok';
    });
}
async function countUserBooks(userId) {
    const row = await (0, database_1.queryOne)('SELECT COUNT(*) as count FROM user_books WHERE user_id = ?', [userId]);
    return row?.count || 0;
}
//# sourceMappingURL=userRepository.js.map