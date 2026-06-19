import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretValidationResult,
  type ValidationOutcome,
} from './sourceValidator';

test('搜索有结果，视为有效', () => {
  const result: ValidationOutcome = interpretValidationResult({
    results: [{
      name: 'a',
      author: 'a',
      bookUrl: 'http://x',
      coverUrl: '',
      intro: '',
      kind: '',
      latestChapterTitle: '',
      wordCount: '',
      origin: '',
      originName: '',
      type: 0,
    }],
    respondTime: 1234,
  });
  assert.equal(result.ok, true);
  assert.equal(result.sampleCount, 1);
  assert.equal(result.respondTime, 1234);
  assert.match(result.message, /1/);
});

test('搜索结果为空，视为失效', () => {
  const result = interpretValidationResult({
    results: [],
    respondTime: 800,
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, '搜索结果为空');
});

test('搜索抛出超时错误', () => {
  const result = interpretValidationResult({
    error: new Error('timeout of 15000ms exceeded'),
    respondTime: 15001,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /超时/);
});

test('搜索抛出 HTTP 错误', () => {
  const err: any = new Error('Request failed with status code 404');
  err.response = { status: 404 };
  const result = interpretValidationResult({
    error: err,
    respondTime: 300,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /404/);
});

test('搜索抛出网络错误', () => {
  const err: any = new Error('connect ECONNREFUSED');
  err.code = 'ECONNREFUSED';
  const result = interpretValidationResult({
    error: err,
    respondTime: 100,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /网络错误/);
});
