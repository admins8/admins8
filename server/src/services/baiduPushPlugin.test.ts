import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBaiduPushEndpoint, normalizeBaiduPushConfig, pushUrlsToBaidu } from './baiduPushPlugin';

test('百度推送插件配置会清洗站点地址并隐藏 token', () => {
  const config = normalizeBaiduPushConfig({
    site: 'https://so.soumal.com/',
    token: 'abc123',
    dailyLimit: '20',
    enabled: true,
  });

  assert.equal(config.site, 'https://so.soumal.com');
  assert.equal(config.token, 'abc123');
  assert.equal(config.maskedToken, 'ab***23');
  assert.equal(config.dailyLimit, 20);
  assert.equal(config.enabled, true);
});

test('百度推送插件按官方接口提交 URL 列表并解析返回', async () => {
  const calls: any[] = [];
  const result = await pushUrlsToBaidu(
    { site: 'https://so.soumal.com', token: 'abc123', enabled: true },
    ['https://so.soumal.com/', 'https://so.soumal.com/book/1-test.html'],
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: 2, remain: 98 }),
      } as any;
    }
  );

  assert.equal(calls[0].url, buildBaiduPushEndpoint('https://so.soumal.com', 'abc123'));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'text/plain');
  assert.equal(calls[0].init.body, 'https://so.soumal.com/\nhttps://so.soumal.com/book/1-test.html');
  assert.deepEqual(result, { ok: true, status: 200, success: 2, remain: 98, error: '', raw: { success: 2, remain: 98 } });
});
