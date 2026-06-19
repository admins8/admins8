const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createPool({host:'127.0.0.1', user:'le1234', password:'le1234', database:'le1234', connectionLimit:2});

  // 第一步：读取所有需要清洗的条目，在 JS 里清洗，再 UPDATE
  const [dirty] = await c.query(
    `SELECT id, name, author FROM hot_rankings
     WHERE LENGTH(author) > 0 AND (
       author LIKE '作者%' OR author LIKE 'Author%' OR author LIKE 'author%'
       OR LENGTH(author) > 80 OR author LIKE '%\n%' OR author LIKE '%\r%' OR author LIKE '%\t%'
     )`
  );
  console.log(`共 ${dirty.length} 条需要清洗`);

  function cleanAuthor(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (!s) return '';
    if (s.length > 80) return '';
    if (/[\n\r\t]/.test(s)) return '';
    s = s.replace(/^作\s*者\s*[:：\-=\s]+/, '');
    s = s.replace(/^author\s*[:：\-=\s]+/i, '');
    s = s.replace(/[，。,;；\s]+$/g, '');
    return s.trim();
  }

  let updated = 0;
  for (const r of dirty) {
    const newAuthor = cleanAuthor(r.author);
    if (newAuthor !== r.author) {
      await c.query('UPDATE hot_rankings SET author = ? WHERE id = ?', [newAuthor, r.id]);
      console.log(`  id=${r.id} "${r.name}" : "${r.author}" → "${newAuthor}"`);
      updated++;
    }
  }
  console.log(`\n已更新 ${updated} 条`);

  // 第二步：再查重复
  const [dupes] = await c.query(`
    SELECT name, author, rank_type, category, COUNT(*) cnt
    FROM hot_rankings
    WHERE name IS NOT NULL AND name <> ''
    GROUP BY name, author, rank_type, category
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('\n=== 仍存在的重复（书名+作者+类型+分类）===');
  if (dupes.length === 0) console.log('  无重复 ✓');
  else for (const r of dupes) console.log(`  "${r.name}" | "${r.author}" | ${r.rank_type}/${r.category} → ${r.cnt} 条`);

  await c.end();
})();
