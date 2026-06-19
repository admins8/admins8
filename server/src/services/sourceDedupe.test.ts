import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateSourceIds, normalizeSourceUrlForDedupe } from './sourceDedupe';

test('normalizeSourceUrlForDedupe trims hash, slash and default port', () => {
  assert.equal(
    normalizeSourceUrlForDedupe(' HTTPS://Example.com:443/api/source/ '),
    'https://example.com/api/source'
  );
  assert.equal(
    normalizeSourceUrlForDedupe('http://example.com:80/api/source/#abc'),
    'http://example.com/api/source'
  );
});

test('findDuplicateSourceIds keeps first source for same normalized url', () => {
  const ids = findDuplicateSourceIds([
    { id: 1, book_source_url: 'https://example.com/source/' },
    { id: 2, book_source_url: 'https://example.com/source' },
    { id: 3, book_source_url: 'https://other.com/source' },
  ]);

  assert.deepEqual(ids, [2]);
});
