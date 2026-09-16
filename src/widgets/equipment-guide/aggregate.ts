import type { EquipmentGuideStat, EquipmentSlotId, GradeDistribution } from './model';

export type ObservedEquipment = Record<string, string | null | undefined>;
export type EquipmentObservation = { ocid: string; job: string; power: number; date: string; items: ObservedEquipment[] };
type Slot = { id: EquipmentSlotId; apiSlot: string };
type CohortOptions = { targets: readonly number[]; size: number; minPower: number; maxPower: number };
const percent = (count: number, total: number) => total ? Math.round(count / total * 1000) / 10 : 0;

const FARMING_POTENTIALS = ['아이템 드롭률', '메소 획득량'];

export function itemsHaveFarmingPotential(items: ObservedEquipment[]) {
  return items.some(item => [
    item.potential_option_1,
    item.potential_option_2,
    item.potential_option_3,
    item.additional_potential_option_1,
    item.additional_potential_option_2,
    item.additional_potential_option_3,
  ].some(value => value && FARMING_POTENTIALS.some(keyword => value.replaceAll(' ', '').includes(keyword.replaceAll(' ', '')))));
}

export function hasFarmingPotential(observation: EquipmentObservation) {
  return itemsHaveFarmingPotential(observation.items);
}

function equipmentScore(items: ObservedEquipment[]) {
  const grades: Record<string, number> = { 레전드리: 4, 유니크: 3, 에픽: 2, 레어: 1 };
  return items.reduce((score, item) => score
    + (Number(item.starforce) || 0) * 10
    + (grades[item.potential_option_grade ?? ''] ?? 0) * 3
    + (grades[item.additional_potential_option_grade ?? ''] ?? 0), 0);
}

export function selectNonFarmingEquipmentPreset(payload: Record<string, unknown>) {
  const presets = [1, 2, 3].flatMap(presetNo => {
    const items = payload[`item_equipment_preset_${presetNo}`];
    return Array.isArray(items) && items.length ? [{ presetNo, items: items as ObservedEquipment[] }] : [];
  });
  if (!presets.length && Array.isArray(payload.item_equipment) && payload.item_equipment.length) {
    presets.push({ presetNo: Number(payload.preset_no) || 0, items: payload.item_equipment as ObservedEquipment[] });
  }
  return presets
    .filter(preset => !itemsHaveFarmingPotential(preset.items))
    .sort((a, b) => equipmentScore(b.items) - equipmentScore(a.items) || a.presetNo - b.presetNo)[0] ?? null;
}

// Only add identical percentage options. Flat stats and conditional effects stay separate.
export function optionLabel(item: ObservedEquipment, additional = false) {
  const prefix = additional ? 'additional_potential_option_' : 'potential_option_';
  const sums = new Map<string, number>();
  const other: string[] = [];
  for (const index of [1, 2, 3]) {
    const value = item[prefix + index]?.trim();
    if (!value) continue;
    const match = value.match(/^(.+?)\s*(?::\s*)?\+\s*(\d+(?:\.\d+)?)%$/);
    // Ignore defense combines multiplicatively; preserve the original lines.
    if (match && !match[1].includes('무시')) sums.set(match[1].trim(), (sums.get(match[1].trim()) ?? 0) + Number(match[2]));
    else other.push(value);
  }
  return [...[...sums].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key} +${value}%`), ...other.sort()].join(' · ') || '옵션 없음';
}

function options(rows: ObservedEquipment[], additional = false) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = optionLabel(row, additional);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count, ratio: percent(count, rows.length) })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function grades(rows: ObservedEquipment[], field: string): GradeDistribution {
  const keys: Record<string, keyof GradeDistribution> = { '레전드리': 'legendary', '유니크': 'unique', '에픽': 'epic', '레어': 'rare' };
  const counts: GradeDistribution = { legendary: 0, unique: 0, epic: 0, rare: 0, other: 0 };
  for (const row of rows) { const key = keys[row[field] ?? ''] ?? 'other'; counts[key] = (counts[key] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, percent(count, rows.length)])) as GradeDistribution;
}

function itemDetails(rows: ObservedEquipment[]) {
  const stars = rows.flatMap(row => row.starforce != null && row.starforce !== '' && Number.isFinite(Number(row.starforce)) ? [Number(row.starforce)] : []).sort((a, b) => a - b);
  const middle = Math.floor(stars.length / 2);
  return {
    starforce: stars.length ? { average: Math.round(stars.reduce((a, b) => a + b, 0) / stars.length * 10) / 10, median: stars.length % 2 ? stars[middle] : (stars[middle - 1] + stars[middle]) / 2 } : {},
    potential: grades(rows, 'potential_option_grade'),
    additionalPotential: grades(rows, 'additional_potential_option_grade'),
    potentialOptions: options(rows),
    additionalPotentialOptions: options(rows, true),
  };
}

export function aggregateEquipment(observations: EquipmentObservation[], slots: readonly Slot[], cohort: CohortOptions) {
  const grouped = new Map<string, { job: string; cohortPower: number; powerMin: number; powerMax: number; slot: EquipmentSlotId; date: string; rows: ObservedEquipment[] }>();
  // One latest observation per character; reruns never inflate sample counts.
  const unique = new Map<string, EquipmentObservation>();
  for (const observation of observations) if (!unique.has(observation.ocid) || unique.get(observation.ocid)!.date < observation.date) unique.set(observation.ocid, observation);
  const byJob = new Map<string, EquipmentObservation[]>();
  for (const observation of unique.values()) {
    if (hasFarmingPotential(observation) || observation.power < cohort.minPower || observation.power > cohort.maxPower) continue;
    const rows = byJob.get(observation.job) ?? [];
    rows.push(observation);
    byJob.set(observation.job, rows);
  }
  for (const [job, jobRows] of byJob) for (const target of cohort.targets) {
    const nearest = [...jobRows].sort((a, b) => Math.abs(a.power - target) - Math.abs(b.power - target) || a.power - b.power || a.ocid.localeCompare(b.ocid)).slice(0, cohort.size);
    if (!nearest.length) continue;
    const powerMin = Math.min(...nearest.map(row => row.power));
    const powerMax = Math.max(...nearest.map(row => row.power));
    for (const slot of slots) {
      const rows = nearest.flatMap(observation => {
        const row = observation.items.find(item => item.item_equipment_slot === slot.apiSlot);
        return row?.item_name ? [row] : [];
      });
      if (!rows.length) continue;
      grouped.set(`${job}:${target}:${slot.id}`, { job, cohortPower: target, powerMin, powerMax, slot: slot.id, date: nearest.reduce((latest, row) => row.date > latest ? row.date : latest, nearest[0].date), rows });
    }
  }
  const stats: EquipmentGuideStat[] = [];
  for (const group of grouped.values()) {
    const counts = new Map<string, { count: number; icon?: string }>();
    for (const row of group.rows) {
      const previous = counts.get(row.item_name!);
      counts.set(row.item_name!, { count: (previous?.count ?? 0) + 1, icon: row.item_icon || previous?.icon });
    }
    const rankedItems = [...counts].map(([itemName, value]) => ({ itemName, itemIcon: value.icon, count: value.count, ratio: percent(value.count, group.rows.length) }))
      .sort((a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName))
      .slice(0, 3);
    const items = rankedItems.map(item => {
      const { itemName } = item;
      const representative = group.rows.filter(row => row.item_name === itemName);
      return { ...item, ...itemDetails(representative) };
    });
    const top = items[0];
    stats.push({ job: group.job, cohortPower: group.cohortPower, powerMin: group.powerMin, powerMax: group.powerMax, slot: group.slot, sampleCount: group.rows.length, items,
      starforce: top.starforce, potential: top.potential, additionalPotential: top.additionalPotential,
      potentialOptions: top.potentialOptions, additionalPotentialOptions: top.additionalPotentialOptions, updatedAt: group.date,
    });
  }
  return stats;
}
