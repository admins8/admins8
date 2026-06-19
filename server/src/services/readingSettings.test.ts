import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canGuestReadChapter,
  canGuestUseSourceSwitch,
  parseBooleanConfig,
  parseGuestReadChapterLimit,
} from './readingSettings';

test('阅读设置布尔值解析支持 1/0 和 true/false', () => {
  assert.equal(parseBooleanConfig('1', false), true);
  assert.equal(parseBooleanConfig('0', true), false);
  assert.equal(parseBooleanConfig('true', false), true);
  assert.equal(parseBooleanConfig('false', true), false);
  assert.equal(parseBooleanConfig('bad', true), true);
});

test('未登录可读章节数支持 0、正数和 -1 不限', () => {
  assert.equal(parseGuestReadChapterLimit('0'), 0);
  assert.equal(parseGuestReadChapterLimit('3'), 3);
  assert.equal(parseGuestReadChapterLimit('-1'), -1);
  assert.equal(parseGuestReadChapterLimit('-2'), 3);
  assert.equal(parseGuestReadChapterLimit('bad'), 3);
});

test('未登录阅读限制按章节序号判断', () => {
  assert.equal(canGuestReadChapter(0, 3), true);
  assert.equal(canGuestReadChapter(2, 3), true);
  assert.equal(canGuestReadChapter(3, 3), false);
  assert.equal(canGuestReadChapter(0, 0), false);
  assert.equal(canGuestReadChapter(100, -1), true);
});

test('未登录换源权限跟随未登录阅读章节限制', () => {
  assert.equal(canGuestUseSourceSwitch(0, 5), true);
  assert.equal(canGuestUseSourceSwitch(4, 5), true);
  assert.equal(canGuestUseSourceSwitch(5, 5), false);
  assert.equal(canGuestUseSourceSwitch(0, 0), false);
  assert.equal(canGuestUseSourceSwitch(100, -1), true);
});
