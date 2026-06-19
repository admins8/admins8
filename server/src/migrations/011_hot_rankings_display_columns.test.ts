import assert from 'node:assert/strict';
import { test } from 'node:test';
import { up } from './011_hot_rankings_display_columns';

test('011 迁移会补齐首页排行榜展示字段', async () => {
  const executedSql: string[] = [];
  const existingColumns = new Set<string>();

  const db = {
    query: async (sql: string, params?: any[]) => {
      executedSql.push(sql);
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        const column = params?.[0];
        return [[{ cnt: existingColumns.has(column) ? 1 : 0 }]];
      }
      return [[]];
    },
  };

  await up(db as any);

  assert.ok(executedSql.some(sql => sql.includes('ADD COLUMN intro TEXT')));
  assert.ok(executedSql.some(sql => sql.includes('ADD COLUMN cover_url VARCHAR(500)')));
});
