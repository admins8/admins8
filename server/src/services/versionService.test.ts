import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersion, isNewer } from './versionService';

test('compareVersion 数值序比较', () => {
  assert.equal(compareVersion('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersion('1.0.1', '1.0.0'), 1);
  assert.equal(compareVersion('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersion('1.2.0', '1.10.0'), -1);
  assert.equal(compareVersion('2.0.0', '1.99.99'), 1);
});

test('isNewer 仅当远端版本严格大于本地时返回 true', () => {
  assert.equal(isNewer('1.0.1', '1.0.0'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('1.0.0', '1.0.1'), false);
  assert.equal(isNewer('1.10.0', '1.2.0'), true);
});
