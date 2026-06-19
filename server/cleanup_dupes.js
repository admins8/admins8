const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createPool({host:'127.0.0.1', user:'le1234', password:'le1234', database:'le1234', connectionLimit:2});

  // 对每个 (name, author, rank_type, category) 组，保留 id 最小的一条，其他删除
  const [groups] = await c.query(`
    SELECT name, author, rank_type, category,
           GROUP_CONCAT(id ORDER BY id) AS ids,
           MIN(id) AS keep_id,
           COUNT(*) cnt
    FROM hot_rankings
    WHERE name IS NOT NULL AND name <> ''
    GROUP BY name, author, rank_type, category
    HAVING cnt > 1
    ORDER BY cnt DESC
  `);

  console.log(`发现 ${groups.length} 组重复`);

  const toDelete = [];
  for (const g of groups) {
    const ids = String(g.ids).split(',').map(Number).filter(id => id !== g.keep_id);
    console.log(`  "${g.name}" | "${g.author}" | ${g.rank_type}/${g.category}: 保留 id=${g.keep_id}, 删除 ids=[${ids.join(',')}]`);
    toDelete.push(...ids);
  }

  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(',');
    const [del] = await c.query(`DELETE FROM hot_rankings WHERE id IN (${placeholders})`, toDelete);
    console.log(`\n已删除 ${del.affectedRows} 条重复记录`);
  } else {
    console.log('\n无需删除');
  }

  await c.end();
})();
