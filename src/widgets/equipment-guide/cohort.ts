import type { EquipmentCharacterIndexEntry } from './model';

export const EQUIPMENT_GUIDE_BUCKET_SIZE = 10_000_000;
export const EQUIPMENT_GUIDE_CACHE_DAYS = 7;
const EQUIPMENT_GUIDE_CACHE_VERSION = 'v6';

export function equipmentGuideBucket(power: number) {
  return Math.max(EQUIPMENT_GUIDE_BUCKET_SIZE, Math.round(power / EQUIPMENT_GUIDE_BUCKET_SIZE) * EQUIPMENT_GUIDE_BUCKET_SIZE);
}

export function equipmentGuideCacheKey(job: string, power: number) {
  return `${EQUIPMENT_GUIDE_CACHE_VERSION}:${job.trim()}:${equipmentGuideBucket(power)}`;
}

export function selectEquipmentCandidates(
  entries: readonly EquipmentCharacterIndexEntry[],
  job: string,
  power: number,
  limit = 150,
) {
  return entries
    .filter(entry => entry.job === job)
    .sort((a, b) => Math.abs(a.power - power) - Math.abs(b.power - power) || a.power - b.power)
    .slice(0, limit);
}
