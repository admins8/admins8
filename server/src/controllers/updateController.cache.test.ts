import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.resolve('src/controllers/updateController.ts'), 'utf-8')

test('update version and check endpoints disable browser cache', () => {
  assert.match(source, /function\s+disableUpdateCache/)
  assert.match(source, /Cache-Control',\s*'no-store,\s*no-cache,\s*must-revalidate,\s*proxy-revalidate'/)
  assert.match(source, /export async function getVersion[\s\S]*disableUpdateCache\(res\)/)
  assert.match(source, /export async function check[\s\S]*disableUpdateCache\(res\)/)
})
