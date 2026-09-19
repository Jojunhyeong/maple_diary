import type { EquipmentCharacterIndexEntry } from './model';

export const EQUIPMENT_GUIDE_BUCKET_SIZE = 100_000;
export const EQUIPMENT_GUIDE_CACHE_DAYS = 7;
export const EQUIPMENT_GUIDE_POWER_DISTANCE = 20_000_000;
const EQUIPMENT_GUIDE_CACHE_VERSION = 'v12';

export function equipmentGuideBucket(power: number) {
  return Math.max(EQUIPMENT_GUIDE_BUCKET_SIZE, Math.round(power / EQUIPMENT_GUIDE_BUCKET_SIZE) * EQUIPMENT_GUIDE_BUCKET_SIZE);
}

export function equipmentGuideCacheKey(job: string, power: number, sourceDate?: string) {
  const base = `${EQUIPMENT_GUIDE_CACHE_VERSION}:${job.trim()}:${equipmentGuideBucket(power)}`;
  return sourceDate ? `${base}:${sourceDate}` : base;
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

export function isWithinEquipmentGuidePowerRange(candidatePower: number, targetPower: number) {
  return Math.abs(candidatePower - targetPower) <= EQUIPMENT_GUIDE_POWER_DISTANCE;
}

export function selectEquipmentPowerCohort<T extends { power: number }>(
  entries: readonly T[],
  targetPower: number,
  limit = 30,
) {
  return [...entries]
    .filter(entry => isWithinEquipmentGuidePowerRange(entry.power, targetPower))
    .sort((a, b) => Math.abs(a.power - targetPower) - Math.abs(b.power - targetPower) || a.power - b.power)
    .slice(0, limit);
}
