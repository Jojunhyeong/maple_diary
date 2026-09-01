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

type BossRevenuePeriodSummaries = {
  weeklySummary: BossRevenueSummary;
  monthlySummary: BossRevenueSummary;
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

function createEmptyPeriodSummaries(): BossRevenuePeriodSummaries {
  return {
    weeklySummary: createEmptyBossRevenueSummary(),
    monthlySummary: createEmptyBossRevenueSummary(),
  };
}

function getRowCycleType(row: BossRevenueRow): BossCycleType | undefined {
  return row.cycle_type ?? row.state?.__bossMeta?.cycleType;
}

export function useBossRevenuePeriodSummaries(
  startDate: Date,
  endDate: Date,
  isLoggedIn = false,
  characterId?: string | null,
  initialSummaries?: BossRevenuePeriodSummaries | null,
  userId?: string | null,
) {
  const weeklyQueryEnd = useMemo(() => {
    const date = new Date(endDate);
    date.setDate(date.getDate() + 6);
    return date;
  }, [endDate]);
  const { data: rows } = useBossRevenuesQuery({
    userId,
    isLoggedIn,
    characterId,
    start: formatDate(startDate),
    end: formatDate(weeklyQueryEnd),
  });

  return useMemo(() => {
    if (!rows) return initialSummaries ?? createEmptyPeriodSummaries();
    const periodEndKey = formatDate(endDate);
    const weeklyRows = rows.filter((row) => getRowCycleType(row) === 'weekly');
    const monthlyRows = rows.filter(
      (row) => getRowCycleType(row) === 'monthly' && row.week_key <= periodEndKey,
    );
    return {
      weeklySummary: summarizeBossRevenueRows(weeklyRows, 'weekly', characterId),
      monthlySummary: summarizeBossRevenueRows(monthlyRows, 'monthly', characterId),
    };
  }, [characterId, endDate, initialSummaries, rows]);
}
