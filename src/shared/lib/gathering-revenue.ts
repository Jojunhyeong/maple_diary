import type { GatheringItemTab, GatheringRevenue, GatheringRevenueSummary } from '@/shared/types';

function createEmptySummary(): GatheringRevenueSummary {
  return {
    totalRevenue: 0,
    entryCount: 0,
    byTab: {
      seed: 0,
      flower: 0,
      ore: 0,
    },
    entries: [],
  };
}

export function summarizeGatheringRevenueRows(
  rows: GatheringRevenue[],
  characterId?: string | null,
): GatheringRevenueSummary {
  const filtered = characterId ? rows.filter((row) => row.character_id === characterId) : rows;
  const sorted = [...filtered].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );

  const summary = createEmptySummary();
  summary.entries = sorted;
  summary.entryCount = sorted.length;

  for (const row of sorted) {
    summary.totalRevenue += row.total_amount;
    summary.byTab[row.item_tab] += row.total_amount;
  }

  return summary;
}

export function createEmptyGatheringRevenueSummary(): GatheringRevenueSummary {
  return createEmptySummary();
}

export function normalizeGatheringItemTab(tab: string): GatheringItemTab {
  return tab === 'flower' ? 'flower' : tab === 'ore' ? 'ore' : 'seed';
}
