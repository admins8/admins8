import test from 'node:test';
import assert from 'node:assert/strict';
import { getErrorMessageForClient } from './apiResponse';

test('开发环境返回内部错误详情', () => {
  const err = new Error('SQL connection refused at 127.0.0.1');

  assert.equal(
    getErrorMessageForClient(err, '搜索失败', 'development'),
    'SQL connection refused at 127.0.0.1'
  );
});

test('生产环境返回 fallback 提示', () => {
  const err = new Error('SQL connection refused at 127.0.0.1');

  assert.equal(getErrorMessageForClient(err, '搜索失败', 'production'), '搜索失败');
});

test('生产环境没有 fallback 时返回通用错误', () => {
  const err = new Error('private stack detail');

  assert.equal(getErrorMessageForClient(err, undefined, 'production'), '服务器内部错误');
});
