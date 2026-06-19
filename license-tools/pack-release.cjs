/**
 * 一键交付构建：把后端 + 前端 + 授权占位目录组装为 release/<customerId>/，
 * 不包含任何 src/ 源码。
 *
 * 用法：
 *   node tools/pack-release.cjs --customer customer-soumal
 *
 * 输出结构：
 *   release/<customer>/
 *     server/
 *       dist/                   (混淆后的后端 JS)
 *       package.json
 *       package-lock.json       (客户 Linux 服务器执行 linux-install.sh 时安装依赖)
 *       .env.example
 *       license/
 *         public.pem            (供应商公钥)
 *         license.lic.example   (示例文件，提示放置位置)
 *     web/
 *       dist/                   (混淆后的前端静态资源)
 *     docker/
 *       Dockerfile.server
 *       Dockerfile.web
 *       docker-compose.yml
 *       nginx.conf
 *     README.md                 (客户使用说明)
 *     linux-install.sh          (Linux 服务器安装依赖并初始化配置)
 *     start.sh / stop.sh        (Linux 启动停止脚本)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const args = parseArgs(process.argv);
const customer = args.customer || 'default';
const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.resolve(ROOT, 'release', customer);
const SERVER_DIR = path.join(ROOT, 'server');
const WEB_DIR = path.join(ROOT, 'web');
const DOCKER_DIR = path.join(ROOT, 'docker');
const PUBLIC_KEY_PATH = path.join(ROOT, 'license-tools', 'keys', 'public.pem');
const CUSTOMER_LICENSE_PATH = path.join(ROOT, 'license-tools', 'out', customer, 'license.lic');

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dst, filter) {
  if (!fs.existsSync(src)) return;
  mkdirp(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (filter && !filter(s, entry)) continue;
    if (entry.isDirectory()) copyDir(s, d, filter);
    else fs.copyFileSync(s, d);
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

console.log(`\n=== 打包客户交付包：${customer} ===\n`);

// 1. 清空输出目录
rimraf(RELEASE_DIR);
mkdirp(RELEASE_DIR);

// 2. 后端：构建 + 混淆
run('npm run build:protected', SERVER_DIR);

// 3. 前端：构建 + 混淆
run('npm run build:protected', WEB_DIR);

// 4. 拷贝 server/dist
copyDir(path.join(SERVER_DIR, 'dist'), path.join(RELEASE_DIR, 'server', 'dist'));

// 5. 生成 server/package.json（剔除 devDependencies，强制 production 安装）
const serverPkg = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf-8'));
delete serverPkg.devDependencies;
serverPkg.scripts = { start: 'node dist/app.js' };
serverPkg.main = 'dist/app.js';
fs.writeFileSync(
  path.join(RELEASE_DIR, 'server', 'package.json'),
  JSON.stringify(serverPkg, null, 2)
);

// 6. 拷贝示例环境变量
fs.copyFileSync(
  path.join(SERVER_DIR, '.env.example'),
  path.join(RELEASE_DIR, 'server', '.env.example')
);
const lockPath = path.join(SERVER_DIR, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  fs.copyFileSync(lockPath, path.join(RELEASE_DIR, 'server', 'package-lock.json'));
}

// 7. 在 release/server/license/ 放公钥；license.lic 由各客户单独签发后再附加
const licenseDir = path.join(RELEASE_DIR, 'server', 'license');
mkdirp(licenseDir);
if (fs.existsSync(PUBLIC_KEY_PATH)) {
  fs.copyFileSync(PUBLIC_KEY_PATH, path.join(licenseDir, 'public.pem'));
} else {
  console.warn('[!] 未找到 license-tools/keys/public.pem，跳过公钥拷贝。请先运行 generate-keys.cjs');
}
fs.writeFileSync(
  path.join(licenseDir, 'PLACE_LICENSE_HERE.txt'),
  '把供应商签发的 license.lic 放到这个目录下，文件名必须为 license.lic。'
);
if (fs.existsSync(CUSTOMER_LICENSE_PATH)) {
  fs.copyFileSync(CUSTOMER_LICENSE_PATH, path.join(licenseDir, 'license.lic'));
  console.log(`[i] 已复制客户授权文件：${CUSTOMER_LICENSE_PATH}`);
}

// 8. 拷贝前端 dist
copyDir(path.join(WEB_DIR, 'dist'), path.join(RELEASE_DIR, 'web', 'dist'));

// 9. 拷贝 docker/ 目录（如果存在）
if (fs.existsSync(DOCKER_DIR)) {
  copyDir(DOCKER_DIR, path.join(RELEASE_DIR, 'docker'));
}

// 10. 确保交付包不包含当前机器的 node_modules
rimraf(path.join(RELEASE_DIR, 'server', 'node_modules'));

// 11. 写入 Linux 安装与启动脚本
fs.writeFileSync(
  path.join(RELEASE_DIR, 'linux-install.sh'),
  `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"

echo "=== Legado Home Linux 安装脚本 ==="

if ! command -v node >/dev/null 2>&1; then
  echo "[!] 未检测到 Node.js。请先安装 Node.js 20 LTS 后重新运行。"
  echo "    Ubuntu/Debian 示例：curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  echo "    CentOS/RHEL 示例：curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" != "20" ]; then
  echo "[!] 当前 Node.js 版本为 $(node -v)，本项目要求 Node.js 20 LTS。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[!] 未检测到 npm，请检查 Node.js 安装。"
  exit 1
fi

cd "$SERVER_DIR"

echo "=== 安装 Linux 生产依赖 ==="
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund
else
  npm install --omit=dev --no-audit --no-fund
fi

echo "=== 检查 isolated-vm 原生模块 ==="
npm rebuild isolated-vm || echo "[!] isolated-vm rebuild 未成功。默认未启用书源 JS 时不影响运行；如需启用书源 JS，请安装编译工具后重试。"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[i] 已生成 server/.env，请根据服务器 MySQL、Redis、JWT、管理员账号等信息修改。"
fi

mkdir -p data/uploads data/updates data/backups

if [ ! -f license/license.lic ]; then
  echo "[!] 未找到授权文件：server/license/license.lic"
  echo "    请把供应商签发的 license.lic 放到 server/license/license.lic 后再启动。"
else
  echo "[i] 授权文件已存在。"
fi

echo "=== 安装完成 ==="
echo "下一步："
echo "1. 编辑 server/.env"
echo "2. 放置 server/license/license.lic"
echo "3. 执行 bash start.sh"
`
);

fs.writeFileSync(
  path.join(RELEASE_DIR, 'start.sh'),
  '#!/usr/bin/env bash\nset -euo pipefail\nROOT_DIR="$(cd "$(dirname "$0")" && pwd)"\ncd "$ROOT_DIR/server"\n'
  + 'if [ ! -d node_modules ]; then\n'
  + '  echo "[!] 未安装 Linux 生产依赖，请先执行：bash linux-install.sh"\n'
  + '  exit 1\n'
  + 'fi\n'
  + 'if [ ! -f .env ]; then\n'
  + '  echo "[!] 未找到 server/.env，请先执行：bash linux-install.sh 并修改配置"\n'
  + '  exit 1\n'
  + 'fi\n'
  + 'if [ ! -f license/license.lic ]; then\n'
  + '  echo "[!] 未找到 license.lic，请把供应商签发的授权文件放到 server/license/license.lic"\n'
  + '  exit 1\n'
  + 'fi\n'
  + 'if command -v pm2 >/dev/null 2>&1; then\n'
  + '  pm2 start dist/app.js --name legado-home-server --update-env\n'
  + 'else\n'
  + '  echo "[i] 未检测到 pm2，将以前台方式启动。生产环境建议安装：npm install -g pm2"\n'
  + '  exec node dist/app.js\n'
  + 'fi\n'
);

fs.writeFileSync(
  path.join(RELEASE_DIR, 'stop.sh'),
  '#!/usr/bin/env bash\nset -euo pipefail\n'
  + 'if command -v pm2 >/dev/null 2>&1; then\n'
  + '  pm2 stop legado-home-server || true\n'
  + 'else\n'
  + '  echo "[!] 未检测到 pm2。如果是前台 node 启动，请在对应终端按 Ctrl+C 停止。"\n'
  + 'fi\n'
);

fs.writeFileSync(
  path.join(RELEASE_DIR, 'restart.sh'),
  '#!/usr/bin/env bash\nset -euo pipefail\n'
  + 'if command -v pm2 >/dev/null 2>&1; then\n'
  + '  pm2 restart legado-home-server --update-env\n'
  + 'else\n'
  + '  bash "$(dirname "$0")/start.sh"\n'
  + 'fi\n'
);

// 12. 写入交付 README（提示文件结构、启动顺序、license 放置位置）
const readme = [
  '# Legado Home 交付包',
  '',
  `客户：${customer}`,
  `打包时间：${new Date().toISOString()}`,
  '',
  '## 目录结构',
  '```',
  'server/',
  '  dist/             已编译并混淆的后端代码',
  '  package.json',
  '  package-lock.json  Linux 服务器安装生产依赖使用',
  '  .env.example      环境变量示例（复制为 .env 后修改）',
  '  license/',
  '    public.pem      供应商公钥（不要修改）',
  '    license.lic     ⬅️ 把供应商签发的授权文件放在这里',
  'web/',
  '  dist/             前端静态资源（部署到 Nginx 或随后端 SPA fallback）',
  'docker/             Docker 部署文件（可选）',
  'linux-install.sh    Linux 服务器安装依赖与初始化脚本',
  'start.sh            Linux 启动脚本（优先使用 pm2）',
  'stop.sh             Linux 停止脚本',
  'restart.sh          Linux 重启脚本',
  '```',
  '',
  '## Linux 原生部署步骤',
  '1. 在服务器安装 Node.js 20 LTS、MySQL 8、Redis 7、Nginx（可选）、PM2（可选）',
  '2. 上传并解压本交付包',
  '3. 执行 `bash linux-install.sh`，在服务器本机安装 Linux 生产依赖',
  '4. 修改 `server/.env`，填写数据库、Redis、JWT_SECRET、管理员账号等配置',
  '5. 确认 `server/license/license.lic` 已存在',
  '6. 执行 `bash start.sh` 启动后端服务',
  '7. 将 `web/dist` 配置到 Nginx，或使用后端 SPA fallback 访问',
  '',
  '## Docker 部署步骤',
  '如客户服务器使用 Docker，请进入 `docker/` 目录执行：',
  '```bash',
  'docker compose up -d --build',
  '```',
  '',
  '## 重要说明',
  '- 交付包不会包含开发机的 `node_modules`，避免 Windows 依赖污染 Linux 环境。',
  '- Linux 服务器首次安装必须执行 `bash linux-install.sh`。',
  '- `server/node_modules` 会在客户服务器上按 Linux 环境自动生成。',
  '- 如果启用书源 JS，需要确保服务器可编译或安装 `isolated-vm` 原生模块。',
  '',
  '## 授权说明',
  '- 本服务在启动时会读取 `server/license/license.lic` 并用内置公钥验签，签名不通过将拒绝启动。',
  '- 每个 HTTP 请求会按 Host 校验是否在授权域名范围内，未授权域名会返回 403。',
  '- 删除或修改 `license.lic` 都会导致服务无法启动；请勿尝试绕过，违反授权将无法获得后续支持与升级。',
].join('\n');
fs.writeFileSync(path.join(RELEASE_DIR, 'README.md'), readme);

assertNoPrivateSecrets(RELEASE_DIR);

console.log(`\n✅ 交付包已生成：${RELEASE_DIR}`);
console.log('   已跳过 node_modules 打包；客户 Linux 服务器执行 bash linux-install.sh 自动安装生产依赖。');
console.log('   下一步：确认 license.lic 已放入 server/license，然后压缩整个目录交付。');
