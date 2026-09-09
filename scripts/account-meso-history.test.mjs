import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMesoSnapshots, sevenDayMesoBalances } from '../src/shared/lib/utils/account-meso-history.ts';

const today = new Date('2026-09-09T12:00:00');
test('keeps the last explicitly saved daily balance without filling unknown days', () => {
  const days = sevenDayMesoBalances([
    { amount: 100, updatedAt: '2026-09-03T09:00:00' },
    { amount: 180, updatedAt: '2026-09-03T20:00:00' },
    { amount: 200, updatedAt: '2026-09-09T09:00:00' },
  ], today);
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(day => day.amount), [180, null, null, null, null, null, 200]);
  assert.equal(days[0].date, '2026-09-03');
});
test('zero is a recorded balance, distinct from unknown', () => {
  const days = sevenDayMesoBalances([{ amount: 0, updatedAt: '2026-09-09T09:00:00' }], today);
  assert.equal(days[6].amount, 0);
  assert.equal(days[5].amount, null);
});
test('keeps signed record-based balances and deduplicates the same server update', () => {
  const current = { amount: 150, updatedAt: '2026-09-09T09:00:00' };
  const result = mergeMesoSnapshots([
    { amount: -1, updatedAt: '2026-09-08T09:00:00' },
    { amount: 100, updatedAt: 'invalid' },
    current,
  ], current);
  assert.deepEqual(result, [
    { amount: -1, updatedAt: '2026-09-08T09:00:00' },
    current,
  ]);
});
test('does not invent past balances from a latest snapshot or a future snapshot', () => {
  const days = sevenDayMesoBalances([
    { amount: 100, updatedAt: '2026-09-01T09:00:00' },
    { amount: 200, updatedAt: '2026-09-10T09:00:00' },
  ], today);
  assert.ok(days.every(day => day.amount === null));
});
