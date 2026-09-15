import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankingPages, selectRankingRows, canPublish, isUnavailableCharacter } from './equipment-guide-plan.mjs';

test('expanded scan covers every page through 250 once, including gaps below anchors', () => {
  const iterator = rankingPages();
  const pages = Array.from({ length: 250 }, () => iterator.next().value);
  assert.deepEqual(pages.slice(0, 6), [1, 5, 15, 40, 100, 200]);
  assert.deepEqual([...pages].sort((a, b) => a - b), Array.from({ length: 250 }, (_, i) => i + 1));
});
test('explicit scans are finite, deduplicated and validated', () => {
  assert.deepEqual([...rankingPages('3,1,3')], [3, 1]);
  for (const value of ['0', '1,', '-1', 'NaN', '1.5']) assert.throws(() => [...rankingPages(value)]);
});
test('full-page collection retains all rows and smaller requests remain spread out', () => {
  const rows = Array.from({ length: 200 }, (_, i) => i);
  assert.deepEqual(selectRankingRows(rows, 200), rows);
  assert.deepEqual(selectRankingRows(rows, 4), [0, 50, 100, 150]);
  assert.deepEqual(selectRankingRows([], 200), []);
  assert.deepEqual(selectRankingRows([1, 2], 200), [1, 2]);
  assert.throws(() => selectRankingRows(rows, 201));
});
test('partial and older collections never replace a larger or newer snapshot', () => {
  const previous = { date: '2026-09-10', sampleCount: 154, stats: [{}] };
  assert.equal(canPublish(previous, { ...previous, sampleCount: 155 }), true);
  assert.equal(canPublish(previous, { ...previous, date: '2026-09-11', sampleCount: 20 }), false);
  assert.equal(canPublish(previous, { ...previous, date: '2026-09-09', sampleCount: 200 }), false);
  assert.equal(canPublish(previous, { ...previous, stats: [] }), false);
});
test('invalid keys and prepared-data errors stop collection instead of silently skipping users', () => {
  assert.equal(isUnavailableCharacter({ status: 400, code: 'OPENAPI00003' }), true);
  assert.equal(isUnavailableCharacter({ status: 404 }), true);
  for (const code of ['OPENAPI00004', 'OPENAPI00005', 'OPENAPI00009', 'OPENAPI00010']) {
    assert.equal(isUnavailableCharacter({ status: 400, code }), false);
  }
});
