import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalLibraryWhere, dedupeLocalLibraryBooks, normalizeLocalLibraryIdentityKey, normalizeLocalLibraryQuery } from './localLibrary';

test('本地书库查询参数会清理关键词并限制分页大小', () => {
  const query = normalizeLocalLibraryQuery({
    keyword: '  青山  ',
    page: '0',
    pageSize: '500',
  });

  assert.deepEqual(query, {
    keyword: '青山',
    category: '',
    page: 1,
    pageSize: 100,
    offset: 0,
  });
});

test('本地书库查询参数默认每页 10 本', () => {
  const query = normalizeLocalLibraryQuery({});

  assert.equal(query.keyword, '');
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 10);
  assert.equal(query.offset, 0);
});

test('本地书库查询参数支持分类筛选', () => {
  const query = normalizeLocalLibraryQuery({
    category: '  玄幻  ',
  });

  assert.equal(query.category, '玄幻');
});

test('本地书库全部分类不追加分类条件', () => {
  const result = buildLocalLibraryWhere('', '全部');

  assert.equal(result.where.includes('kind = ?'), false);
  assert.deepEqual(result.params, []);
});

test('本地书库分类筛选同时模糊匹配 kind 和 category', () => {
  const result = buildLocalLibraryWhere('', '玄幻');

  assert.match(result.where, /kind LIKE \? OR category LIKE \?/);
  assert.deepEqual(result.params, ['%玄幻%', '%玄幻%']);
});

test('本地书库去重键会忽略书名空格和作者前缀', () => {
  assert.equal(
    normalizeLocalLibraryIdentityKey({ name: ' 玄鉴 仙族 ', author: '作者：季越人' }),
    normalizeLocalLibraryIdentityKey({ name: '玄鉴仙族', author: '季越人' })
  );
});

test('本地书库同书名同作者优先保留采集本地记录', () => {
  const rows = dedupeLocalLibraryBooks([
    { id: 1, name: '青山', author: '会说话的肘子', totalChapterNum: 791, updatedAt: '2026-06-16 00:00:00', isCollectorLocal: 0 },
    { id: 2, name: '青山', author: '会说话的肘子', totalChapterNum: 13, updatedAt: '2026-06-10 00:00:00', isCollectorLocal: 1 },
    { id: 3, name: '元尊', author: '天蚕土豆', totalChapterNum: 100, updatedAt: '2026-06-11 00:00:00' },
  ]);

  assert.deepEqual(rows.map(row => row.id), [2, 3]);
});

test('本地书库非采集重复记录按章节数和更新时间保留更好的记录', () => {
  const rows = dedupeLocalLibraryBooks([
    { id: 1, name: '青山', author: '会说话的肘子', totalChapterNum: 13, updatedAt: '2026-06-10 00:00:00' },
    { id: 2, name: '青山', author: '会说话的肘子', totalChapterNum: 791, updatedAt: '2026-06-16 00:00:00' },
  ]);

  assert.deepEqual(rows.map(row => row.id), [2]);
});
