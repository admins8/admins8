import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAllowUnverifiedSwitchCandidate } from './sourceSwitchController';

test('换源允许准确书名作者命中的远程书源先展示为未校验', () => {
  const currentBook = { name: '青山', author: '会说话的肘子' };
  const candidate = {
    name: '青山',
    author: '会说话的肘子',
    bookUrl: 'https://chuangshi.qq.com/detail/43014772',
  };

  assert.equal(shouldAllowUnverifiedSwitchCandidate(candidate as any, currentBook), true);
});

test('换源不会放行同名但作者不同的未校验远程书源', () => {
  const currentBook = { name: '青山', author: '会说话的肘子' };
  const candidate = {
    name: '青山',
    author: '青山绿水',
    bookUrl: 'https://example.com/book/1',
  };

  assert.equal(shouldAllowUnverifiedSwitchCandidate(candidate as any, currentBook), false);
});
