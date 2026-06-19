const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createPool({host:'127.0.0.1', user:'le1234', password:'le1234', database:'le1234', connectionLimit:2});
  const [rows] = await c.query(
    "SELECT DISTINCT author FROM hot_rankings WHERE author IS NOT NULL AND author <> '' ORDER BY author LIMIT 50"
  );
  console.log('=== 作者字段样本 ===');
  for (const r of rows) console.log(' |', JSON.stringify(r.author));
  const [rows2] = await c.query(
    "SELECT name, author, category, rank_type FROM hot_rankings WHERE name LIKE '%凡人%' LIMIT 10"
  );
  console.log('\n=== 凡人相关样本 ===');
  for (const r of rows2) console.log(' 书名:', JSON.stringify(r.name), '| 作者:', JSON.stringify(r.author), '| 分类:', r.category, '| 类型:', r.rank_type);
  await c.end();
})();
