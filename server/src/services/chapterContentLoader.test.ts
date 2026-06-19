import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapterContentLoadQueue } from './chapterContentLoader';

test('同一章节并发加载只执行一次底层任务', async () => {
  const queue = new ChapterContentLoadQueue();
  let calls = 0;

  const load = () => queue.run('book-a', 1, async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return '正文';
  });

  const [a, b] = await Promise.all([load(), load()]);

  assert.equal(a, '正文');
  assert.equal(b, '正文');
  assert.equal(calls, 1);
});

test('不同章节可以分别执行加载任务', async () => {
  const queue = new ChapterContentLoadQueue();
  let calls = 0;

  await Promise.all([
    queue.run('book-a', 1, async () => { calls++; return '一'; }),
    queue.run('book-a', 2, async () => { calls++; return '二'; }),
  ]);

  assert.equal(calls, 2);
});
