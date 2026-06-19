import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSiteConfigPayloads } from './siteConfigPayload';

const analyticsCode = '<script> var _mtj = _mtj || []; (function () { var mtj = document.createElement("script"); mtj.src = "`https://node94.aizhantj.com:21233/tjjs/?k=cbhforkfb7o`"; var s = document.getElementsByTagName("script")[0]; s.parentNode.insertBefore(mtj, s); })(); </script>';

test('统计代码支持 base64 传输并在入库前还原原始 script', () => {
  const encoded = Buffer.from(analyticsCode, 'utf8').toString('base64');

  const result = normalizeSiteConfigPayloads([
    { config_key: 'analytics_code', config_value: `__BASE64__:${encoded}` },
  ]);

  assert.equal(result[0].config_value, analyticsCode);
});

test('非统计配置不会被 base64 前缀误解码', () => {
  const result = normalizeSiteConfigPayloads([
    { config_key: 'site_title', config_value: '__BASE64__:5pCc54yr6ZiF6K+7' },
  ]);

  assert.equal(result[0].config_value, '__BASE64__:5pCc54yr6ZiF6K+7');
});
