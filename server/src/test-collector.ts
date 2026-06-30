import { checkCollectorBookUpdate } from './services/collectorPlugin';

async function main() {
  console.log('Testing checkCollectorBookUpdate for 神秘复苏...');
  try {
    const result = await checkCollectorBookUpdate('http://www.xqishuta.org/Shtml31535.html');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

main();
