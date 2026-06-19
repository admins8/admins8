const mysql = require('./node_modules/mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({
      host: '127.0.0.1', port: 3306,
      user: 'soumal', password: 'soumal', database: 'soumal'
    });
    const [r] = await c.execute('SELECT 1 as ok');
    console.log('MySQL OK:', JSON.stringify(r));
    await c.end();
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
