const { createServer, build } = require('vite');
const path = require('path');

// 在web项目目录下执行构建
const root = path.resolve('D:\\legado-home\\web');

async function main() {
  try {
    await build({
      root: root,
      configFile: path.join(root, 'vite.config.ts'),
      logLevel: 'info',
    });
    console.log('Build completed successfully!');
  } catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
  }
}

main();
