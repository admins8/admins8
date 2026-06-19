import { createPool } from 'mysql2/promise';

async function main() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'le1234',
    password: process.env.DB_PASSWORD || 'le1234',
    database: process.env.DB_NAME || 'le1234',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  });

  try {
    console.log('=== hot_rankings 总数:', 80, '(5 榜单 × 16 条) ===');

    // 同一榜单内的重复（同 rank_type + 同书名+作者）
    const [intraDupes] = await pool.query(
      'SELECT rank_type, category, MIN(name) as name, MIN(author) as author, COUNT(*) as cnt ' +
      'FROM hot_rankings ' +
      'WHERE name IS NOT NULL AND name != "" ' +
      'GROUP BY rank_type, category, LOWER(TRIM(name)), LOWER(TRIM(COALESCE(author, ""))) ' +
      'HAVING COUNT(*) > 1 ' +
      'ORDER BY cnt DESC '
    );
    console.log('\n【同一榜单+分类内】的重复 (同 rank_type+category + 同书名+作者):');
    if (intraDupes.length === 0) {
      console.log('  → 无重复');
    } else {
      intraDupes.forEach(r => {
        console.log(`  [${r.rank_type}] [${r.category}] "${r.name}" (${r.author || '未知'}) 出现 ${r.cnt} 次`);
      });
    }

    // 按 rank_type 内的全局去重（不管 category）
    const [globalDupes] = await pool.query(
      'SELECT rank_type, MIN(name) as name, MIN(author) as author, COUNT(*) as cnt ' +
      'FROM hot_rankings ' +
      'WHERE name IS NOT NULL AND name != "" ' +
      'GROUP BY rank_type, LOWER(TRIM(name)), LOWER(TRIM(COALESCE(author, ""))) ' +
      'HAVING COUNT(*) > 1 ' +
      'ORDER BY cnt DESC '
    );
    console.log('\n【同一榜单内】的重复 (同 rank_type + 同书名+作者，不考虑 category):');
    if (globalDupes.length === 0) {
      console.log('  → 无重复');
    } else {
      globalDupes.forEach(r => {
        console.log(`  [${r.rank_type}] "${r.name}" (${r.author || '未知'}) 出现 ${r.cnt} 次`);
      });
    }

    // 显示每个榜单的前5条，看看实际返回给前端的是什么
    console.log('\n=== 各榜单前5条（实际会返回给前端的数据）===');
    const types = ['popularity', 'new', 'review', 'chapter', 'wordcount'];
    for (const t of types) {
      const [rows] = await pool.query(
        'SELECT name, author, category, sort_order, download_count FROM hot_rankings WHERE rank_type = ? ORDER BY sort_order ASC, download_count DESC LIMIT 8',
        [t]
      );
      console.log(`\n[${t}] 前8条:`);
      rows.forEach((r, i) => {
        console.log(`  ${i+1}. "${r.name}" (${r.author || '未知'}) - 分类: ${r.category || '-'} - sort: ${r.sort_order}`);
      });
    }

  } catch (e) {
    console.error('查询失败:', e.message);
  } finally {
    await pool.end();
  }
}
main();
