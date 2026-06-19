import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const controllerSource = fs.readFileSync(path.resolve('src/controllers/siteConfigController.ts'), 'utf-8')
const routeSource = fs.readFileSync(path.resolve('src/routes/siteConfig.ts'), 'utf-8')

test('site config exposes admin proxy test endpoint', () => {
  assert.match(controllerSource, /export async function testProxyConfig/)
  assert.match(controllerSource, /testSearchProxyPool/)
  assert.match(routeSource, /router\.post\('\/proxy\/test',\s*testProxyConfig\)/)
})
