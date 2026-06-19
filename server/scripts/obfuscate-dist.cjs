/**
 * 对 dist/ 下所有 JS 文件进行混淆，覆盖原文件。
 *
 * 设计要点：
 * - 中等强度配置：转控制流 + 字符串数组 + 数值/字符串字面量打乱；
 * - 自我保护启用 (debugProtection / selfDefending)；
 * - 跳过已经在 dist 里的 .js.map / .d.ts.map / .d.ts，避免破坏类型；
 * - 不输出 sourceMap，运行时报错只能看到混淆后的栈，进一步提高反编译成本。
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('[obfuscate] dist 目录不存在，请先执行 npm run build');
  process.exit(1);
}

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  debugProtection: false, // 关闭调试器死循环，避免线上排错时崩溃
  disableConsoleOutput: false,
  identifierNamesGenerator: 'mangled-shuffled',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  // 排除可能与原生模块路径相关的字符串
  reservedStrings: [],
  // node_modules 之外的 require/import 不要被混淆掉
  target: 'node',
};

let total = 0;
let obfuscated = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(fullPath)) walk(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    if (entry.name.endsWith('.test.js')) {
      // 测试文件不进入交付包
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      continue;
    }
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

// 删除所有 sourceMap 与声明文件，避免在交付包暴露源结构
function cleanupArtifacts(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(fullPath)) cleanupArtifacts(fullPath);
      continue;
    }
    if (entry.name.endsWith('.js.map') || entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.ts.map')) {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
}

console.log('[obfuscate] 开始处理 dist 目录：', distDir);
walk(distDir);
cleanupArtifacts(distDir);

// 注入版本号到 dist/version.txt
try {
  const root = path.resolve(__dirname, '..', '..');
  const verFile = path.join(root, 'VERSION');
  if (fs.existsSync(verFile)) {
    const ver = fs.readFileSync(verFile, 'utf-8').trim();
    fs.writeFileSync(path.join(distDir, 'version.txt'), ver, 'utf-8');
    console.log(`[obfuscate] 已写入 dist/version.txt = ${ver}`);
  }
} catch (e) {
  console.warn('[obfuscate] 写入 version.txt 失败：', e.message);
}

console.log(`[obfuscate] 完成：共扫描 ${total} 个 JS 文件，已混淆 ${obfuscated} 个`);
