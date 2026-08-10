import { BOSS_CATALOG, type BossCategoryKey, type BossDifficultyKey } from '@/shared/data/boss-catalog';
import { formatDate } from '@/shared/lib/utils/formatters';

export type BossCycleType = 'weekly' | 'monthly';

export type BossLootItem = {
  id: string;
  itemId: string;
  name: string;
  sellPrice: number;
  checked: boolean;
};

export type BossSelection = {
  activeDifficulty?: BossDifficultyKey;
  difficulties: Partial<Record<BossDifficultyKey, { checked: boolean; partySize: number }>>;
};

export type ChecklistState = Record<string, BossSelection> & {
  __lootItems?: BossLootItem[];
};

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
  lootRevenue: number;
  lootCount: number;
  byCategory: Record<BossCategoryKey, number>;
  byCharacter: BossRevenueCharacterSummary[];
  entries: BossRevenueEntry[];
  weekKeys: string[];
};

export type BossRevenueCharacterSummary = {
  characterId: string | null;
  totalRevenue: number;
  selectedBosses: number;
  selectedClears: number;
  lootRevenue: number;
  lootCount: number;
  byCategory: Record<BossCategoryKey, number>;
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
  lootRevenue: number;
  lootCount: number;
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

export function getBossMonthKey(date = new Date()) {
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1));
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

  return { weekly, monthly, lootItems: state.__lootItems ?? [] };
}

function createEmptyBossRevenueCharacterSummary(characterId: string | null): BossRevenueCharacterSummary {
  return {
    characterId,
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    lootRevenue: 0,
    lootCount: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    },
    weekKeys: [],
  };
}

function createEmptyBossRevenueSummary(): BossRevenueSummary {
  return {
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    lootRevenue: 0,
    lootCount: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    },
    byCharacter: [],
    entries: [],
    weekKeys: [],
  };
}

export function mergeBossChecklistStates(...states: Array<ChecklistState | undefined>) {
  return states.reduce<ChecklistState>((acc, state) => {
    if (!state) return acc;
    return { ...acc, ...state };
  }, {});
}

export function summarizeBossChecklistState(state: ChecklistState, weekKey: string): Omit<BossRevenueSummary, 'weekKeys'> {
  const totals = {
    totalRevenue: 0,
    selectedBosses: 0,
    selectedClears: 0,
    lootRevenue: 0,
    lootCount: 0,
    byCategory: {
      general: 0,
      subboss: 0,
      grandis: 0,
    } satisfies Record<BossCategoryKey, number>,
    byCharacter: [] as BossRevenueCharacterSummary[],
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

  for (const lootItem of state.__lootItems ?? []) {
    if (!lootItem.checked) continue;
    totals.lootCount += 1;
    totals.lootRevenue += Math.max(0, lootItem.sellPrice || 0);
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
    lootRevenue: summary.lootRevenue,
    lootCount: summary.lootCount,
    byCategory: summary.byCategory,
  };
}

export function buildBossRevenueSnapshots(state: ChecklistState, weekKey: string, monthKey: string, characterId: string | null) {
  const { weekly, monthly, lootItems } = splitBossChecklistState(state);
  const snapshots: BossRevenueSnapshot[] = [];
  const hasCheckedLoot = lootItems.some((item) => item.checked);

  if (Object.keys(weekly).length > 0 || hasCheckedLoot) {
    snapshots.push(
      buildBossRevenueSnapshot(
        { ...weekly, __lootItems: lootItems } as ChecklistState,
        weekKey,
        'weekly',
        characterId,
      ),
    );
  }

  if (Object.keys(monthly).length > 0) {
    snapshots.push(
      buildBossRevenueSnapshot(
        monthly,
        monthKey,
        'monthly',
        characterId,
      ),
    );
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

  if (state.__lootItems) {
    filtered.__lootItems = state.__lootItems;
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
  const merged = createEmptyBossRevenueSummary();

  const uniqueWeekKeys = new Set<string>();
  const characterSummaries = new Map<string, BossRevenueCharacterSummary>();
  const getCharacterSummary = (characterKey: string | null) => {
    const mapKey = characterKey ?? '__global__';
    const existing = characterSummaries.get(mapKey);
    if (existing) return existing;
    const next = createEmptyBossRevenueCharacterSummary(characterKey);
    characterSummaries.set(mapKey, next);
    return next;
  };

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
    // Older saves copied the same loot into weekly and monthly rows. Loot belongs
    // to the week it was obtained, so monthly rows must not add it a second time.
    const lootRevenue = rowCycleType === 'monthly' ? 0 : lootRevenueFromState(row.state);
    const lootCount = rowCycleType === 'monthly' ? 0 : countCheckedLootItems(row.state);
    merged.lootRevenue += lootRevenue;
    merged.lootCount += lootCount;
    merged.totalRevenue += lootRevenue;
    if (row.week_key) uniqueWeekKeys.add(row.week_key);

    const characterSummary = getCharacterSummary(rowCharacterId);
    characterSummary.totalRevenue += (row.total_revenue ?? 0) + lootRevenue;
    characterSummary.selectedBosses += row.selected_bosses ?? 0;
    characterSummary.selectedClears += row.selected_clears ?? 0;
    characterSummary.lootRevenue += lootRevenue;
    characterSummary.lootCount += lootCount;
    characterSummary.byCategory.general += row.by_category?.general ?? 0;
    characterSummary.byCategory.subboss += row.by_category?.subboss ?? 0;
    characterSummary.byCategory.grandis += row.by_category?.grandis ?? 0;
    if (row.week_key) characterSummary.weekKeys.push(row.week_key);
  }

  merged.weekKeys = [...uniqueWeekKeys];
  merged.byCharacter = [...characterSummaries.values()]
    .map((summary) => ({
      ...summary,
      weekKeys: [...new Set(summary.weekKeys)],
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
  return merged;
}

function lootRevenueFromState(state: ChecklistState | undefined) {
  if (!state) return 0;
  const lootItems = state.__lootItems ?? [];
  if (lootItems.length > 0) {
    return lootItems.reduce((sum, item) => {
      if (!item.checked) return sum;
      return sum + Math.max(0, item.sellPrice || 0);
    }, 0);
  }

  let legacyRevenue = 0;
  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      const dropItems = (state as Record<string, { dropItems?: Record<string, { checked?: boolean; sellPrice?: number }> }>)[boss.id]?.dropItems ?? {};
      for (const item of Object.values(dropItems)) {
        if (!item?.checked) continue;
        legacyRevenue += Math.max(0, item.sellPrice || 0);
      }
    }
  }

  return legacyRevenue;
}

function countCheckedLootItems(state: ChecklistState | undefined) {
  if (!state) return 0;
  const lootItems = state.__lootItems ?? [];
  if (lootItems.length > 0) {
    return lootItems.reduce((count, item) => count + (item.checked ? 1 : 0), 0);
  }

  let legacyCount = 0;
  for (const group of BOSS_CATALOG) {
    for (const boss of group.bosses) {
      const dropItems = (state as Record<string, { dropItems?: Record<string, { checked?: boolean }> }>)[boss.id]?.dropItems ?? {};
      for (const item of Object.values(dropItems)) {
        if (item?.checked) legacyCount += 1;
      }
    }
  }

  return legacyCount;
}
