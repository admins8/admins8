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
