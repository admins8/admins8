const fs = require('fs');
const path = require('path');

const srcRoot = 'D:\\legado-home\\web\\src';
const destRoot = 'D:\\legado-home\\_vite\\src';

function safeCopyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) {
        safeCopyDir(srcPath, destPath);
      } else {
        // Only copy if file actually exists and is readable
        fs.accessSync(srcPath, fs.constants.R_OK);
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (e) {
      console.log('SKIP:', srcPath, '-', e.message.split('\n')[0]);
    }
  }
}

// Remove existing src dir
try { fs.rmSync(destRoot, { recursive: true, force: true }); } catch (e) {}

safeCopyDir(srcRoot, destRoot);
console.log('Done!');

// Verify
const count = fs.readdirSync(destRoot).length;
console.log('Top-level entries:', count);
