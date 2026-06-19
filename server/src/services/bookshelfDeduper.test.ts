import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeBookshelfRows, getBookIdentityKey } from './bookshelfDeduper';

test('同名同作者生成相同书籍身份 key，忽略大小写和空格', () => {
  assert.equal(
    getBookIdentityKey({ name: '  诡秘  之主 ', author: ' 爱潜水的乌贼 ' }),
    getBookIdentityKey({ name: '诡秘之主', author: '爱潜水的乌贼' })
  );
});

test('书架同名同作者去重，保留最近阅读记录', () => {
  const rows = [
    {
      name: '诡秘之主',
      author: '爱潜水的乌贼',
      bookUrl: 'old',
      durChapterTime: '2024-01-01 00:00:00',
    },
    {
      name: '诡秘 之主',
      author: '爱潜水的乌贼',
      bookUrl: 'new',
      durChapterTime: '2024-02-01 00:00:00',
    },
    {
      name: '宿命之环',
      author: '爱潜水的乌贼',
      bookUrl: 'other',
      durChapterTime: '2024-01-15 00:00:00',
    },
  ];

  const result = dedupeBookshelfRows(rows);

  assert.equal(result.length, 2);
  assert.equal(result[0].bookUrl, 'new');
  assert.equal(result[1].bookUrl, 'other');
});
