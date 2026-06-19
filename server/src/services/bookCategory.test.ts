import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCategoryInput } from './bookCategory';

test('分类名称会去除首尾空格并保留排序和启用状态', () => {
  const result = normalizeCategoryInput({
    name: '  玄幻  ',
    sort_order: '3',
    is_active: false,
  });

  assert.deepEqual(result, {
    name: '玄幻',
    sortOrder: 3,
    isActive: false,
  });
});

test('空分类名称会抛出错误', () => {
  assert.throws(() => normalizeCategoryInput({ name: '   ' }), /分类名称不能为空/);
});

test('非法排序会回退为 0，启用状态默认开启', () => {
  const result = normalizeCategoryInput({
    name: '都市',
    sort_order: 'bad',
  });

  assert.deepEqual(result, {
    name: '都市',
    sortOrder: 0,
    isActive: true,
  });
});
