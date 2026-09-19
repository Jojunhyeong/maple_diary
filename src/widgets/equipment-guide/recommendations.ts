import type { EquipmentGuideStat, EquipmentSlotId } from './model';

const DISTINCT_SLOT_GROUPS: readonly (readonly EquipmentSlotId[])[] = [
  ['ring1', 'ring2', 'ring3', 'ring4'],
  ['pendant1', 'pendant2'],
];

export function assignDistinctSlotItems(stats: readonly EquipmentGuideStat[]) {
  const assigned = stats.map(stat => ({ ...stat, items: [...stat.items] }));
  for (const group of DISTINCT_SLOT_GROUPS) {
    const used = new Set<string>();
    for (const slot of group) {
      const stat = assigned.find(value => value.slot === slot);
      if (!stat) continue;
      const available = stat.items.filter(item => !used.has(item.itemName));
      if (!available.length) {
        stat.items = [];
        continue;
      }
      stat.items = available;
      used.add(available[0].itemName);
    }
  }
  return assigned;
}
