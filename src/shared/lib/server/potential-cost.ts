import 'server-only';

export type NexonPotentialOption = {
  grade?: unknown;
};

export type NexonPotentialHistory = {
  id?: unknown;
  character_name?: unknown;
  date_create?: unknown;
  potential_type?: unknown;
  item_upgrade_result?: unknown;
  item_level?: unknown;
  target_item?: unknown;
  potential_option_grade?: unknown;
  additional_potential_option_grade?: unknown;
  before_potential_option?: unknown;
  before_additional_potential_option?: unknown;
};

export type CalculatedPotentialHistory = {
  historyId: string;
  occurredAt: string;
  date: string;
  characterName: string;
  targetItem: string;
  itemLevel: number;
  potentialType: 'potential' | 'additional';
  grade: PotentialGrade;
  result: string;
  amount: number;
};

export type PotentialSkipReason =
  | 'invalid_history'
  | 'unsupported_item_level'
  | 'unknown_potential_type'
  | 'unknown_grade';

type PotentialGrade = 'rare' | 'epic' | 'unique' | 'legendary';

const REGULAR_COSTS: Record<PotentialGrade, readonly number[]> = {
  rare: [4_000_000, 4_250_000, 4_500_000, 5_000_000],
  epic: [16_000_000, 17_000_000, 18_000_000, 20_000_000],
  unique: [34_000_000, 36_125_000, 38_250_000, 42_500_000],
  legendary: [40_000_000, 42_500_000, 45_000_000, 50_000_000],
};

const ADDITIONAL_COSTS: Record<PotentialGrade, readonly number[]> = {
  rare: [9_750_000, 10_375_000, 11_000_000, 12_250_000],
  epic: [27_300_000, 29_050_000, 30_800_000, 34_300_000],
  unique: [66_300_000, 70_550_000, 74_800_000, 83_300_000],
  legendary: [78_000_000, 83_000_000, 88_000_000, 98_000_000],
};

function normalizeGrade(value: unknown): PotentialGrade | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '레어' || normalized === 'rare') return 'rare';
  if (normalized === '에픽' || normalized === 'epic') return 'epic';
  if (normalized === '유니크' || normalized === 'unique') return 'unique';
  if (normalized === '레전드리' || normalized === 'legendary') return 'legendary';
  return null;
}

function readBeforeGrade(options: unknown) {
  if (!Array.isArray(options)) return null;
  const first = options.find((option): option is NexonPotentialOption => !!option && typeof option === 'object');
  return normalizeGrade(first?.grade);
}

function levelBand(itemLevel: number) {
  if (itemLevel >= 1 && itemLevel <= 159) return 0;
  if (itemLevel <= 199) return 1;
  if (itemLevel <= 249) return 2;
  if (itemLevel <= 300) return 3;
  return null;
}

export function calculatePotentialResetCost(
  itemLevel: number,
  grade: PotentialGrade,
  potentialType: 'potential' | 'additional',
) {
  const band = levelBand(itemLevel);
  if (band === null) return null;
  return (potentialType === 'additional' ? ADDITIONAL_COSTS : REGULAR_COSTS)[grade][band];
}

/**
 * Open API 이력에는 실제 차감 메소가 없어 공식 장비 레벨/재설정 전 등급 비용표로 계산합니다.
 */
export function calculatePotentialHistory(
  history: NexonPotentialHistory,
):
  | { status: 'calculated'; value: CalculatedPotentialHistory }
  | { status: 'skipped'; reason: PotentialSkipReason } {
  const historyId = typeof history.id === 'string' ? history.id : '';
  const occurredAt = typeof history.date_create === 'string' ? history.date_create : '';
  const targetItem = typeof history.target_item === 'string' ? history.target_item : '';
  const itemLevel = Number(history.item_level);

  if (!historyId || !occurredAt || !targetItem || !Number.isInteger(itemLevel)) {
    return { status: 'skipped', reason: 'invalid_history' };
  }

  const rawType = typeof history.potential_type === 'string' ? history.potential_type : '';
  const potentialType = rawType.includes('에디셔널')
    ? 'additional'
    : rawType.includes('잠재능력')
      ? 'potential'
      : null;
  if (!potentialType) return { status: 'skipped', reason: 'unknown_potential_type' };

  const grade =
    potentialType === 'additional'
      ? readBeforeGrade(history.before_additional_potential_option) ??
        normalizeGrade(history.additional_potential_option_grade)
      : readBeforeGrade(history.before_potential_option) ?? normalizeGrade(history.potential_option_grade);
  if (!grade) return { status: 'skipped', reason: 'unknown_grade' };

  const amount = calculatePotentialResetCost(itemLevel, grade, potentialType);
  if (amount === null) return { status: 'skipped', reason: 'unsupported_item_level' };

  return {
    status: 'calculated',
    value: {
      historyId,
      occurredAt,
      date: occurredAt.slice(0, 10),
      characterName:
        typeof history.character_name === 'string' && history.character_name
          ? history.character_name
          : '캐릭터 미상',
      targetItem,
      itemLevel,
      potentialType,
      grade,
      result: typeof history.item_upgrade_result === 'string' ? history.item_upgrade_result : '',
      amount,
    },
  };
}
