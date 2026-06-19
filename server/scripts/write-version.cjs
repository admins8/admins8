const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const serverRoot = path.resolve(__dirname, '..');
const distDir = path.join(serverRoot, 'dist');
const versionFile = path.join(root, 'VERSION');

if (!fs.existsSync(versionFile)) {
  console.warn('[version] 根目录 VERSION 不存在，跳过写入 dist/version.txt');
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  console.error('[version] dist 目录不存在，请先执行 tsc');
  process.exit(1);
}

const version = fs.readFileSync(versionFile, 'utf-8').trim();
if (!version) {
  console.warn('[version] VERSION 内容为空，跳过写入 dist/version.txt');
  process.exit(0);
}

fs.writeFileSync(path.join(distDir, 'version.txt'), `${version}\n`, 'utf-8');
console.log(`[version] 已写入 dist/version.txt = ${version}`);
