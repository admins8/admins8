const fs = require('fs');
const path = require('path');

const srcRoot = 'D:\\legado-home\\_vite\\node_modules';
const destRoot = 'D:\\legado-home\\web\\node_modules';

function copyRecursiveSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function forceCopy(src, dest) {
  try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) {}
  // Try to create parent if it's a ghost dir
  try {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
  } catch (e) {}
  copyRecursiveSync(src, dest);
}

// List of specific packages to copy
const pkgs = [
  '@jridgewell/gen-mapping',
  '@jridgewell/trace-mapping',
  '@jridgewell/sourcemap-codec',
  '@vitejs/plugin-vue',
  'unimport',
  'unplugin-vue-components',
  'vite',
];

for (const pkg of pkgs) {
  const src = path.join(srcRoot, pkg);
  const dest = path.join(destRoot, pkg);
  if (!fs.existsSync(src)) {
    console.log('SKIP (no src):', pkg);
    continue;
  }
  try {
    forceCopy(src, dest);
    console.log('OK:', pkg);
  } catch (e) {
    console.log('ERR:', pkg, e.message.split('\n')[0]);
  }
}

console.log('Done!');
