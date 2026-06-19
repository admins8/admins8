const { build } = require('vite');
const path = require('path');

const root = path.resolve('D:\\legado-home\\web');

async function main() {
  try {
    const result = await build({
      root: root,
      configFile: path.join(root, 'vite.config.build.ts'),
      logLevel: 'info',
    });
    if (result) {
      console.log('Build completed successfully!');
    }
  } catch (e) {
    console.error('Build failed:', e.message);
    if (e.stack) console.error(e.stack);
    process.exit(1);
  }
}

main();
