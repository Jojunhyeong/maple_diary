import 'server-only';

export type NexonStarforceHistory = {
  id?: unknown;
  item_upgrade_result?: unknown;
  before_starforce_count?: unknown;
  after_starforce_count?: unknown;
  superior_item_flag?: unknown;
  destroy_defence?: unknown;
  upgrade_item?: unknown;
  character_name?: unknown;
  world_name?: unknown;
  target_item?: unknown;
  date_create?: unknown;
  starforce_event_list?: unknown;
};

export type CalculatedStarforceHistory = {
  historyId: string;
  occurredAt: string;
  date: string;
  characterName: string;
  worldName: string;
  targetItem: string;
  beforeStarforce: number;
  afterStarforce: number;
  result: string;
  amount: number;
  itemLevel: number;
  eventDiscountRate: number;
  personalDiscountRate: number;
  destroyDefence: boolean;
};

export type StarforceSkipReason =
  | 'invalid_history'
  | 'unknown_item_level'
  | 'superior_item'
  | 'upgrade_scroll'
  | 'unsupported_star';

const FALSE_FLAG_VALUES = new Set(['', '0', 'false', '미사용', '미적용', '미해당', 'n', 'no']);
const FALSE_FLAG_MARKERS = ['미사용', '미적용', '미해당'];

function isEnabledFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return (
    !FALSE_FLAG_VALUES.has(normalized) &&
    !FALSE_FLAG_MARKERS.some((marker) => normalized.includes(marker))
  );
}

function parseDiscountRate(events: unknown) {
  if (!Array.isArray(events)) return 0;
  return events.reduce((maxRate, event) => {
    if (!event || typeof event !== 'object') return maxRate;
    const raw = (event as { cost_discount_rate?: unknown }).cost_discount_rate;
    const parsed = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? Math.max(maxRate, parsed) : maxRate;
  }, 0);
}

function roundToHundred(value: number) {
  return Math.max(0, Math.round(value / 100) * 100);
}

function starforceDivisor(star: number) {
  switch (star) {
    case 17:
      return 150;
    case 18:
      return 70;
    case 19:
      return 45;
    case 21:
      return 125;
    default:
      return 200;
  }
}

/**
 * 일반 장비의 1회 스타포스 기본 비용을 계산합니다.
 * 넥슨 히스토리는 실제 차감 메소를 제공하지 않으므로 장비 레벨과 당시 조건으로 재계산합니다.
 */
export function calculateBaseStarforceCost(itemLevel: number, beforeStarforce: number) {
  const normalizedLevel = Math.floor(itemLevel / 10) * 10;
  if (normalizedLevel <= 0 || beforeStarforce < 0 || beforeStarforce > 29) return null;

  const levelCubed = normalizedLevel ** 3;
  const raw =
    beforeStarforce <= 9
      ? 1000 + (levelCubed * (beforeStarforce + 1)) / 25
      : 1000 +
        (levelCubed * (beforeStarforce + 1) ** 2.7) /
          starforceDivisor(beforeStarforce);

  return roundToHundred(raw);
}

export function calculateStarforceHistory(
  history: NexonStarforceHistory,
  itemLevel: number | null,
  personalDiscountRate: number,
):
  | { status: 'calculated'; value: CalculatedStarforceHistory }
  | { status: 'skipped'; reason: StarforceSkipReason } {
  const historyId = typeof history.id === 'string' ? history.id : '';
  const occurredAt = typeof history.date_create === 'string' ? history.date_create : '';
  const targetItem = typeof history.target_item === 'string' ? history.target_item : '';
  const beforeStarforce = Number(history.before_starforce_count);
  const afterStarforce = Number(history.after_starforce_count);

  if (
    !historyId ||
    !occurredAt ||
    !targetItem ||
    !Number.isInteger(beforeStarforce) ||
    !Number.isInteger(afterStarforce)
  ) {
    return { status: 'skipped', reason: 'invalid_history' };
  }
  if (isEnabledFlag(history.superior_item_flag)) {
    return { status: 'skipped', reason: 'superior_item' };
  }
  if (isEnabledFlag(history.upgrade_item)) {
    return { status: 'skipped', reason: 'upgrade_scroll' };
  }
  if (!itemLevel) {
    return { status: 'skipped', reason: 'unknown_item_level' };
  }

  const baseCost = calculateBaseStarforceCost(itemLevel, beforeStarforce);
  if (baseCost === null) {
    return { status: 'skipped', reason: 'unsupported_star' };
  }

  const eventDiscountRate = Math.min(100, Math.max(0, parseDiscountRate(history.starforce_event_list)));
  const applicablePersonalDiscount =
    beforeStarforce <= 16 ? Math.min(15, Math.max(0, personalDiscountRate)) : 0;
  const totalBaseDiscount = Math.min(100, eventDiscountRate + applicablePersonalDiscount);
  const discountedBaseCost = roundToHundred(baseCost * (1 - totalBaseDiscount / 100));
  const destroyDefence = isEnabledFlag(history.destroy_defence);
  const protectionSurcharge = destroyDefence ? baseCost * 2 : 0;
  const amount = discountedBaseCost + protectionSurcharge;

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
      worldName: typeof history.world_name === 'string' ? history.world_name : '',
      targetItem,
      beforeStarforce,
      afterStarforce,
      result: typeof history.item_upgrade_result === 'string' ? history.item_upgrade_result : '',
      amount,
      itemLevel,
      eventDiscountRate,
      personalDiscountRate: applicablePersonalDiscount,
      destroyDefence,
    },
  };
}
