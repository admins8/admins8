import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPublicSiteConfigs, isPublicSiteConfigKey } from './publicSiteConfig';
import { injectSeoIntoHtml } from './seoHtmlService';

test('公开站点配置不会返回邮箱、密码、token、secret 等敏感项', () => {
  const filtered = filterPublicSiteConfigs([
    { config_key: 'site_title', config_value: '搜猫阅读' },
    { config_key: 'smtp_username', config_value: 'mail@example.com' },
    { config_key: 'smtp_password', config_value: 'secret' },
    { config_key: 'pop3_host', config_value: 'pop.example.com' },
    { config_key: 'baidu_push_token', config_value: 'token' },
    { config_key: 'jwt_secret', config_value: 'jwt' },
    { config_key: 'home_description', config_value: '首页描述' },
  ]);

  const keys = filtered.map(item => item.config_key);
  assert.deepEqual(keys, ['site_title', 'home_description']);
  assert.equal(isPublicSiteConfigKey('smtp_password'), false);
  assert.equal(isPublicSiteConfigKey('home_title'), true);
});

test('HTML 源码注入的 site-config-json 只包含公开配置', () => {
  const html = '<html><head><title></title><meta name="keywords" content="" /><meta name="description" content="" /><script id="site-config-json" type="application/json">{}</script></head></html>';
  const output = injectSeoIntoHtml(html, {
    site_title: '搜猫阅读',
    home_title: '首页-{siteName}',
    smtp_username: 'mail@example.com',
    smtp_password: 'secret',
    pop3_host: 'pop.example.com',
    web_domain: 'https://soumal.com',
  }, {
    title: '首页-搜猫阅读',
    keywords: '',
    description: '',
    canonical: 'https://soumal.com/',
  });

  assert.match(output, /"site_title":"搜猫阅读"/);
  assert.match(output, /"home_title":"首页-{siteName}"/);
  assert.doesNotMatch(output, /smtp_username/);
  assert.doesNotMatch(output, /smtp_password/);
  assert.doesNotMatch(output, /pop3_host/);
  assert.doesNotMatch(output, /secret/);
});
