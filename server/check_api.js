const http = require('http');

http.get('http://localhost:3001/api/home/rankings/grouped?perRank=20', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Status code:', parsed.code);
      console.log('Meta:', JSON.stringify(parsed.data.meta, null, 2));
      console.log('Category:', parsed.data.category);
      console.log('Categories:', parsed.data.categories);
      console.log('\n=== Rankings Data ===');
      for (const key of Object.keys(parsed.data.rankings)) {
        const list = parsed.data.rankings[key];
        console.log(`\n[${key}] ${list.length} 条:`);
        for (const book of list.slice(0, 10)) {
          console.log(`  - ${book.name} (${book.author || '匿名'})`);
        }
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.log('HTTP error:', e.message);
});
