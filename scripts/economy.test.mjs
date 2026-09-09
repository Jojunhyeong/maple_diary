import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEconomy, estimateGoalWeeks } from '../src/shared/lib/utils/economy.ts';

const entry = (kind, date, income, expense, category) => ({ id: `${kind}-${date}`, title: kind, kind, date, income, expense, category });

test('net includes all income sources and subtracts hunting costs and expenses once', () => {
  const result = summarizeEconomy([
    entry('hunting', '2026-09-07', 840_000_000, 30_000_000),
    entry('boss', '2026-09-10', 1_220_000_000, 0),
    entry('gathering', '2026-09-09', 130_000_000, 0),
    entry('expense', '2026-09-08', 0, 780_000_000, '스타포스'),
    entry('hunting', '2026-09-06', 999_000_000, 0),
    entry('expense', '2026-09-14', 0, 999_000_000),
  ], '2026-09-07', '2026-09-13');
  assert.equal(result.income, 2_190_000_000);
  assert.equal(result.expense, 810_000_000);
  assert.equal(result.net, 1_380_000_000);
  assert.deepEqual(result.categories, { '사냥 재료비': 30_000_000, '스타포스': 780_000_000 });
});

test('empty periods are zero and loss periods remain negative', () => {
  assert.equal(summarizeEconomy([], '2026-09-01', '2026-09-30').net, 0);
  const result = summarizeEconomy([entry('expense', '2026-09-01', 0, 900)], '2026-09-01', '2026-09-01');
  assert.equal(result.net, -900);
  assert.equal(result.entries.length, 1);
});

test('monthly settlements are assigned only to their saved period key', () => {
  const entries = [{ ...entry('boss', '2026-09-01', 500, 0), period: 'monthly' }];
  assert.equal(summarizeEconomy(entries, '2026-09-07', '2026-09-13').sources.boss, 0);
  assert.equal(summarizeEconomy(entries, '2026-09-01', '2026-09-30').sources.boss, 500);
});

test('goal estimate rounds up and has no forecast for zero or negative pace', () => {
  assert.equal(estimateGoalWeeks(6_600_000_000, 1_100_000_000), 6);
  assert.equal(estimateGoalWeeks(6_700_000_000, 1_100_000_000), 7);
  assert.equal(estimateGoalWeeks(1, 0), null);
  assert.equal(estimateGoalWeeks(1, -100), null);
  assert.equal(estimateGoalWeeks(0, 100), 0);
});
