// 验证 dedupeRankingItems：模拟页面上会出现的各种重复情况
const testCases = [
  {
    title: "重复：忘语 vs 作者：忘语",
    items: [
      { id: 1, name: '凡人修仙传', author: '忘语' },
      { id: 2, name: '凡人修仙传', author: '作者：忘语' },
      { id: 3, name: '其他书1', author: '其他作者' },
    ],
  },
  {
    title: "重复：天蚕土豆 vs 作者：天蚕土豆",
    items: [
      { id: 1, name: '元尊', author: '作者：天蚕土豆' },
      { id: 2, name: '元尊', author: '天蚕土豆' },
    ],
  },
  {
    title: "书名带书名号的重复",
    items: [
      { id: 1, name: '《诡秘之主》', author: '爱潜水的乌贼' },
      { id: 2, name: '诡秘之主', author: '爱潜水的乌贼' },
    ],
  },
  {
    title: "同书名但不同作者 → 都保留",
    items: [
      { id: 1, name: '神雕侠侣', author: '金庸' },
      { id: 2, name: '神雕侠侣', author: '新作者' },
    ],
  },
  {
    title: "同书名一条有作者一条无作者 → 保留有作者的",
    items: [
      { id: 1, name: '某书', author: '' },
      { id: 2, name: '某书', author: '真正作者' },
    ],
  },
  {
    title: "同书名一条有作者一条无作者（无作者在前）→ 用有作者的替换",
    items: [
      { id: 1, name: '某书', author: '真正作者' },
      { id: 2, name: '某书', author: '' },
    ],
  },
];

// 复制 TS 中的 normalizeAuthor/normalizeBookName/dedupeRankingItems 逻辑到 JS
function normalizeAuthor(raw) {
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

function normalizeBookName(raw) {
  if (!raw) return '';
  return String(raw).trim()
    .replace(/[《》<>〈〉【】\[\]「」『』]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase();
}

function dedupeRankingItems(items) {
  if (!items || items.length === 0) return items;
  const seenWithAuthor = new Set();
  const seenByNameOnly = new Set();
  const result = [];
  for (const item of items) {
    const n = normalizeBookName(item.name);
    if (!n) { result.push(item); continue; }
    const a = normalizeAuthor(item.author);
    if (a) {
      const keyFull = `${n}|${a}`;
      if (seenWithAuthor.has(keyFull)) continue;
      if (seenByNameOnly.has(n)) {
        for (let i = result.length - 1; i >= 0; i--) {
          const rn = normalizeBookName(result[i].name);
          const ra = normalizeAuthor(result[i].author);
          if (rn === n && !ra) { result.splice(i, 1); break; }
        }
      }
      seenWithAuthor.add(keyFull);
      seenByNameOnly.add(n);
      result.push(item);
    } else {
      if (seenByNameOnly.has(n)) continue;
      let hasDupWithAuthor = false;
      for (const existing of result) {
        if (normalizeBookName(existing.name) === n && normalizeAuthor(existing.author)) {
          hasDupWithAuthor = true; break;
        }
      }
      if (hasDupWithAuthor) continue;
      seenByNameOnly.add(n);
      result.push(item);
    }
  }
  return result;
}

let allPass = true;
for (const tc of testCases) {
  const result = dedupeRankingItems(tc.items);
  console.log(`\n=== ${tc.title} ===`);
  console.log('  输入:', tc.items.length, '条');
  for (const r of result) {
    console.log(`    - id=${r.id} 书名=${r.name} 作者=${JSON.stringify(r.author)}`);
  }
  console.log('  → 输出:', result.length, '条');
}

console.log('\n=== 单元测试 ===');
function assert(cond, msg) {
  if (!cond) { console.log('✗ FAIL:', msg); allPass = false; }
  else console.log('✓', msg);
}
const r1 = dedupeRankingItems([{name:'凡人修仙传',author:'忘语'},{name:'凡人修仙传',author:'作者：忘语'}]);
assert(r1.length === 1, `"凡人修仙传" + "忘语/作者：忘语" → 只剩1条 (实际 ${r1.length})`);

const r2 = dedupeRankingItems([{name:'元尊',author:'作者：天蚕土豆'},{name:'元尊',author:'天蚕土豆'}]);
assert(r2.length === 1, `"元尊" + 两种作者写法 → 只剩1条 (实际 ${r2.length})`);

const r3 = dedupeRankingItems([{name:'《诡秘之主》',author:'爱潜水的乌贼'},{name:'诡秘之主',author:'爱潜水的乌贼'}]);
assert(r3.length === 1, `书名号 vs 无书名号 → 只剩1条 (实际 ${r3.length})`);

const r4 = dedupeRankingItems([{name:'神雕侠侣',author:'金庸'},{name:'神雕侠侣',author:'新作者'}]);
assert(r4.length === 2, `同名不同作者 → 保留2条 (实际 ${r4.length})`);

const r5 = dedupeRankingItems([{name:'某书',author:''},{name:'某书',author:'真正作者'}]);
assert(r5.length === 1 && normalizeAuthor(r5[0].author) === '真正作者',
  `无作者条目先出现 → 用有作者的替换 (实际保留: id?${r5[0].id||''} author=${JSON.stringify(r5[0].author)})`);

const r6 = dedupeRankingItems([{name:'某书',author:'真正作者'},{name:'某书',author:''}]);
assert(r6.length === 1 && normalizeAuthor(r6[0].author) === '真正作者',
  `有作者条目先出现 → 无作者的跳过 (实际保留: author=${JSON.stringify(r6[0].author)})`);

console.log('\n' + (allPass ? '✓ 全部通过' : '✗ 存在失败'));
