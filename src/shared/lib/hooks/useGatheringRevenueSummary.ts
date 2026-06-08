import { useEffect, useState } from 'react';
import { createEmptyGatheringRevenueSummary, summarizeGatheringRevenueRows } from '@/shared/lib/gathering-revenue';
import { formatDate } from '@/shared/lib/utils/formatters';
import type { GatheringRevenue, GatheringRevenueSummary } from '@/shared/types';

export function useGatheringRevenueSummary(
  startDate: Date,
  endDate: Date,
  isLoggedIn = false,
  characterId?: string | null,
) {
  const [summary, setSummary] = useState<GatheringRevenueSummary>(() => createEmptyGatheringRevenueSummary());

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isLoggedIn || characterId === '') {
        if (!cancelled) setSummary(createEmptyGatheringRevenueSummary());
        return;
      }

      try {
        const params = new URLSearchParams({
          start: formatDate(startDate),
          end: formatDate(endDate),
        });
        if (characterId) params.set('characterId', characterId);
        const res = await fetch(`/api/gathering-revenues?${params.toString()}`);
        if (!res.ok) throw new Error('gathering revenue load failed');
        const rows = (await res.json()) as GatheringRevenue[];
        if (!cancelled) {
          setSummary(summarizeGatheringRevenueRows(Array.isArray(rows) ? rows : [], characterId));
        }
      } catch {
        if (!cancelled) {
          setSummary(createEmptyGatheringRevenueSummary());
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, isLoggedIn, characterId]);

  return summary;
}
