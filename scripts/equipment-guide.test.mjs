import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEquipment, hasFarmingPotential, optionLabel } from '../src/widgets/equipment-guide/aggregate.ts';
import { COMBAT_BUCKETS, COMBAT_POWER_COHORTS, EQUIPMENT_SLOTS } from '../src/widgets/equipment-guide/model.ts';
import { selectActiveCharacterProfile } from '../src/shared/lib/character-storage.ts';

test('switching registered characters selects the new job and power instead of the first profile', () => {
  const bishop = { id: 'bishop', character_name: '첫캐릭터', character_class: '비숍', character_combat_power: 100_000_000 };
  const adele = { id: 'adele', character_name: '내아델', character_class: '아델', character_combat_power: 250_000_000 };
  assert.equal(selectActiveCharacterProfile([bishop, adele], 'adele'), adele);
  assert.equal(selectActiveCharacterProfile([bishop, adele], 'adele').character_combat_power, 250_000_000);
  assert.equal(selectActiveCharacterProfile([bishop, { ...adele, is_active: true }], null).character_class, '아델');
  assert.equal(selectActiveCharacterProfile([], null), null);
});

const cohortOptions = { targets: COMBAT_POWER_COHORTS, size: 50, minPower: COMBAT_BUCKETS[0].min, maxPower: COMBAT_BUCKETS.at(-1).max };

const item = (name, starforce, extra = {}) => ({ item_equipment_slot: '모자', item_name: name, starforce: String(starforce), ...extra });
const observation = (ocid, power, items, date = '2026-09-10') => ({ ocid, job: '비숍', power, date, items });
test('maps the actual Nexon mechanical heart slot name', () => {
  const stats = aggregateEquipment([observation('heart', 100_000_000, [{ item_equipment_slot: '기계 심장', item_name: '리퀴드메탈 하트' }])], EQUIPMENT_SLOTS, cohortOptions);
  assert.equal(stats[0].slot, 'heart');
});
test('excludes the entire character when any equipment uses drop or meso farming potential', () => {
  const combat = observation('combat', 100_000_000, [item('전투 모자', 22)]);
  const drop = observation('drop', 100_000_000, [item('드롭 귀고리', 0, { potential_option_2: '아이템 드롭률 : +20%' }), item('오염될 모자', 22)]);
  const meso = observation('meso', 100_000_000, [item('메획 반지', 0, { potential_option_1: '메소 획득량  :  +20%' })]);
  assert.equal(hasFarmingPotential(drop), true);
  assert.equal(hasFarmingPotential(meso), true);
  const stats = aggregateEquipment([combat, drop, meso], EQUIPMENT_SLOTS, cohortOptions);
  assert.equal(stats.length, COMBAT_POWER_COHORTS.length);
  assert.equal(stats[0].sampleCount, 1);
  assert.equal(stats[0].items[0].itemName, '전투 모자');
});
test('deduplicates characters, omits missing slots and keeps the full item denominator', () => {
  const a = observation('a', 100_000_000, [item('A', 17)]);
  const stats = aggregateEquipment([a, a, observation('b', 100_000_000, [item('A', 22)]), observation('c', 100_000_000, [item('B', 10)])], EQUIPMENT_SLOTS, cohortOptions);
  const stat = stats.find(value => value.cohortPower === 100_000_000);
  assert.equal(stat.sampleCount, 3);
  assert.equal(stat.items[0].ratio, 66.7);
  assert.equal(stat.starforce.median, 19.5);
  assert.equal(stat.potentialOptions[0].count, 2);
});
test('builds each comparison from the nearest same-job characters and caps it at 50', () => {
  const rows = Array.from({ length: 60 }, (_, index) => observation(String(index), 50_000_000 + index * 1_000_000, [item(index < 10 ? 'A' : 'B', 17)]));
  const stats = aggregateEquipment(rows, EQUIPMENT_SLOTS, cohortOptions);
  const near100m = stats.find(value => value.cohortPower === 100_000_000);
  assert.equal(near100m.sampleCount, 50);
  assert.equal(near100m.powerMin, 60_000_000);
  assert.equal(near100m.powerMax, 109_000_000);
  assert.equal(near100m.items[0].itemName, 'B');
});
test('sums matching percentages but never adds all-stat or ignore-defense into main stat', () => {
  assert.equal(optionLabel({ potential_option_1: 'INT +10%', potential_option_2: 'INT +7%', potential_option_3: 'INT +7%' }), 'INT +24%');
  assert.equal(optionLabel({ potential_option_1: 'INT : +12%', potential_option_2: 'INT : +9%', potential_option_3: '올스탯 : +6%' }), 'INT +21% · 올스탯 +6%');
  assert.equal(optionLabel({ potential_option_1: '몬스터 방어율 무시 : +40%', potential_option_2: '몬스터 방어율 무시 : +30%' }), '몬스터 방어율 무시 : +30% · 몬스터 방어율 무시 : +40%');
  assert.equal(optionLabel({ additional_potential_option_1: '마력 : +12%', additional_potential_option_2: '마력 : +9%', additional_potential_option_3: 'INT : +20' }, true), '마력 +21% · INT : +20');
});
test('latest observation replaces earlier equipment and missing starforce is not zero', () => {
  const stats = aggregateEquipment([observation('a', 100_000_000, [item('old', 22)], '2026-09-09'), observation('a', 100_000_000, [item('new', '', { starforce: null })])], EQUIPMENT_SLOTS, cohortOptions);
  assert.equal(stats[0].items[0].itemName, 'new');
  assert.deepEqual(stats[0].starforce, {});
});
