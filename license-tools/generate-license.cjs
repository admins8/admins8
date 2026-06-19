#!/usr/bin/env node
/**
 * 用私钥签发 license.lic（每个客户一份）。
 *
 * 用法（命令行参数）：
 *   node tools/generate-license.cjs \
 *     --private D:\secure\private.pem \
 *     --licenseId LIC-2026-0001 \
 *     --customerId customer-soumal \
 *     --customerName "搜麦阅读" \
 *     --domains "soumal.com,*.soumal.com" \
 *     --note "首批授权" \
 *     --out ./out/customer-soumal/license.lic
 *
 * 也支持：
 *   --features "vip=true,export=false"   (可选)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      args[key] = val;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const required = ['licenseId', 'customerId', 'domains', 'out'];
for (const k of required) {
  if (!args[k]) {
    console.error(`[!] 缺少参数 --${k}`);
    console.error('用法示例：');
    console.error('  $env:LICENSE_PRIVATE_KEY_PATH="D:\\secure\\private.pem"');
    console.error('  node generate-license.cjs \\');
    console.error('    --licenseId LIC-2026-0001 \\');
    console.error('    --customerId customer-soumal \\');
    console.error('    --customerName "搜麦阅读" \\');
    console.error('    --domains "soumal.com,*.soumal.com" \\');
    console.error('    --out ./out/customer-soumal/license.lic');
    process.exit(1);
  }
}

const privatePath = path.resolve(
  process.cwd(),
  args.private || process.env.LICENSE_PRIVATE_KEY_PATH || path.resolve(__dirname, '..', '.secrets', 'license', 'private.pem')
);
if (!fs.existsSync(privatePath)) {
  console.error('[!] 找不到私钥，请设置 LICENSE_PRIVATE_KEY_PATH 或使用 --private 指定：', privatePath);
  process.exit(1);
}

const domains = String(args.domains)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (domains.length === 0) {
  console.error('[!] domains 不能为空');
  process.exit(1);
}

let features;
if (args.features) {
  features = {};
  for (const pair of String(args.features).split(',')) {
    const [k, v] = pair.split('=').map(s => s.trim());
    if (k) features[k] = v === 'true';
  }
}

const payload = {
  licenseId: args.licenseId,
  customerId: args.customerId,
  customerName: args.customerName || '',
  domains,
  features,
  issuedAt: new Date().toISOString(),
  note: args.note || '',
};

// 与服务端 canonicalize 必须一致：按 key 排序 JSON.stringify
const canonical = JSON.stringify(payload, Object.keys(payload).sort());

const privateKey = fs.readFileSync(privatePath, 'utf-8');
const signer = crypto.createSign('RSA-SHA256');
signer.update(canonical);
signer.end();
const signature = signer.sign(privateKey, 'base64');

const license = { payload, signature };

const outPath = path.resolve(process.cwd(), args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(license, null, 2));

console.log('✅ 已签发 license.lic：', outPath);
console.log('   licenseId  :', payload.licenseId);
console.log('   customerId :', payload.customerId);
console.log('   domains    :', payload.domains.join(', '));
console.log('   issuedAt   :', payload.issuedAt);
console.log('');
console.log('交付步骤：');
console.log('  1) 把对应的 public.pem 放到客户服务端 license/public.pem');
console.log('  2) 把这份 license.lic 放到客户服务端 license/license.lic');
console.log('  3) 启动服务，控制台会显示 [License] 已激活 ...');
