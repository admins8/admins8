import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseNodeVmFallback } from './safeScriptRunner';

test('生产环境即使显式开启也禁止 node:vm 后备执行', () => {
  assert.equal(
    canUseNodeVmFallback({
      nodeEnv: 'production',
      allowFallback: 'true',
    }),
    false
  );
});

test('开发环境默认禁止 node:vm 后备执行', () => {
  assert.equal(
    canUseNodeVmFallback({
      nodeEnv: 'development',
      allowFallback: undefined,
    }),
    false
  );
});

test('开发环境只有显式开启时允许 node:vm 后备执行', () => {
  assert.equal(
    canUseNodeVmFallback({
      nodeEnv: 'development',
      allowFallback: 'true',
    }),
    true
  );
});
