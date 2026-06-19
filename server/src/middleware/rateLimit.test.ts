import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from './rateLimit'

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  return res
}

test('createRateLimiter limits using Redis when Redis is available', async () => {
  const counts = new Map<string, number>()
  const redis: any = {
    async incr(key: string) {
      const next = (counts.get(key) || 0) + 1
      counts.set(key, next)
      return next
    },
    async expire() {
      return 1
    },
  }
  const limiter = createRateLimiter(60000, 1, async () => redis)

  let nextCount = 0
  const req: any = { ip: '1.2.3.4', socket: {} }
  await limiter(req, mockRes(), () => { nextCount++ })

  const res = mockRes()
  await limiter(req, res, () => { nextCount++ })

  assert.equal(nextCount, 1)
  assert.equal(res.statusCode, 429)
})

test('createRateLimiter falls back to memory when Redis is unavailable', async () => {
  const limiter = createRateLimiter(60000, 1, async () => null)

  let nextCount = 0
  const req: any = { ip: '5.6.7.8', socket: {} }
  await limiter(req, mockRes(), () => { nextCount++ })

  const res = mockRes()
  await limiter(req, res, () => { nextCount++ })

  assert.equal(nextCount, 1)
  assert.equal(res.statusCode, 429)
})
