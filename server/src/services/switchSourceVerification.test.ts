import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySwitchTargetReadable } from './switchSourceVerification';

test('换源校验只验证目录可用，不在切换阶段验证正文', async () => {
  let contentCalls = 0;
  const result = await verifySwitchTargetReadable(
    { bookUrl: 'https://example.com/book/1', sourceUrl: 'https://source.example' },
    0,
    {
      findSourceByUrl: async () => ({ book_source_url: 'https://source.example' }),
      createEngine: () => ({
        getChapterList: async () => [
          { title: '第一章 正文', url: 'https://example.com/1.html', index: 0 },
        ],
        getContent: async () => {
          contentCalls++;
          return '';
        },
      }),
    }
  );

  assert.equal(result.ok, true);
  assert.equal(contentCalls, 0);
});
