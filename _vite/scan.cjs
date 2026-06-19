const fs = require('fs');
const path = require('path');

const srcRoot = 'D:\\legado-home\\_vite\\node_modules';
const destRoot = 'D:\\legado-home\\web\\node_modules';

// 只复制顶层文件（不进入子目录，避免scandir ghost问题）
const topItems = fs.readdirSync(srcRoot);
for (const item of topItems) {
  const src = path.join(srcRoot, item);
  const dest = path.join(destRoot, item);
  const stat = fs.statSync(src);
  
  if (!stat.isDirectory() || item.startsWith('.') || item === 'npm') continue;
  
  // 对于目录，先尝试删除目标
  try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) {}
  
  // 用cmd来创建目录和复制
  console.log('Processing:', item);
}

console.log('Done scanning');
