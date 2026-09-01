import { useMemo } from 'react';
import { createEmptyGatheringRevenueSummary, summarizeGatheringRevenueRows } from '@/shared/lib/gathering-revenue';
import { formatDate } from '@/shared/lib/utils/formatters';
import type { GatheringRevenueSummary } from '@/shared/types';
import { useGatheringRevenuesQuery } from '@/shared/lib/queries/useGatheringRevenuesQuery';

export function useGatheringRevenueSummary(
  startDate: Date,
  endDate: Date,
  isLoggedIn = false,
  characterId?: string | null,
  userId?: string | null,
) {
  const { data: rows } = useGatheringRevenuesQuery({
    userId,
    isLoggedIn,
    characterId,
    start: formatDate(startDate),
    end: formatDate(endDate),
  });

  return useMemo<GatheringRevenueSummary>(
    () => rows ? summarizeGatheringRevenueRows(rows, characterId) : createEmptyGatheringRevenueSummary(),
    [characterId, rows],
  );
}
