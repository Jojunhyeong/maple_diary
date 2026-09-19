import test from 'node:test';
import assert from 'node:assert/strict';
import { rankingClassFilters, rankingIndexPages, rankingJobIndexPages } from './equipment-guide-plan.mjs';
import { equipmentGuideBucket, equipmentGuideCacheKey, isWithinEquipmentGuidePowerRange, selectEquipmentCandidates, selectEquipmentPowerCohort } from '../src/widgets/equipment-guide/cohort.ts';

test('ranking index visits top and deep ranking bands without duplicates', () => {
  const pages = rankingIndexPages();
  assert.equal(pages[0], 1);
  assert.ok(pages.includes(1_000));
  assert.equal(pages.at(-1), 5_000);
  assert.equal(new Set(pages).size, pages.length);
});

test('job-balanced index samples separated ranking depths', () => {
  assert.deepEqual(rankingJobIndexPages(), [1, 5, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000]);
  assert.deepEqual(rankingJobIndexPages('3,1,3'), [3, 1]);
});

test('ranking class probes include explorer, resistance and new class families', () => {
  const filters = rankingClassFilters();
  assert.ok(filters.includes('마법사-비숍'));
  assert.ok(filters.includes('레지스탕스-메카닉'));
  assert.ok(filters.includes('렌-전체 전직'));
  assert.ok(filters.includes('레테-전체 전직'));
  assert.equal(new Set(filters).size, filters.length);
});

test('nearby searches share a narrow 100k cache bucket', () => {
  assert.equal(equipmentGuideBucket(104_040_000), 104_000_000);
  assert.equal(equipmentGuideCacheKey('히어로', 111_040_000), 'v12:히어로:111000000');
  assert.equal(equipmentGuideCacheKey('히어로', 111_040_000, '2026-09-18'), 'v12:히어로:111000000:2026-09-18');
});

test('candidate selection keeps the nearest same-job rows without a fixed distance cutoff', () => {
  const entries = [
    { ocid: 'far', job: '히어로', power: 140_000_000 },
    { ocid: 'other', job: '비숍', power: 100_000_000 },
    { ocid: 'near', job: '히어로', power: 102_000_000 },
    { ocid: 'edge', job: '히어로', power: 90_000_000 },
  ];
  assert.deepEqual(selectEquipmentCandidates(entries, '히어로', 100_000_000).map(row => row.ocid), ['near', 'edge', 'far']);
});

test('live samples stay within exactly 20m of the requested power', () => {
  assert.equal(isWithinEquipmentGuidePowerRange(120_000_000, 100_000_000), true);
  assert.equal(isWithinEquipmentGuidePowerRange(120_000_001, 100_000_000), false);
  assert.equal(isWithinEquipmentGuidePowerRange(280_000_000, 300_000_000), true);
  assert.equal(isWithinEquipmentGuidePowerRange(279_999_999, 300_000_000), false);
});

test('power cohort never expands beyond 20m even when fewer than ten samples remain', () => {
  const rows = [98, 101, 110, 70, 130, 140, 150, 160, 170, 180, 190, 200].map((power, index) => ({ id: index, power: power * 1_000_000 }));
  const selected = selectEquipmentPowerCohort(rows, 100_000_000);
  assert.equal(selected.length, 3);
  assert.deepEqual(selected.slice(0, 3).map(row => row.power), [101_000_000, 98_000_000, 110_000_000]);
});

test('power cohort caps matching samples at thirty', () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({ power: (90 + index / 2) * 1_000_000 }));
  assert.equal(selectEquipmentPowerCohort(rows, 100_000_000).length, 30);
});
