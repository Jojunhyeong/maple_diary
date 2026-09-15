import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEquipmentGuideIndex } from './equipment-guide-index-policy.mjs';

const entries = Array.from({ length: 120 }, (_, index) => ({ ocid: `id-${index}`, job: `직업-${index % 30}`, power: 50_000_000 + index }));
const index = { schemaVersion: 1, date: '2026-09-14', sampleCount: entries.length, entries };

test('validates a complete character index', () => {
  assert.deepEqual(validateEquipmentGuideIndex(index, index.date, null), { date: index.date, sampleCount: 120, jobs: 30 });
});

test('rejects duplicates and large weekly drops', () => {
  assert.throws(() => validateEquipmentGuideIndex({ ...index, entries: [...entries.slice(0, -1), entries[0]] }, index.date, null));
  assert.throws(() => validateEquipmentGuideIndex(index, index.date, { sampleCount: 1_000 }));
});
