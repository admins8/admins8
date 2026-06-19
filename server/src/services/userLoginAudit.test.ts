import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminUserSelectSql, UPDATE_LAST_LOGIN_SQL } from './userLoginAudit';

test('buildAdminUserSelectSql includes last login time after register time fields', () => {
  const sql = buildAdminUserSelectSql('WHERE 1=1');

  assert.match(sql, /created_at,\s*last_login_at,\s*updated_at/);
  assert.match(sql, /FROM users WHERE 1=1/);
  assert.match(sql, /ORDER BY created_at DESC LIMIT \? OFFSET \?/);
});

test('UPDATE_LAST_LOGIN_SQL updates last_login_at and updated_at', () => {
  assert.equal(
    UPDATE_LAST_LOGIN_SQL,
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?'
  );
});
