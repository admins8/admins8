import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserRecordPagination, getUserRecordConfig, USER_RECORD_TYPES } from './userRecordService'

test('USER_RECORD_TYPES includes all admin user record menus', () => {
  assert.deepEqual(USER_RECORD_TYPES, [
    'reading',
    'searches',
    'comments',
    'likes',
    'favorites',
    'checkins',
  ])
})

test('getUserRecordConfig returns table metadata for search records', () => {
  const config = getUserRecordConfig('searches')

  assert.equal(config.title, '搜索记录')
  assert.equal(config.table, 'user_search_records')
  assert.equal(config.timeColumn, 'created_at')
})

test('buildUserRecordPagination clamps page and size', () => {
  assert.deepEqual(buildUserRecordPagination({ page: '-3', size: '999' }), {
    page: 1,
    size: 100,
    offset: 0,
  })
  assert.deepEqual(buildUserRecordPagination({ page: '3', size: '20' }), {
    page: 3,
    size: 20,
    offset: 40,
  })
})
