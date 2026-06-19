import test from 'node:test'
import assert from 'node:assert/strict'
import { acquireSearchSlot, SearchConcurrencyPool } from './searchConcurrency'

test('SearchConcurrencyPool acquires up to max slots', () => {
  const pool = new SearchConcurrencyPool(2)
  const first = pool.tryAcquire()
  const second = pool.tryAcquire()

  assert.equal(first.acquired, true)
  assert.equal(second.acquired, true)
  assert.equal(pool.getActiveCount(), 2)
})

test('SearchConcurrencyPool rejects when max slots are occupied', () => {
  const pool = new SearchConcurrencyPool(1)
  const first = pool.tryAcquire()
  const second = pool.tryAcquire()

  assert.equal(first.acquired, true)
  assert.equal(second.acquired, false)
  assert.equal(second.message, '当前搜索人数较多，请稍后')
})

test('SearchConcurrencyPool releases a slot once', () => {
  const pool = new SearchConcurrencyPool(1)
  const first = pool.tryAcquire()
  first.release()
  first.release()

  assert.equal(pool.getActiveCount(), 0)
  assert.equal(pool.tryAcquire().acquired, true)
})

test('acquireSearchSlot uses Redis for cross-instance search concurrency', async () => {
  let count = 0
  const redis: any = {
    async incr() {
      count += 1
      return count
    },
    async decr() {
      count -= 1
      return count
    },
    async expire() {
      return 1
    },
  }

  const first = await acquireSearchSlot(1, async () => redis)
  const second = await acquireSearchSlot(1, async () => redis)

  assert.equal(first.acquired, true)
  assert.equal(second.acquired, false)
  assert.equal(second.message, '当前搜索人数较多，请稍后')

  await first.release()
  assert.equal(count, 0)
})
