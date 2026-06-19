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

const dirs = fs.readdirSync(srcRoot);
let copied = 0;
for (const dir of dirs) {
  const src = path.join(srcRoot, dir);
  const dest = path.join(destRoot, dir);
  const stat = fs.statSync(src);
  if (stat.isDirectory() && !dir.startsWith('.') && dir !== 'npm') {
    try {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      copyRecursiveSync(src, dest);
      copied++;
    } catch (e) {
      console.log('ERR copying', dir, e.message.split('\n')[0]);
    }
  }
}
console.log(`Copied ${copied} packages`);
