/**
 * 通用文件签名工具：用 RSA-SHA256 + 私钥对一个文件做签名，输出 base64 字符串。
 *
 * 用法：
 *   node license-tools/sign-file.cjs --file <path> --key <privatePem> [--out <sigPath>]
 *
 * 默认私钥：.secrets/license/private.pem，也可用 LICENSE_PRIVATE_KEY_PATH 指定
 * 默认签名输出：<file>.sig（内容为 base64 字符串）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const filePath = args.file;
  if (!filePath) {
    console.error('[sign-file] 缺少 --file 参数');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error('[sign-file] 文件不存在：', filePath);
    process.exit(1);
  }
  const keyPath = args.key
    || process.env.LICENSE_PRIVATE_KEY_PATH
    || path.resolve(__dirname, '..', '.secrets', 'license', 'private.pem');
  if (!fs.existsSync(keyPath)) {
    console.error('[sign-file] 私钥不存在，请设置 LICENSE_PRIVATE_KEY_PATH 或使用 --key 指定：', keyPath);
    process.exit(1);
  }
  const outPath = args.out || `${filePath}.sig`;

  const data = fs.readFileSync(filePath);
  const pem = fs.readFileSync(keyPath, 'utf-8');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const sig = signer.sign(pem).toString('base64');
  fs.writeFileSync(outPath, sig, 'utf-8');

  console.log(`[sign-file] 已生成签名：${outPath}`);
  console.log(`[sign-file] base64 长度：${sig.length}`);
}

main();
