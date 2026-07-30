import type { MaplePointMultiplier, MaplePointRunId } from '@/shared/lib/maple-point-calculator-types';

export type MaplePointShopItemId = 'meka-berry-farm-ticket' | 'soul-etra';

export interface MaplePointCalculatorState {
  selectedRunId: MaplePointRunId | null;
  selectedMultiplier: MaplePointMultiplier;
  vipCharges: string;
  monsterParkCount: string;
  shopQuantities: Record<MaplePointShopItemId, string>;
}

export function createDefaultMaplePointCalculatorState(): MaplePointCalculatorState {
  return {
    selectedRunId: null,
    selectedMultiplier: 1,
    vipCharges: '',
    monsterParkCount: '0',
    shopQuantities: {
      'meka-berry-farm-ticket': '',
      'soul-etra': '',
    },
  };
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isWednesday(date = new Date()) {
  return date.getDay() === 3;
}
