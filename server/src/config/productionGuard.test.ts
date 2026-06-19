import test from 'node:test'
import assert from 'node:assert/strict'
import { validateNativeModuleState, validateProductionConfig } from './productionGuard'

test('validateProductionConfig allows non-production defaults as warnings', () => {
  const result = validateProductionConfig({
    nodeEnv: 'development',
    jwtSecret: 'legado-web-secret-key-change-in-production',
    adminPassword: 'admin123',
    licensePath: 'missing/license.lic',
    sourceJsEnabled: false,
    redisEnabled: false,
  })
  assert.equal(result.ok, true)
  assert.ok(result.warnings.length >= 1)
})

test('validateProductionConfig rejects default JWT_SECRET in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'CHANGE_ME_IN_PRODUCTION',
    adminPassword: 'StrongerPassword123!',
    licensePath: __filename,
    sourceJsEnabled: false,
    redisEnabled: true,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /JWT_SECRET/)
})

test('validateProductionConfig rejects default admin password in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret-with-enough-length',
    adminPassword: 'admin123',
    licensePath: __filename,
    sourceJsEnabled: false,
    redisEnabled: true,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /ADMIN_PASSWORD/)
})

test('validateProductionConfig rejects missing license in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret-with-enough-length',
    adminPassword: 'StrongerPassword123!',
    licensePath: 'missing/license.lic',
    sourceJsEnabled: false,
    redisEnabled: true,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /license/)
})

test('validateProductionConfig rejects disabled Redis in production', () => {
  const result = validateProductionConfig({
    nodeEnv: 'production',
    jwtSecret: 'a-production-secret-with-enough-length',
    adminPassword: 'StrongerPassword123!',
    licensePath: __filename,
    sourceJsEnabled: false,
    redisEnabled: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /Redis/)
})

test('validateNativeModuleState only warns when source JS is disabled', () => {
  const result = validateNativeModuleState({
    sourceJsEnabled: false,
    isolatedVmAvailable: false,
  })
  assert.equal(result.ok, true)
  assert.match(result.warnings.join('\n'), /isolated-vm/)
})

test('validateNativeModuleState fails when source JS is enabled and isolated-vm is unavailable', () => {
  const result = validateNativeModuleState({
    sourceJsEnabled: true,
    isolatedVmAvailable: false,
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /npm rebuild isolated-vm/)
})
