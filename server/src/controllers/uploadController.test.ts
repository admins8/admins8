import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedImageMimeType } from './uploadController';

test('上传图片白名单拒绝 SVG 主动内容', () => {
  assert.equal(isAllowedImageMimeType('image/png'), true);
  assert.equal(isAllowedImageMimeType('image/jpeg'), true);
  assert.equal(isAllowedImageMimeType('image/svg+xml'), false);
});
