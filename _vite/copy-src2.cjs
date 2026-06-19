const fs = require('fs');
const path = require('path');

const srcRoot = 'D:\\legado-home\\web\\src';
const destRoot = 'D:\\legado-home\\_vite\\src';

function safeCopyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let copied = 0, skipped = 0;
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = safeCopyDir(srcPath, destPath);
        copied += sub.copied;
        skipped += sub.skipped;
      } else {
        // Verify file is actually readable before copying
        fs.accessSync(srcPath, fs.constants.R_OK);
        const fd = fs.openSync(srcPath, 'r');
        fs.closeSync(fd);
        fs.copyFileSync(srcPath, destPath);
        copied++;
      }
    } catch (e) {
      skipped++;
    }
  }
  return { copied, skipped };
}

// Remove existing dest
try { fs.rmSync(destRoot, { recursive: true, force: true }); } catch (e) {}

const result = safeCopyDir(srcRoot, destRoot);
console.log(`Copied ${result.copied} files, skipped ${result.skipped} ghost files`);

// Verify key files exist
const keyFiles = [
  'main.ts',
  'App.vue',
  'api/index.ts',
  'api/app.ts',
  'router/index.ts',
  'store/auth.ts',
];
for (const f of keyFiles) {
  console.log(`  ${f}: ${fs.existsSync(path.join(destRoot, f)) ? 'OK' : 'MISSING'}`);
}
