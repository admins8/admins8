import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_POPUP_AUTO_CLOSE_SECONDS,
  DEFAULT_POPUP_INTERVAL_SECONDS,
  normalizePopupSeconds,
} from './adDefaults';

test('阅读页弹窗广告默认间隔为 3600 秒', () => {
  assert.equal(DEFAULT_POPUP_INTERVAL_SECONDS, 3600);
});

test('弹窗广告自动关闭默认时间为 10 秒', () => {
  assert.equal(DEFAULT_POPUP_AUTO_CLOSE_SECONDS, 10);
});

test('非法弹窗时间配置会回退到默认值', () => {
  assert.equal(normalizePopupSeconds(undefined, DEFAULT_POPUP_INTERVAL_SECONDS), 3600);
  assert.equal(normalizePopupSeconds('', DEFAULT_POPUP_INTERVAL_SECONDS), 3600);
  assert.equal(normalizePopupSeconds(-1, DEFAULT_POPUP_INTERVAL_SECONDS), 3600);
  assert.equal(normalizePopupSeconds('abc', DEFAULT_POPUP_AUTO_CLOSE_SECONDS), 10);
});

test('合法弹窗时间配置会被转换为非负整数秒', () => {
  assert.equal(normalizePopupSeconds('60', DEFAULT_POPUP_INTERVAL_SECONDS), 60);
  assert.equal(normalizePopupSeconds(15.8, DEFAULT_POPUP_AUTO_CLOSE_SECONDS), 15);
  assert.equal(normalizePopupSeconds(0, DEFAULT_POPUP_AUTO_CLOSE_SECONDS), 0);
});
