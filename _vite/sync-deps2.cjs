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

function copyPkg(srcName, destName) {
  const src = path.join(srcRoot, srcName);
  const dest = path.join(destRoot, destName || srcName);
  if (!fs.existsSync(src)) {
    console.log('SKIP (no src):', srcName);
    return;
  }
  try {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyRecursiveSync(src, dest);
    console.log('OK:', srcName, '->', destName || srcName);
  } catch (e) {
    console.log('ERR:', srcName, e.message.split('\n')[0]);
  }
}

// Copy scoped packages
const scopedDirs = ['@jridgewell', '@vitejs', '@esbuild'];
for (const scope of scopedDirs) {
  const srcScope = path.join(srcRoot, scope);
  if (fs.existsSync(srcScope)) {
    const destScope = path.join(destRoot, scope);
    fs.mkdirSync(destScope, { recursive: true });
    const pkgs = fs.readdirSync(srcScope);
    for (const pkg of pkgs) {
      copyPkg(scope + '/' + pkg, scope + '/' + pkg);
    }
  }
}

// Copy specific packages that failed
copyPkg('unimport');
copyPkg('unplugin-vue-components');
copyPkg('vite');

console.log('Done!');
