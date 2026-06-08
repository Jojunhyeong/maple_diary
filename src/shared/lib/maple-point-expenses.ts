import { formatNumber } from '@/shared/lib/utils/formatters';

export type MaplePointKind = 'routine' | 'conditional' | 'shop';
export type MaplePointSchedule = 'daily' | 'weekly' | 'sunday' | 'monthly' | 'manual';

export interface MaplePointSeedTemplate {
  title: string;
  amount: number;
  kind: MaplePointKind;
  schedule: MaplePointSchedule;
  note: string;
}

export interface MaplePointTemplate extends MaplePointSeedTemplate {
  id: string;
  selected: boolean;
}

export interface MaplePointAutoSaveConfig {
  enabled: boolean;
  templates: MaplePointSeedTemplate[];
  lastRunDate?: string;
}

export const MAPLE_POINT_SEEDS: MaplePointSeedTemplate[] = [
  {
    title: 'VIP 사우나',
    amount: 2000,
    kind: 'routine',
    schedule: 'daily',
    note: '매일 루틴으로 잡기 좋은 기본 항목',
  },
  {
    title: '에픽 던전',
    amount: 3000,
    kind: 'routine',
    schedule: 'daily',
    note: '일일 루틴형 지출',
  },
  {
    title: '몬파 썬데이 7판',
    amount: 7000,
    kind: 'conditional',
    schedule: 'sunday',
    note: '일요일에만 실행되는 조건형 지출',
  },
  {
    title: '메카베리 1만 x2',
    amount: 20000,
    kind: 'shop',
    schedule: 'monthly',
    note: '메포샵 상시 구매형',
  },
];

export const MAPLE_POINT_KIND_META: Record<MaplePointKind, { label: string; className: string }> = {
  routine: { label: '루틴', className: 'bg-amber-500/15 text-amber-700' },
  conditional: { label: '조건형', className: 'bg-emerald-500/15 text-emerald-700' },
  shop: { label: '상점형', className: 'bg-sky-500/15 text-sky-700' },
};

export const MAPLE_POINT_SCHEDULE_META: Record<
  MaplePointSchedule,
  { label: string; hint: string; multiplier: number }
> = {
  daily: { label: '매일', hint: '매일 반복', multiplier: 30 },
  weekly: { label: '주간', hint: '주 1회 반복', multiplier: 4 },
  sunday: { label: '썬데이', hint: '이벤트 요일 실행', multiplier: 4 },
  monthly: { label: '월 1회', hint: '월간 정기 구매', multiplier: 1 },
  manual: { label: '수동', hint: '필요할 때만 실행', multiplier: 1 },
};

export function makeMaplePointTemplate(seed: MaplePointSeedTemplate): MaplePointTemplate {
  return {
    id: crypto.randomUUID(),
    ...seed,
    selected: false,
  };
}

export function formatPointAmount(amount: number) {
  return `${formatNumber(amount)}P`;
}

export function getTemplateKey(template: MaplePointSeedTemplate) {
  return [template.title, template.amount, template.kind, template.schedule, template.note].join('|');
}

export function getTemplateNextRunLabel(schedule: MaplePointSchedule) {
  const today = new Date();
  if (schedule === 'daily') return '내일';
  if (schedule === 'weekly') return '다음 주';
  if (schedule === 'sunday') {
    const day = today.getDay();
    const delta = day === 0 ? 7 : 7 - day;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + delta);
    return `${nextSunday.getMonth() + 1}/${nextSunday.getDate()}`;
  }
  if (schedule === 'monthly') return '다음 달 1일';
  return '수동 실행';
}

export function buildMaplePointMemo(templates: MaplePointSeedTemplate[]) {
  return templates.map((template) => `${template.title} · ${formatPointAmount(template.amount)}`).join(', ');
}

export function getMaplePointAutoSaveStorageKey(ownerKey: string) {
  return `maple-point-auto-save:${ownerKey}`;
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

export function readMaplePointAutoSaveConfig(ownerKey: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getMaplePointAutoSaveStorageKey(ownerKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MaplePointAutoSaveConfig> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      enabled: Boolean(parsed.enabled),
      templates: Array.isArray(parsed.templates)
        ? parsed.templates.filter(
            (template): template is MaplePointSeedTemplate =>
              !!template &&
              typeof template.title === 'string' &&
              typeof template.amount === 'number' &&
              typeof template.kind === 'string' &&
              typeof template.schedule === 'string' &&
              typeof template.note === 'string',
          )
        : [],
      lastRunDate: typeof parsed.lastRunDate === 'string' ? parsed.lastRunDate : undefined,
    } satisfies MaplePointAutoSaveConfig;
  } catch {
    return null;
  }
}

export function writeMaplePointAutoSaveConfig(ownerKey: string, config: MaplePointAutoSaveConfig) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMaplePointAutoSaveStorageKey(ownerKey), JSON.stringify(config));
}

export function clearMaplePointAutoSaveConfig(ownerKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getMaplePointAutoSaveStorageKey(ownerKey));
}
