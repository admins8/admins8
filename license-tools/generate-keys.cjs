#!/usr/bin/env node
/**
 * 生成 RSA-2048 密钥对（一次性）。
 *
 * 用法：
 *   node tools/generate-keys.cjs                  # 默认输出到 license-tools/keys/
 *   node tools/generate-keys.cjs ./mykeys         # 指定输出目录
 *
 * - private.pem：留在你（开发者）本地，绝不要发给客户；
 * - public.pem：跟随交付包一起发给客户，放置在 server 启动目录的 license/public.pem。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(process.cwd(), process.argv[2] || 'license-tools/keys');
fs.mkdirSync(outDir, { recursive: true });

const privatePath = path.join(outDir, 'private.pem');
const publicPath = path.join(outDir, 'public.pem');

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  console.error('[!] 输出目录已存在 private.pem 或 public.pem，请先备份后再运行。');
  console.error('    目录：', outDir);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicPath, publicKey);

console.log('✅ 已生成 RSA 密钥对：');
console.log('   私钥（留底，绝不外传）：', privatePath);
console.log('   公钥（随交付包发给客户）：', publicPath);
console.log('');
console.log('下一步：用 generate-license.cjs 签发 license.lic');
