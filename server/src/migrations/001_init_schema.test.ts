import assert from 'node:assert/strict';
import { test } from 'node:test';
import { up } from './001_init_schema';

test('001 初始化迁移中的 MySQL 敏感字段需要加反引号以兼容 MySQL 5.7', async () => {
  const capturedSql: string[] = [];
  const db = {
    query: async (sql: string) => {
      capturedSql.push(sql);
      return [];
    },
  };

  await up(db as any);

  const joinedSql = capturedSql.join(';\n');
  assert.match(joinedSql, /`group`\s+VARCHAR\(200\)/);
  assert.match(joinedSql, /`pattern`\s+VARCHAR\(500\)/);
  assert.doesNotMatch(joinedSql, /[\s,]pattern\s+VARCHAR\(500\)/);
});
