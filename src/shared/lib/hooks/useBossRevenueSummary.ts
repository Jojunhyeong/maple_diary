'use client';

import { useEffect, useState } from 'react';
import {
  summarizeBossRevenueInRange,
  summarizeBossRevenueRows,
  type BossCycleType,
  type BossRevenueRow,
  type BossRevenueSummary,
} from '@/shared/lib/boss-checklist';
import { formatDate } from '@/shared/lib/utils/formatters';

function createEmptyBossRevenueSummary(): BossRevenueSummary {
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

function getWeeklyQueryStart(date: Date) {
  return new Date(date);
}

function getWeeklyQueryEnd(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 6);
  return d;
}

export function useBossRevenueSummary(
  startDate: Date,
  endDate: Date,
  isLoggedIn = false,
  cycleType?: BossCycleType,
  characterId?: string | null,
) {
  const [summary, setSummary] = useState<BossRevenueSummary>(() =>
    isLoggedIn ? createEmptyBossRevenueSummary() : summarizeBossRevenueInRange(startDate, endDate, cycleType, characterId),
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (characterId === '') {
        if (!cancelled) setSummary(createEmptyBossRevenueSummary());
        return;
      }

      if (!isLoggedIn) {
        setSummary(summarizeBossRevenueInRange(startDate, endDate, cycleType, characterId));
        return;
      }

      try {
        const queryStart = cycleType === 'weekly' ? getWeeklyQueryStart(startDate) : startDate;
        const queryEnd = cycleType === 'weekly' ? getWeeklyQueryEnd(endDate) : endDate;
        const params = new URLSearchParams({
          start: formatDate(queryStart),
          end: formatDate(queryEnd),
        });
        if (cycleType) params.set('cycleType', cycleType);
        if (characterId) params.set('characterId', characterId);
        const res = await fetch(`/api/boss-revenues?${params.toString()}`);
        if (!res.ok) throw new Error('boss revenue load failed');
        const rows = (await res.json()) as BossRevenueRow[];
        if (!cancelled) {
          setSummary(summarizeBossRevenueRows(Array.isArray(rows) ? rows : [], cycleType, characterId));
        }
      } catch {
        if (!cancelled) {
          setSummary(summarizeBossRevenueInRange(startDate, endDate, cycleType, characterId));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, isLoggedIn, cycleType, characterId]);

  return summary;
}
