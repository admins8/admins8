import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  canonicalize,
  isDomainAllowed,
  verifyLicense,
  verifySignature,
  type LicenseFile,
  type LicensePayload,
} from './licenseService';

function makeKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function sign(payload: LicensePayload, privateKey: string): string {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(canonicalize(payload));
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'legado-license-'));
}

test('isDomainAllowed 精确匹配域名', () => {
  assert.equal(isDomainAllowed('soumal.com', ['soumal.com']), true);
  assert.equal(isDomainAllowed('SOUMAL.com', ['soumal.com']), true);
  assert.equal(isDomainAllowed('soumal.com:8080', ['soumal.com']), true);
});

test('isDomainAllowed 通配符匹配子域名但不匹配主域', () => {
  const domains = ['*.soumal.com'];
  assert.equal(isDomainAllowed('m.soumal.com', domains), true);
  assert.equal(isDomainAllowed('book.soumal.com', domains), true);
  assert.equal(isDomainAllowed('a.b.soumal.com', domains), true);
  assert.equal(isDomainAllowed('soumal.com', domains), false);
  assert.equal(isDomainAllowed('other.com', domains), false);
});

test('isDomainAllowed 不匹配空 host 或空 domain 列表', () => {
  assert.equal(isDomainAllowed('', ['soumal.com']), false);
  assert.equal(isDomainAllowed('soumal.com', []), false);
});

test('verifySignature 对合法签名返回 true', () => {
  const { publicKey, privateKey } = makeKeyPair();
  const payload: LicensePayload = {
    licenseId: 'LIC-2026-0001',
    customerId: 'customer-soumal',
    customerName: '搜麦阅读',
    domains: ['soumal.com', '*.soumal.com'],
    issuedAt: new Date().toISOString(),
  };
  const license: LicenseFile = { payload, signature: sign(payload, privateKey) };
  assert.equal(verifySignature(license, publicKey), true);
});

test('verifySignature 检测到 payload 被篡改时返回 false', () => {
  const { publicKey, privateKey } = makeKeyPair();
  const payload: LicensePayload = {
    licenseId: 'LIC-2026-0001',
    customerId: 'customer-soumal',
    domains: ['soumal.com'],
    issuedAt: new Date().toISOString(),
  };
  const license: LicenseFile = { payload, signature: sign(payload, privateKey) };
  // 篡改：增加新的授权域
  license.payload.domains.push('hacker.com');
  assert.equal(verifySignature(license, publicKey), false);
});

test('verifyLicense 读取有效文件并返回 payload', () => {
  const { publicKey, privateKey } = makeKeyPair();
  const dir = tmpDir();
  const payload: LicensePayload = {
    licenseId: 'LIC-2026-0001',
    customerId: 'customer-soumal',
    domains: ['soumal.com', '*.soumal.com'],
    issuedAt: new Date().toISOString(),
  };
  const file: LicenseFile = { payload, signature: sign(payload, privateKey) };
  fs.writeFileSync(path.join(dir, 'public.pem'), publicKey);
  fs.writeFileSync(path.join(dir, 'license.lic'), JSON.stringify(file, null, 2));

  const result = verifyLicense({
    licensePath: path.join(dir, 'license.lic'),
    publicKeyPath: path.join(dir, 'public.pem'),
  });
  assert.equal(result.valid, true);
  assert.equal(result.payload?.licenseId, 'LIC-2026-0001');
  assert.equal(result.payload?.customerId, 'customer-soumal');
});

test('verifyLicense 在文件缺失时返回失败原因', () => {
  const dir = tmpDir();
  const result = verifyLicense({
    licensePath: path.join(dir, 'missing.lic'),
    publicKeyPath: path.join(dir, 'missing.pem'),
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || '', /未找到授权文件/);
});

test('verifyLicense 在 domains 为空时返回失败', () => {
  const { publicKey, privateKey } = makeKeyPair();
  const dir = tmpDir();
  const payload: LicensePayload = {
    licenseId: 'LIC-2026-0001',
    customerId: 'customer-soumal',
    domains: [],
    issuedAt: new Date().toISOString(),
  };
  const file: LicenseFile = { payload, signature: sign(payload, privateKey) };
  fs.writeFileSync(path.join(dir, 'public.pem'), publicKey);
  fs.writeFileSync(path.join(dir, 'license.lic'), JSON.stringify(file));

  const result = verifyLicense({
    licensePath: path.join(dir, 'license.lic'),
    publicKeyPath: path.join(dir, 'public.pem'),
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || '', /domains/);
});
