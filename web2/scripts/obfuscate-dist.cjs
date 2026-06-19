/**
 * 对 web/dist/ 下所有 JS 文件进行混淆，覆盖原文件。
 *
 * 注意：浏览器端混淆强度要稍弱一点，避免 controlFlowFlattening 导致首屏卡顿。
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[obfuscate] web/dist 不存在，请先执行 npm run build');
  process.exit(1);
}

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.3,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'mangled-shuffled',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 12,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.7,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'browser',
};

let total = 0;
let obfuscated = 0;
const startedAt = Date.now();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    total++;
    const code = fs.readFileSync(fullPath, 'utf-8');
    try {
      const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
      fs.writeFileSync(fullPath, result.getObfuscatedCode());
      obfuscated++;
    } catch (e) {
      console.error(`[obfuscate] 失败：${fullPath}: ${e.message}`);
      throw e;
    }
  }
}

// 删除 sourceMap 文件，避免暴露原始代码
function cleanupSourceMaps(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanupSourceMaps(fullPath);
      continue;
    }
    if (entry.name.endsWith('.js.map') || entry.name.endsWith('.css.map')) {
      fs.unlinkSync(fullPath);
    }
  }
}

console.log('[obfuscate] 开始处理 web/dist：', distDir);
walk(distDir);
cleanupSourceMaps(distDir);

// 注入版本号到 dist/version.txt
try {
  const root = path.resolve(__dirname, '..', '..');
  const verFile = path.join(root, 'VERSION');
  if (fs.existsSync(verFile)) {
    const ver = fs.readFileSync(verFile, 'utf-8').trim();
    fs.writeFileSync(path.join(distDir, 'version.txt'), ver, 'utf-8');
    console.log(`[obfuscate] 已写入 web/dist/version.txt = ${ver}`);
  }
} catch (e) {
  console.warn('[obfuscate] 写入 version.txt 失败：', e.message);
}

console.log(`[obfuscate] 完成：共扫描 ${total} 个 JS 文件，已混淆 ${obfuscated} 个，用时 ${Date.now() - startedAt}ms`);
