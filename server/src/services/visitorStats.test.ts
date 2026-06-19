import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisitorFingerprint, shouldTrackVisit } from './visitorStats';

test('访客指纹优先使用真实客户端 IP 和 user-agent', () => {
  const req: any = {
    headers: {
      'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      'user-agent': 'Mozilla/5.0',
    },
    ip: '127.0.0.1',
  };

  const fingerprint = getVisitorFingerprint(req);

  assert.equal(fingerprint, '1.2.3.4|Mozilla/5.0');
});

test('只统计普通页面和非管理 API，忽略静态资源、健康检查和后台接口', () => {
  assert.equal(shouldTrackVisit({ method: 'GET', path: '/' } as any), true);
  assert.equal(shouldTrackVisit({ method: 'GET', path: '/api/book/search' } as any), true);
  assert.equal(shouldTrackVisit({ method: 'GET', path: '/api/admin/stats' } as any), false);
  assert.equal(shouldTrackVisit({ method: 'GET', path: '/api/health' } as any), false);
  assert.equal(shouldTrackVisit({ method: 'GET', path: '/assets/index.js' } as any), false);
  assert.equal(shouldTrackVisit({ method: 'POST', path: '/api/book/search' } as any), false);
});
