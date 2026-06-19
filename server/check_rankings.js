const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createPool({host:'127.0.0.1', user:'le1234', password:'le1234', database:'le1234', connectionLimit:2});

  // 1. 检查每个 rank_type 有多少条记录
  const [byType] = await c.query(
    'SELECT rank_type, category, COUNT(*) cnt FROM hot_rankings GROUP BY rank_type, category ORDER BY rank_type'
  );
  console.log('=== 按 rank_type + category 统计 ===');
  for (const row of byType) console.log(`  ${row.rank_type} / ${row.category} → ${row.cnt} 条`);

  // 2. 检查 is_active 字段
  const [activeStats] = await c.query(
    'SELECT rank_type, is_active, COUNT(*) cnt FROM hot_rankings GROUP BY rank_type, is_active'
  );
  console.log('\n=== 按 is_active 统计 ===');
  for (const row of activeStats) console.log(`  ${row.rank_type} / is_active=${row.is_active} → ${row.cnt} 条`);

  // 3. 查看一些样本
  const [samples] = await c.query(
    'SELECT rank_type, name, author, category, is_active FROM hot_rankings LIMIT 30'
  );
  console.log('\n=== 样本数据 ===');
  for (const row of samples) console.log(`  [${row.rank_type}] ${row.name} (${row.author}) cat=${row.category} active=${row.is_active}`);

  await c.end();
})();
