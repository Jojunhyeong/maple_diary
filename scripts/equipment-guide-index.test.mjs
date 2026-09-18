import test from 'node:test';
import assert from 'node:assert/strict';
import { rankingClassFilters, rankingIndexPages, rankingJobIndexPages } from './equipment-guide-plan.mjs';
import { equipmentGuideBucket, equipmentGuideCacheKey, isWithinEquipmentGuidePowerRange, selectEquipmentCandidates } from '../src/widgets/equipment-guide/cohort.ts';

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

test('nearby searches share a 25m cache bucket', () => {
  assert.equal(equipmentGuideBucket(104_000_000), 100_000_000);
  assert.equal(equipmentGuideCacheKey('히어로', 111_000_000), 'v8:히어로:100000000');
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

test('live samples reject power outside the 15 percent range', () => {
  assert.equal(isWithinEquipmentGuidePowerRange(125_000_000, 100_000_000), true);
  assert.equal(isWithinEquipmentGuidePowerRange(125_000_001, 100_000_000), false);
  assert.equal(isWithinEquipmentGuidePowerRange(255_000_000, 300_000_000), true);
  assert.equal(isWithinEquipmentGuidePowerRange(254_999_999, 300_000_000), false);
});
