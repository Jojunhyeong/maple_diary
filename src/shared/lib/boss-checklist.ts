import { BOSS_CATALOG, type BossCategoryKey, type BossDifficultyKey } from '@/shared/data/boss-catalog';
import { formatDate } from '@/shared/lib/utils/formatters';

export type BossCycleType = 'weekly' | 'monthly';

export type BossSelection = {
  activeDifficulty?: BossDifficultyKey;
  difficulties: Partial<Record<BossDifficultyKey, { checked: boolean; partySize: number }>>;
};

export type ChecklistState = Record<string, BossSelection>;

export type BossRevenueEntry = {
  bossName: string;
  category: BossCategoryKey;
  difficulty: BossDifficultyKey;
  partySize: number;
  revenue: number;
  weekKey: string;
};

export type BossRevenueSummary = {
  totalRevenue: number;
  selectedBosses: number;
  selectedClears: number;
  byCategory: Record<BossCategoryKey, number>;
  entries: BossRevenueEntry[];
  weekKeys: string[];
};

export type BossRevenueSnapshot = {
  cycleType: BossCycleType;
  weekKey: string;
  characterId: string | null;
  state: ChecklistState;
  totalRevenue: number;
  selectedBosses: number;
  selectedClears: number;
  byCategory: Record<BossCategoryKey, number>;
};

export type BossRevenueRow = {
  character_id?: string | null;
  week_key: string;
  cycle_type?: BossCycleType;
  total_revenue: number;
  selected_bosses: number;
  selected_clears: number;
  by_category: Record<BossCategoryKey, number>;
  state?: ChecklistState & {
    __bossMeta?: {
      cycleType?: BossCycleType;
      characterId?: string | null;
    };
  };
};

export const BOSS_STORAGE_PREFIX = 'maple_diary:boss-checklist:v1';

export function getBossThursday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 4 : 4 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getBossWeekKey(date = new Date()) {
  return formatDate(getBossThursday(date));
}

export function getBossPreviousWeekKey(date = new Date()) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 7);
  return getBossWeekKey(previous);
}

export function getBossMonthKey(date = new Date()) {
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getBossWeekRange(weekKey: string) {
  const end = new Date(weekKey);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start, end };
}

function storageKeyByCharacter(characterId: string | null, weekKey: string) {
  return `${BOSS_STORAGE_PREFIX}:${characterId ?? 'global'}:${weekKey}`;
}

export function splitBossChecklistState(state: ChecklistState) {
  const weekly: ChecklistState = {};
  const monthly: ChecklistState = {};

  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      const selection = state[boss.id];
      if (!selection) continue;
      if (boss.resetCycle === 'monthly') {
        monthly[boss.id] = selection;
      } else {
        weekly[boss.id] = selection;
      }
    }
  }

  return { weekly, monthly };
}

export function mergeBossChecklistStates(...states: Array<ChecklistState | undefined>) {
  return states.reduce<ChecklistState>((acc, state) => {
    if (!state) return acc;
    return { ...acc, ...state };
  }, {});
}

function normalizeSelection(value: unknown): BossSelection | null {
  if (!value || typeof value !== 'object') return null;
  const selection = value as Partial<BossSelection> & {
    difficulties?: Partial<Record<BossDifficultyKey, { checked?: boolean; partySize?: number }>>;
  };

  if (selection.activeDifficulty && selection.difficulties) {
    return {
      activeDifficulty: selection.activeDifficulty,
      difficulties: Object.fromEntries(
        Object.entries(selection.difficulties).map(([difficulty, entry]) => [
          difficulty,
          {
            checked: difficulty === selection.activeDifficulty && !!entry?.checked,
            partySize: Math.max(1, entry?.partySize ?? 1),
          },
        ]),
      ) as BossSelection['difficulties'],
    };
  }

  if (selection.difficulties) {
    const activeEntry = Object.entries(selection.difficulties).find(([, entry]) => entry?.checked);
    if (!activeEntry) return null;
    const [difficulty, entry] = activeEntry as [BossDifficultyKey, { checked?: boolean; partySize?: number }];
    return {
      activeDifficulty: difficulty,
      difficulties: {
        [difficulty]: {
          checked: true,
          partySize: Math.max(1, entry.partySize ?? 1),
        },
      },
    };
  }

  return null;
}

export function readBossChecklistState(characterId: string | null, weekKey: string): ChecklistState {
  if (typeof window === 'undefined') return {};
  if (characterId === '') return {};
  try {
    const raw = localStorage.getItem(storageKeyByCharacter(characterId, weekKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    const normalized: ChecklistState = {};
    for (const [bossId, value] of Object.entries(parsed)) {
      const selection = normalizeSelection(value);
      if (selection) normalized[bossId] = selection;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function migrateBossChecklistCharacterId(fromCharacterId: string, toCharacterId: string) {
  if (typeof window === 'undefined' || !fromCharacterId || !toCharacterId || fromCharacterId === toCharacterId) return;

  const fromPrefix = `${BOSS_STORAGE_PREFIX}:${fromCharacterId}:`;
  const toPrefix = `${BOSS_STORAGE_PREFIX}:${toCharacterId}:`;

  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(fromPrefix)) continue;
    const nextKey = `${toPrefix}${key.slice(fromPrefix.length)}`;
    const value = localStorage.getItem(key);
    if (value !== null) {
      localStorage.setItem(nextKey, value);
    }
  }
}

export function listStoredBossWeekKeys(characterId: string | null = null) {
  if (typeof window === 'undefined') return [];
  const scope = characterId ?? 'global';
  const prefix = `${BOSS_STORAGE_PREFIX}:${scope}:`;
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}

export function summarizeBossChecklistState(state: ChecklistState, weekKey: string): Omit<BossRevenueSummary, 'weekKeys'> {
  const totals = {
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    } satisfies Record<BossCategoryKey, number>,
    entries: [] as BossRevenueEntry[],
  };

  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      const selection = state[boss.id];
      const activeDifficulty =
        selection?.activeDifficulty && selection.difficulties[selection.activeDifficulty]?.checked
          ? selection.activeDifficulty
          : undefined;
      if (!activeDifficulty) continue;

      const price = boss.difficulties[activeDifficulty] ?? 0;
      const partySize = Math.max(1, selection.difficulties[activeDifficulty]?.partySize ?? 1);
      const revenue = Math.floor(price / partySize);

      totals.selectedBosses += 1;
      totals.selectedClears += 1;
      totals.totalRevenue += revenue;
      totals.byCategory[group.key] += revenue;
      totals.entries.push({
        bossName: boss.name,
        category: group.key,
        difficulty: activeDifficulty,
        partySize,
        revenue,
        weekKey,
      });
    }
  }

  totals.entries.sort((a, b) => b.revenue - a.revenue);
  return totals;
}

export function buildBossRevenueSnapshot(
  state: ChecklistState,
  weekKey: string,
  cycleType: BossCycleType,
  characterId: string | null,
): BossRevenueSnapshot {
  const summary = summarizeBossChecklistState(state, weekKey);
  return {
    cycleType,
    weekKey,
    characterId,
    state,
    totalRevenue: summary.totalRevenue,
    selectedBosses: summary.selectedBosses,
    selectedClears: summary.selectedClears,
    byCategory: summary.byCategory,
  };
}

export function buildBossRevenueSnapshots(state: ChecklistState, weekKey: string, monthKey: string, characterId: string | null) {
  const { weekly, monthly } = splitBossChecklistState(state);
  const snapshots: BossRevenueSnapshot[] = [];

  if (Object.keys(weekly).length > 0) {
    snapshots.push(buildBossRevenueSnapshot(weekly, weekKey, 'weekly', characterId));
  }

  if (Object.keys(monthly).length > 0) {
    snapshots.push(buildBossRevenueSnapshot(monthly, monthKey, 'monthly', characterId));
  }

  return snapshots;
}

export function filterBossChecklistStateByCycle(state: ChecklistState, cycleType: BossCycleType) {
  const filtered: ChecklistState = {};

  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      if ((boss.resetCycle ?? 'weekly') !== cycleType) continue;
      const selection = state[boss.id];
      if (selection) filtered[boss.id] = selection;
    }
  }

  return filtered;
}

export function removeBossChecklistStateByCycle(state: ChecklistState, cycleType: BossCycleType) {
  const filtered: ChecklistState = {};

  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      if ((boss.resetCycle ?? 'weekly') === cycleType) continue;
      const selection = state[boss.id];
      if (selection) filtered[boss.id] = selection;
    }
  }

  return filtered;
}

export function removeBossChecklistStatesByCycles(state: ChecklistState, cycleTypes: BossCycleType[]) {
  const cycleSet = new Set(cycleTypes);
  const filtered: ChecklistState = {};

  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      if (cycleSet.has(boss.resetCycle ?? 'weekly')) continue;
      const selection = state[boss.id];
      if (selection) filtered[boss.id] = selection;
    }
  }

  return filtered;
}

export function summarizeBossRevenueRows(
  rows: BossRevenueRow[],
  cycleType?: BossCycleType,
  characterId?: string | null,
): BossRevenueSummary {
  const merged: BossRevenueSummary = {
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    },
    entries: [],
    weekKeys: [],
  };

  const uniqueWeekKeys = new Set<string>();

  for (const row of rows) {
    const rowCycleType = row.cycle_type ?? row.state?.__bossMeta?.cycleType;
    const rowCharacterId = row.character_id ?? row.state?.__bossMeta?.characterId ?? null;
    if (cycleType && rowCycleType !== cycleType) continue;
    if (characterId !== undefined && characterId !== null && rowCharacterId !== characterId) continue;
    merged.totalRevenue += row.total_revenue ?? 0;
    merged.selectedBosses += row.selected_bosses ?? 0;
    merged.selectedClears += row.selected_clears ?? 0;
    merged.byCategory.general += row.by_category?.general ?? 0;
    merged.byCategory.subboss += row.by_category?.subboss ?? 0;
    merged.byCategory.grandis += row.by_category?.grandis ?? 0;
    if (row.week_key) uniqueWeekKeys.add(row.week_key);
  }

  merged.weekKeys = [...uniqueWeekKeys];
  return merged;
}

export function summarizeBossRevenueInRange(startDate: Date, endDate: Date, cycleType?: BossCycleType, characterId?: string | null) {
  if (characterId === '') {
    return {
      totalRevenue: 0,
      selectedBosses: 0,
      selectedClears: 0,
      byCategory: {
        general: 0,
        subboss: 0,
        grandis: 0,
      },
      entries: [],
      weekKeys: [],
    };
  }

  const weekKeys = listStoredBossWeekKeys(characterId).filter((weekKey) => {
    const { start, end } = getBossWeekRange(weekKey);
    return start <= endDate && end >= startDate;
  });

  const merged: BossRevenueSummary = {
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    },
    entries: [],
    weekKeys,
  };

  for (const weekKey of weekKeys) {
    const weekState = readBossChecklistState(characterId ?? null, weekKey);
    const filteredState = cycleType ? filterBossChecklistStateByCycle(weekState, cycleType) : weekState;
    const summary = summarizeBossChecklistState(filteredState, weekKey);
    merged.totalRevenue += summary.totalRevenue;
    merged.selectedBosses += summary.selectedBosses;
    merged.selectedClears += summary.selectedClears;
    merged.byCategory.general += summary.byCategory.general;
    merged.byCategory.subboss += summary.byCategory.subboss;
    merged.byCategory.grandis += summary.byCategory.grandis;
    merged.entries.push(...summary.entries);
  }

  merged.entries.sort((a, b) => b.revenue - a.revenue);
  return merged;
}
