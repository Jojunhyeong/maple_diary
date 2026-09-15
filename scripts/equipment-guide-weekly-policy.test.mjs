import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWeeklySnapshot } from './equipment-guide-weekly-policy.mjs';

const date = '2026-09-14';
const stat = (job, count = 50) => ({ job, cohortPower: 100_000_000, powerMin: 80_000_000, powerMax: 120_000_000, updatedAt: date, sampleCount: count, items: [{ itemName: '테스트', count }] });
const snapshot = (sampleCount, stats = [stat('아델'), stat('비숍')]) => ({ source: 'api', schemaVersion: 2, date, sampleCount, stats });

test('a healthy fresh week can have fewer samples than the previous week', () => {
  const previous = { ...snapshot(200), date: '2026-09-07', stats: [stat('아델'), stat('비숍')].map(row => ({ ...row, updatedAt: '2026-09-07' })) };
  assert.equal(validateWeeklySnapshot(previous, snapshot(150), date).sampleCount, 150);
});
test('rejects old dates, empty results and large drops in sample size', () => {
  assert.throws(() => validateWeeklySnapshot(snapshot(200), snapshot(200), '2026-09-15'));
  assert.throws(() => validateWeeklySnapshot(snapshot(200), snapshot(200, []), date));
  assert.throws(() => validateWeeklySnapshot(snapshot(1000), snapshot(499), date));
  assert.throws(() => validateWeeklySnapshot(null, snapshot(99), date));
});
test('rejects missing cohort coverage and invalid item counts', () => {
  const previous = snapshot(200, [stat('아델'), stat('비숍'), stat('아크')]);
  assert.throws(() => validateWeeklySnapshot(previous, snapshot(200, [stat('아델')]), date));
  assert.throws(() => validateWeeklySnapshot(null, snapshot(200, [{ ...stat('아델'), sampleCount: 51, items: [{ itemName: '테스트', count: 51 }] }]), date));
  assert.throws(() => validateWeeklySnapshot(null, snapshot(200, [{ ...stat('아델'), updatedAt: '2026-09-07' }]), date));
});
