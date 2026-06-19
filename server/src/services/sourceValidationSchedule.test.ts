import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceValidationRunKey,
  normalizeSourceValidationSchedule,
  shouldRunSourceValidationSchedule,
} from './sourceValidationSchedule';

test('normalizeSourceValidationSchedule clamps monthly time and failure action', () => {
  const settings = normalizeSourceValidationSchedule({
    source_validate_schedule_enabled: 'true',
    source_validate_schedule_day: '31',
    source_validate_schedule_hour: '25',
    source_validate_schedule_minute: '-2',
    source_validate_schedule_keyword: '  诡秘之主,凡人修仙传  ',
    source_validate_schedule_timeout_ms: '999',
    source_validate_schedule_concurrency: '99',
    source_validate_schedule_failure_action: 'delete',
  });

  assert.equal(settings.enabled, true);
  assert.equal(settings.day, 28);
  assert.equal(settings.hour, 23);
  assert.equal(settings.minute, 0);
  assert.equal(settings.keyword, '诡秘之主,凡人修仙传');
  assert.equal(settings.timeoutMs, 3000);
  assert.equal(settings.concurrency, 10);
  assert.equal(settings.failureAction, 'delete');
});

test('shouldRunSourceValidationSchedule matches configured day hour minute once', () => {
  const settings = normalizeSourceValidationSchedule({
    source_validate_schedule_enabled: '1',
    source_validate_schedule_day: '15',
    source_validate_schedule_hour: '3',
    source_validate_schedule_minute: '30',
  });
  const now = new Date('2026-06-15T03:30:10');
  const key = buildSourceValidationRunKey(now);

  assert.equal(shouldRunSourceValidationSchedule(settings, now, '', false), true);
  assert.equal(shouldRunSourceValidationSchedule(settings, now, key, false), false);
  assert.equal(shouldRunSourceValidationSchedule(settings, now, '', true), false);
  assert.equal(shouldRunSourceValidationSchedule(settings, new Date('2026-06-15T03:31:00'), '', false), false);
});
