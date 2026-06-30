import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeaders, buildRequestHeaders, buildRetryHeaderProfiles } from './bookSourceHttpClient';

test('buildHeaders accepts JSON source headers', () => {
  const headers = buildHeaders('{"User-Agent":"okhttp/4.9.2","Authorization":"Bearer token"}');

  assert.equal(headers['User-Agent'], 'okhttp/4.9.2');
  assert.equal(headers.Authorization, 'Bearer token');
});

test('buildRequestHeaders adds browser-like defaults and request referer', () => {
  const headers = buildRequestHeaders('https://example.com/search?q=book', buildHeaders(null));

  assert.equal(headers.Referer, 'https://example.com/');
  assert.ok(headers.Accept.includes('text/html'));
  assert.ok(headers['Accept-Language'].includes('zh-CN'));
});

test('buildRequestHeaders replaces baseUrl placeholder in source headers', () => {
  const headers = buildRequestHeaders(
    'https://example.com/book/1',
    buildHeaders('{"Referer":"{{baseUrl}}","Origin":"{{origin}}"}')
  );

  assert.equal(headers.Referer, 'https://example.com/');
  assert.equal(headers.Origin, 'https://example.com');
});

test('buildRetryHeaderProfiles changes user agent while preserving custom cookie', () => {
  const profiles = buildRetryHeaderProfiles(
    'https://example.com/book/1',
    buildHeaders('{"Cookie":"sid=1","User-Agent":"custom-UA"}')
  );

  assert.ok(profiles.length >= 3);
  assert.equal(profiles[0].headers.Cookie, 'sid=1');
  assert.equal(profiles[1].headers.Cookie, 'sid=1');
  assert.notEqual(profiles[1].headers['User-Agent'], profiles[0].headers['User-Agent']);
});

test('buildRetryHeaderProfiles includes a simple collector profile without referer or origin', () => {
  const profiles = buildRetryHeaderProfiles(
    'https://www.kanxiaoshuo123.com/654752/',
    buildHeaders('{"Cookie":"sid=1","User-Agent":"custom-UA","Referer":"https://blocked.example/","Origin":"https://blocked.example"}')
  );

  const simpleProfile = profiles.find(profile => profile.name === '简洁采集请求头');

  assert.ok(simpleProfile, '应包含简洁采集请求头画像');
  assert.equal(simpleProfile.headers.Cookie, 'sid=1');
  assert.equal(simpleProfile.headers['User-Agent'], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  assert.equal(simpleProfile.headers.Accept, 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
  assert.equal(simpleProfile.headers['Accept-Language'], 'zh-CN,zh;q=0.9');
  assert.equal(simpleProfile.headers.DNT, '1');
  assert.equal('Referer' in simpleProfile.headers, false);
  assert.equal('Origin' in simpleProfile.headers, false);
});
