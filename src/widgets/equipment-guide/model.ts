export const COMBAT_BUCKETS = Array.from({ length: 27 }, (_, index) => {
  const min = (index + 1) * 50_000_000;
  const max = min + 50_000_000;
  return { id: `${min / 1_000_000}m-${max / 1_000_000}m`, label: `${min === 50_000_000 ? '5천만' : min / 100_000_000 + '억'} ~ ${max / 100_000_000}억`, min, max };
});
export const MIN_SAMPLE_COUNT = 30;
export const COHORT_TARGET_SIZE = 50;
export const COMBAT_POWER_COHORTS = Array.from({ length: 28 }, (_, index) => (index + 1) * 50_000_000);
// Grid coordinates and Nexon equipment slot names are kept together.
export const EQUIPMENT_SLOTS = [
  { id: 'ring1', label: '반지 1', apiSlot: '반지1', part: '반지', col: 1, row: 1 },
  { id: 'ring2', label: '반지 2', apiSlot: '반지2', part: '반지', col: 1, row: 2 },
  { id: 'ring3', label: '반지 3', apiSlot: '반지3', part: '반지', col: 1, row: 3 },
  { id: 'ring4', label: '반지 4', apiSlot: '반지4', part: '반지', col: 1, row: 4 },
  { id: 'pendant1', label: '펜던트 1', apiSlot: '펜던트', part: '펜던트', col: 2, row: 1 },
  { id: 'pendant2', label: '펜던트 2', apiSlot: '펜던트2', part: '펜던트', col: 2, row: 2 },
  { id: 'face', label: '얼굴장식', apiSlot: '얼굴장식', part: '얼굴장식', col: 2, row: 3 },
  { id: 'eye', label: '눈장식', apiSlot: '눈장식', part: '눈장식', col: 2, row: 4 },
  { id: 'ear', label: '귀고리', apiSlot: '귀고리', part: '귀고리', col: 2, row: 5 },
  { id: 'hat', label: '모자', apiSlot: '모자', part: '모자', col: 5, row: 1 },
  { id: 'cape', label: '망토', apiSlot: '망토', part: '망토', col: 6, row: 1 },
  { id: 'top', label: '상의', apiSlot: '상의', part: '상의', col: 5, row: 2 },
  { id: 'shoulder', label: '어깨장식', apiSlot: '어깨장식', part: '어깨장식', col: 6, row: 2 },
  { id: 'bottom', label: '하의', apiSlot: '하의', part: '하의', col: 5, row: 3 },
  { id: 'shoes', label: '신발', apiSlot: '신발', part: '신발', col: 6, row: 3 },
  { id: 'gloves', label: '장갑', apiSlot: '장갑', part: '장갑', col: 5, row: 4 },
  { id: 'heart', label: '기계심장', apiSlot: '기계 심장', part: '기계심장', col: 6, row: 4 },
  { id: 'weapon', label: '무기', apiSlot: '무기', part: '무기', col: 1, row: 6 },
  { id: 'secondary', label: '보조무기', apiSlot: '보조무기', part: '보조 무기', col: 2, row: 6 },
  { id: 'emblem', label: '엠블렘', apiSlot: '엠블렘', part: '엠블렘', col: 3, row: 6 },
  { id: 'belt', label: '벨트', apiSlot: '벨트', part: '벨트', col: 4, row: 6 },
  { id: 'badge', label: '뱃지', apiSlot: '뱃지', part: '뱃지', col: 5, row: 6 },
  { id: 'pocket', label: '포켓', apiSlot: '포켓 아이템', part: '포켓 아이템', col: 6, row: 6 },
] as const;
export type EquipmentSlotId = typeof EQUIPMENT_SLOTS[number]['id'];
export type GradeDistribution = { legendary: number; unique: number; epic: number; rare?: number; other?: number };
export type OptionDistribution = { label: string; count: number; ratio: number }[];
export type EquipmentGuideItem = {
  itemName: string;
  itemIcon?: string;
  catalogSlug?: string;
  count: number;
  ratio: number;
  starforce?: { average?: number; median?: number; distribution?: { value: number; count: number; ratio: number }[] };
  potential?: GradeDistribution;
  additionalPotential?: GradeDistribution;
  potentialOptions?: OptionDistribution;
  additionalPotentialOptions?: OptionDistribution;
  potentialSupported?: boolean;
  starforceSupported?: boolean;
};
export type EquipmentGuideStat = {
  job: string;
  cohortPower: number;
  powerMin: number;
  powerMax: number;
  slot: EquipmentSlotId;
  sampleCount: number;
  items: EquipmentGuideItem[];
  starforce: { average?: number; median?: number; distribution?: { value: number; count: number; ratio: number }[] };
  potential: GradeDistribution;
  additionalPotential: GradeDistribution;
  potentialOptions?: OptionDistribution;
  additionalPotentialOptions?: OptionDistribution;
  potentialSupported?: boolean;
  starforceSupported?: boolean;
  updatedAt?: string;
};
export type EquipmentGuideDataset = {
  source: 'api';
  stats: EquipmentGuideStat[];
  cohort?: { targetPower: number; powerMin: number; powerMax: number; characterCount: number };
  cacheStatus?: 'ready' | 'collecting' | 'fallback' | 'unavailable';
  retryAfterMs?: number;
};
export type EquipmentCharacterIndexEntry = { ocid: string; job: string; power: number };
export type EquipmentCharacterIndex = {
  schemaVersion: 1;
  date: string;
  collectedAt: string;
  sampleCount: number;
  entries: EquipmentCharacterIndexEntry[];
};
export type OwnEquipment = { slot: string; name: string; raw?: Record<string, string | null | undefined> };
