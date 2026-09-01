'use client';

import { useMemo } from 'react';
import {
  summarizeBossRevenueRows,
  type BossCycleType,
  type BossRevenueRow,
  type BossRevenueSummary,
} from '@/shared/lib/boss-checklist';
import { formatDate } from '@/shared/lib/utils/formatters';
import { useBossRevenuesQuery } from '@/shared/lib/queries/useBossRevenuesQuery';

type BossRevenueAnalysis = {
  monthWeeklySummary: BossRevenueSummary;
  monthMonthlySummary: BossRevenueSummary;
  weekSummary: BossRevenueSummary;
};

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

function createEmptyBossRevenueAnalysis(): BossRevenueAnalysis {
  return {
    monthWeeklySummary: createEmptyBossRevenueSummary(),
    monthMonthlySummary: createEmptyBossRevenueSummary(),
    weekSummary: createEmptyBossRevenueSummary(),
  };
}

function getRowCycleType(row: BossRevenueRow): BossCycleType | undefined {
  return row.cycle_type ?? row.state?.__bossMeta?.cycleType;
}

export function summarizeBossRevenueAnalysisRows(
  rows: BossRevenueRow[],
  weekStart: Date,
  today: Date,
  queryEnd: Date,
  characterId?: string | null,
): BossRevenueAnalysis {
  const weekStartKey = formatDate(weekStart);
  const todayKey = formatDate(today);
  const queryEndKey = formatDate(queryEnd);
  const weekRows = rows.filter(
    (row) =>
      getRowCycleType(row) === 'weekly' &&
      row.week_key >= weekStartKey &&
      row.week_key <= queryEndKey,
  );
  const monthlyRows = rows.filter(
    (row) => getRowCycleType(row) === 'monthly' && row.week_key <= todayKey,
  );

  return {
    monthWeeklySummary: summarizeBossRevenueRows(rows, 'weekly', characterId),
    monthMonthlySummary: summarizeBossRevenueRows(monthlyRows, 'monthly', characterId),
    weekSummary: summarizeBossRevenueRows(weekRows, 'weekly', characterId),
  };
}

export function useBossRevenueAnalysis(
  monthStart: Date,
  today: Date,
  weekStart: Date,
  isLoggedIn = false,
  characterId?: string | null,
  userId?: string | null,
) {
  const queryEnd = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 6);
    return date;
  }, [today]);
  const { data: rows } = useBossRevenuesQuery({
    userId,
    isLoggedIn,
    characterId,
    start: formatDate(monthStart),
    end: formatDate(queryEnd),
  });

  return useMemo(
    () =>
      rows
        ? summarizeBossRevenueAnalysisRows(rows, weekStart, today, queryEnd, characterId)
        : createEmptyBossRevenueAnalysis(),
    [characterId, queryEnd, rows, today, weekStart],
  );
}
