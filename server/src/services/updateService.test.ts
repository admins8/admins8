import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { verifyFileSignature, readPackageVersion, formatUpdateCheckError, checkUpdate } from './updateService';

function tmpDir(prefix = 'legado-update-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('verifyFileSignature 通过 RSA-SHA256 校验签名', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'a.zip');
  const data = Buffer.from('hello legado update');
  fs.writeFileSync(file, data);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64');
  const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  assert.equal(verifyFileSignature(file, sig, pem), true);

  // 篡改文件 → 应失败
  fs.writeFileSync(file, Buffer.from('tampered'));
  assert.equal(verifyFileSignature(file, sig, pem), false);
});

test('verifyFileSignature 错误签名返回 false（不抛错）', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'b.zip');
  fs.writeFileSync(file, Buffer.from('payload'));
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  // 任意非法 base64 签名
  assert.equal(verifyFileSignature(file, Buffer.from('not-a-real-sig').toString('base64'), pem), false);
});

test('readPackageVersion 优先读取 version.txt，其次 VERSION', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'version.txt'), '1.2.3\n');
  assert.equal(readPackageVersion(dir), '1.2.3');

  const dir2 = tmpDir();
  fs.writeFileSync(path.join(dir2, 'VERSION'), '0.9.0');
  assert.equal(readPackageVersion(dir2), '0.9.0');

  const dir3 = tmpDir();
  assert.equal(readPackageVersion(dir3), '');
});

test('formatUpdateCheckError 将 AggregateError 转换为可读提示', () => {
  assert.equal(
    formatUpdateCheckError(new AggregateError([new Error('connect ETIMEDOUT')], 'AggregateError')),
    '无法访问更新清单，请检查服务器网络或 UPDATE_MANIFEST_URL 配置'
  );
});

test('checkUpdate 在远程清单不可达时兜底为当前版本且不返回网络错误提示', async () => {
  const result = await checkUpdate('http://127.0.0.1:9/manifest.json');

  assert.equal(result.hasUpdate, false);
  assert.equal(result.latest, result.current);
  assert.equal(result.reason, undefined);
});
