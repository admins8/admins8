import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceUpdateParams } from './sourceUpdatePayload';

test('buildSourceUpdateParams converts omitted fields to null when only toggling enabled', () => {
  const params = buildSourceUpdateParams({ enabled: false }, 5);

  assert.equal(params.length, 16);
  assert.equal(params[3], 0);
  assert.equal(params[15], 5);
  assert.equal(params.some((value) => value === undefined), false);
});

test('buildSourceUpdateParams serializes rule objects', () => {
  const params = buildSourceUpdateParams({ ruleSearch: { bookList: '.item' } }, 9);

  assert.equal(params[11], JSON.stringify({ bookList: '.item' }));
  assert.equal(params[15], 9);
});
