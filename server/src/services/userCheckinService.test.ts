import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCheckinMonthRange, getCheckinDateString, normalizeCheckinPoints } from './userCheckinService'

test('getCheckinDateString formats date as yyyy-mm-dd', () => {
  assert.equal(getCheckinDateString(new Date('2026-06-13T20:30:00+08:00')), '2026-06-13')
})

test('normalizeCheckinPoints falls back to daily default', () => {
  assert.equal(normalizeCheckinPoints(undefined), 10)
  assert.equal(normalizeCheckinPoints('20'), 20)
  assert.equal(normalizeCheckinPoints('-1'), 10)
})

test('buildCheckinMonthRange returns first and next month date strings', () => {
  assert.deepEqual(buildCheckinMonthRange('2026-06'), {
    month: '2026-06',
    start: '2026-06-01',
    end: '2026-07-01',
  })
})

test('buildCheckinMonthRange falls back to current month for invalid input', () => {
  const range = buildCheckinMonthRange('bad-value', new Date('2026-08-15T10:00:00+08:00'))
  assert.deepEqual(range, {
    month: '2026-08',
    start: '2026-08-01',
    end: '2026-09-01',
  })
})
