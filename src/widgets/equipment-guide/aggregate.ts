import type { EquipmentGuideStat, EquipmentSlotId, GradeDistribution } from './model';

export type ObservedEquipment = Record<string, string | null | undefined>;
export type EquipmentObservation = { ocid: string; job: string; power: number; date: string; items: ObservedEquipment[] };
type Slot = { id: EquipmentSlotId; apiSlot: string };
type Bucket = { id: string; min: number; max: number };
const percent = (count: number, total: number) => total ? Math.round(count / total * 1000) / 10 : 0;

const FARMING_POTENTIALS = ['아이템 드롭률', '메소 획득량'];

export function hasFarmingPotential(observation: EquipmentObservation) {
  return observation.items.some(item => [
    item.potential_option_1,
    item.potential_option_2,
    item.potential_option_3,
    item.additional_potential_option_1,
    item.additional_potential_option_2,
    item.additional_potential_option_3,
  ].some(value => value && FARMING_POTENTIALS.some(keyword => value.replaceAll(' ', '').includes(keyword.replaceAll(' ', '')))));
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

export function aggregateEquipment(observations: EquipmentObservation[], slots: readonly Slot[], buckets: readonly Bucket[]) {
  const grouped = new Map<string, { job: string; bucket: string; slot: EquipmentSlotId; date: string; rows: ObservedEquipment[] }>();
  // One latest observation per character; reruns never inflate sample counts.
  const unique = new Map<string, EquipmentObservation>();
  for (const observation of observations) if (!unique.has(observation.ocid) || unique.get(observation.ocid)!.date < observation.date) unique.set(observation.ocid, observation);
  for (const observation of unique.values()) {
    // A farming preset lowers combat power and contaminates every equipped-slot comparison.
    if (hasFarmingPotential(observation)) continue;
    const bucket = buckets.find((b, i) => observation.power >= b.min && (observation.power < b.max || (i === buckets.length - 1 && observation.power === b.max)));
    if (!bucket) continue;
    for (const slot of slots) {
      const row = observation.items.find(item => item.item_equipment_slot === slot.apiSlot);
      if (!row?.item_name) continue;
      const key = `${observation.job}:${bucket.id}:${slot.id}`;
      const group = grouped.get(key) ?? { job: observation.job, bucket: bucket.id, slot: slot.id, date: observation.date, rows: [] };
      group.rows.push(row);
      if (observation.date > group.date) group.date = observation.date;
      grouped.set(key, group);
    }
  }
  const stats: EquipmentGuideStat[] = [];
  for (const group of grouped.values()) {
    const counts = new Map<string, { count: number; icon?: string }>();
    for (const row of group.rows) {
      const previous = counts.get(row.item_name!);
      counts.set(row.item_name!, { count: (previous?.count ?? 0) + 1, icon: row.item_icon || previous?.icon });
    }
    const items = [...counts].map(([itemName, value]) => ({ itemName, itemIcon: value.icon, count: value.count, ratio: percent(value.count, group.rows.length) })).sort((a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName));
    const representative = group.rows.filter(row => row.item_name === items[0].itemName);
    const stars = representative.flatMap(row => row.starforce != null && row.starforce !== '' && Number.isFinite(Number(row.starforce)) ? [Number(row.starforce)] : []).sort((a, b) => a - b);
    const middle = Math.floor(stars.length / 2);
    stats.push({ job: group.job, combatPowerBucket: group.bucket, slot: group.slot, sampleCount: group.rows.length, items,
      starforce: stars.length ? { average: Math.round(stars.reduce((a, b) => a + b, 0) / stars.length * 10) / 10, median: stars.length % 2 ? stars[middle] : (stars[middle - 1] + stars[middle]) / 2 } : {},
      potential: grades(representative, 'potential_option_grade'), additionalPotential: grades(representative, 'additional_potential_option_grade'),
      potentialOptions: options(representative), additionalPotentialOptions: options(representative, true), updatedAt: group.date,
    });
  }
  return stats;
}
