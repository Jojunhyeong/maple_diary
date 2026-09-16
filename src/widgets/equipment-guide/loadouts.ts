import type { EquipmentGuideSetEffect } from './model';

type RawSetEffect = { set_name?: unknown; total_set_count?: unknown };
export type RepresentativeCandidate = {
  ocid: string;
  power: number;
  setEffects: EquipmentGuideSetEffect[];
  itemSignature: string;
};

const EQUIPMENT_SET_NAMES = [
  '에테르넬', '아케인셰이드', '앱솔랩스', '루타비스', '칠흑의 보스',
  '여명의 보스', '보스 장신구', '마이스터', '칠요', '여제', '네크로',
];

export function normalizeEquipmentSetEffects(payload: Record<string, unknown>): EquipmentGuideSetEffect[] {
  if (!Array.isArray(payload.set_effect)) return [];
  return (payload.set_effect as RawSetEffect[]).flatMap(effect => {
    const name = typeof effect.set_name === 'string' ? effect.set_name : '';
    const count = Number(effect.total_set_count);
    return EQUIPMENT_SET_NAMES.some(keyword => name.includes(keyword)) && Number.isFinite(count) && count >= 2
      ? [{ name: name.replace(/\s*세트(?:\(.+\))?$/, ''), count }]
      : [];
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function setEffectSignature(effects: readonly EquipmentGuideSetEffect[]) {
  return effects.map(effect => `${effect.name}:${effect.count}`).sort().join('|') || '세트 효과 없음';
}

export function selectRepresentativeCandidates<T extends RepresentativeCandidate>(rows: readonly T[], targetPower: number, limit = 5) {
  const nearest = [...rows].sort((a, b) => Math.abs(a.power - targetPower) - Math.abs(b.power - targetPower) || a.power - b.power || a.ocid.localeCompare(b.ocid));
  const selected: T[] = [];
  const usedSets = new Set<string>();
  const usedItems = new Set<string>();
  for (const row of nearest) {
    const signature = setEffectSignature(row.setEffects);
    if (usedSets.has(signature)) continue;
    selected.push(row);
    usedSets.add(signature);
    usedItems.add(row.itemSignature);
    if (selected.length === limit) return selected;
  }
  for (const row of nearest) {
    if (selected.includes(row) || usedItems.has(row.itemSignature)) continue;
    selected.push(row);
    usedItems.add(row.itemSignature);
    if (selected.length === limit) break;
  }
  return selected;
}
