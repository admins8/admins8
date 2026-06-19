/**
 * 升级包打包：从源码构建（带混淆），打包 server/dist + web/dist + version.txt 为 update.zip，
 * 用 RSA-SHA256 + license 私钥签名，并更新 GitHub Pages 仓库根目录的 manifest.json。
 *
 * 用法：
 *   node license-tools/pack-update.cjs --version 1.1.0 \
 *        [--changelog "修复 xxx；新增 yyy"] \
 *        [--minVersion 1.0.0] \
 *        [--out release/update] \
 *        [--pages D:/legado-pages] \
 *        [--baseUrl https://admins88.github.io/legado-home] \
 *        [--key license-tools/keys/private.pem] \
 *        [--skipBuild]
 *
 * 流程：
 *   1. 校验 VERSION 与 --version 一致（或自动写入 VERSION）
 *   2. 默认执行 server / web 的 build:protected（混淆构建）
 *   3. 构造目录结构：
 *        <out>/extract/server/dist
 *        <out>/extract/web/dist
 *        <out>/extract/version.txt
 *   4. 压缩为 <out>/update.zip
 *   5. 用 RSA-SHA256 私钥签名 → <out>/update.zip.sig
 *   6. 如指定 --pages，则把 update.zip + update.zip.sig 复制到
 *        <pages>/releases/<version>/，并更新 <pages>/manifest.json
 *
 * 依赖：根目录或 license-tools 内已安装 adm-zip。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch {
  // 备用路径：使用 server/node_modules 内的 adm-zip
  AdmZip = require(path.resolve(__dirname, '..', 'server', 'node_modules', 'adm-zip'));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  mkdirp(dst);
  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (!fs.existsSync(s)) continue;
    if (entry.isDirectory()) copyDir(s, d);
    else {
      try {
        fs.copyFileSync(s, d);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
}

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function assertNoPrivateSecrets(dir) {
  const offenders = [];

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      if (path.basename(current) === '.secrets') {
        offenders.push(current);
        return;
      }
      for (const name of fs.readdirSync(current)) {
        walk(path.join(current, name));
      }
      return;
    }

    const base = path.basename(current).toLowerCase();
    if (base === 'private.pem' || base.includes('private')) {
      offenders.push(current);
    }
  }

  walk(dir);

  if (offenders.length > 0) {
    throw new Error(`发布产物包含私钥或 secrets 目录，已拒绝打包:\n${offenders.join('\n')}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const version = args.version;
  if (!version) {
    console.error('[pack-update] 缺少 --version 参数（例如 --version 1.1.0）');
    process.exit(1);
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`[pack-update] version 必须形如 1.2.3，当前：${version}`);
    process.exit(1);
  }

  const ROOT = path.resolve(__dirname, '..');
  const SERVER_DIR = path.join(ROOT, 'server');
  const WEB_DIR = path.join(ROOT, 'web');
  const OUT = path.resolve(ROOT, args.out || path.join('release', 'update'));
  const KEY = args.key
    ? path.resolve(args.key)
    : (process.env.LICENSE_PRIVATE_KEY_PATH || path.join(ROOT, '.secrets', 'license', 'private.pem'));
  const VERSION_FILE = path.join(ROOT, 'VERSION');

  // 1. 校验 / 写入 VERSION
  let curVer = '';
  if (fs.existsSync(VERSION_FILE)) curVer = fs.readFileSync(VERSION_FILE, 'utf-8').trim();
  if (curVer && curVer !== version) {
    console.warn(`[pack-update] VERSION 当前为 ${curVer}，将更新为 ${version}`);
  }
  fs.writeFileSync(VERSION_FILE, `${version}\n`, 'utf-8');

  // 2. 构建（默认带混淆）
  if (!args.skipBuild) {
    run('npm run build:protected', SERVER_DIR);
    run('npm run build:protected', WEB_DIR);
  } else {
    console.log('[pack-update] --skipBuild：跳过构建');
  }

  // 3. 构造解压目录布局，并写入 version.txt
  rimraf(OUT);
  mkdirp(OUT);
  const STAGE = path.join(OUT, 'stage');
  mkdirp(STAGE);
  copyDir(path.join(SERVER_DIR, 'dist'), path.join(STAGE, 'server', 'dist'));
  copyDir(path.join(WEB_DIR, 'dist'), path.join(STAGE, 'web', 'dist'));
  fs.writeFileSync(path.join(STAGE, 'version.txt'), version, 'utf-8');
  fs.writeFileSync(path.join(STAGE, 'server', 'dist', 'version.txt'), version, 'utf-8');
  fs.writeFileSync(path.join(STAGE, 'web', 'dist', 'version.txt'), version, 'utf-8');
  assertNoPrivateSecrets(STAGE);

  // 4. 打包 zip
  const zipPath = path.join(OUT, 'update.zip');
  const zip = new AdmZip();
  zip.addLocalFolder(STAGE);
  zip.writeZip(zipPath);
  const stat = fs.statSync(zipPath);
  console.log(`[pack-update] 已生成升级包：${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  // 5. 签名
  if (!fs.existsSync(KEY)) {
    console.error(`[pack-update] 找不到私钥，请设置 LICENSE_PRIVATE_KEY_PATH 或使用 --key 指定：${KEY}`);
    process.exit(1);
  }
  const pem = fs.readFileSync(KEY, 'utf-8');
  const buf = fs.readFileSync(zipPath);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(buf);
  signer.end();
  const sigB64 = signer.sign(pem).toString('base64');
  const sigPath = path.join(OUT, 'update.zip.sig');
  fs.writeFileSync(sigPath, sigB64, 'utf-8');
  console.log(`[pack-update] 已生成签名：${sigPath}`);

  // 6. 如果给了 GitHub Pages 仓库目录，自动同步并更新 manifest.json
  if (args.pages) {
    const pages = path.resolve(args.pages);
    if (!fs.existsSync(pages)) {
      console.error(`[pack-update] --pages 目录不存在：${pages}`);
      process.exit(1);
    }
    const baseUrl = (args.baseUrl || 'https://admins88.github.io/legado-home').replace(/\/$/, '');
    const releasesDir = path.join(pages, 'releases', version);
    mkdirp(releasesDir);
    fs.copyFileSync(zipPath, path.join(releasesDir, 'update.zip'));
    fs.copyFileSync(sigPath, path.join(releasesDir, 'update.zip.sig'));

    const manifestPath = path.join(pages, 'manifest.json');
    let manifest = { latest: '', releases: [] };
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch {}
    }
    if (!Array.isArray(manifest.releases)) manifest.releases = [];

    const release = {
      version,
      publishedAt: new Date().toISOString(),
      url: `${baseUrl}/releases/${version}/update.zip`,
      sigUrl: `${baseUrl}/releases/${version}/update.zip.sig`,
      changelog: typeof args.changelog === 'string' ? args.changelog : '',
    };
    if (typeof args.minVersion === 'string') release.minVersion = args.minVersion;

    manifest.releases = manifest.releases.filter(r => r.version !== version);
    manifest.releases.push(release);
    manifest.releases.sort((a, b) => compareVersion(b.version, a.version));
    manifest.latest = manifest.releases[0]?.version || version;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[pack-update] 已更新 manifest：${manifestPath}`);
    console.log(`[pack-update] latest = ${manifest.latest}`);
    console.log('\n下一步：');
    console.log(`  cd "${pages}"`);
    console.log(`  git add manifest.json releases/${version}/`);
    console.log(`  git commit -m "release ${version}"`);
    console.log(`  git push`);
  } else {
    console.log('\n[pack-update] 未指定 --pages，仅生成 update.zip 与 .sig，可手动上传或拷入 pages 仓库。');
  }
}

function compareVersion(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

main();
