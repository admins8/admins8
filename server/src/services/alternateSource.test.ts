import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlternateSourceResult } from './alternateSource';
import type { SearchBookResult } from './webBookService';

function makeSearchBookResult(value: Partial<SearchBookResult>): SearchBookResult {
  return {
    name: '书名',
    author: '作者',
    bookUrl: 'https://example.com/book',
    coverUrl: '',
    intro: '',
    kind: '',
    latestChapterTitle: '',
    wordCount: '',
    origin: '',
    originName: '',
    type: 0,
    ...value,
  };
}

test('当前阅读书源会被标记为当前阅读', () => {
  const book = {
    book_url: 'https://current.example/book',
    origin: 'https://source.example',
    author: '作者',
  };
  const matched = makeSearchBookResult({
    bookUrl: 'https://current.example/book',
    name: '书名',
    author: '作者',
  });
  const source = {
    book_source_url: 'https://source.example',
    book_source_name: '当前源',
  };

  const result = buildAlternateSourceResult(matched, source, book);

  assert.equal(result.isCurrentSource, true);
  assert.equal(result.sourceName, '当前源');
});

test('非当前阅读书源不会被标记', () => {
  const book = {
    book_url: 'https://current.example/book',
    origin: 'https://source-a.example',
    author: '作者',
  };
  const matched = makeSearchBookResult({
    bookUrl: 'https://other.example/book',
    name: '书名',
    author: '作者',
  });
  const source = {
    book_source_url: 'https://source-b.example',
    book_source_name: '其它源',
  };

  const result = buildAlternateSourceResult(matched, source, book);

  assert.equal(result.isCurrentSource, false);
  assert.equal(result.matchScore, 2);
});
