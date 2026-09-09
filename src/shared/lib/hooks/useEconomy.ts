'use client';

import { useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useRecordsQuery } from '@/shared/lib/queries/useRecordsQuery';
import { useExpensesQuery } from '@/shared/lib/queries/useExpensesQuery';
import { useBossRevenuesQuery } from '@/shared/lib/queries/useBossRevenuesQuery';
import { useGatheringRevenuesQuery } from '@/shared/lib/queries/useGatheringRevenuesQuery';
import { summarizeBossRevenueRows } from '@/shared/lib/boss-checklist';
import { formatDate } from '@/shared/lib/utils/formatters';
import { summarizeEconomy, type EconomyEntry } from '@/shared/lib/utils/economy';

export function useEconomy() {
  const { data: session, status } = useSession();
  const { localOwnerId, initializeLocal } = useAuthStore();
  const isLoggedIn = !!session?.user?.id;
  useEffect(() => { initializeLocal(); }, [initializeLocal]);
  const options = { localOwnerId, userId: session?.user?.id, isLoggedIn };
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return date;
  }, [today]);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const records = useRecordsQuery(options);
  const expenses = useExpensesQuery(options);
  const bosses = useBossRevenuesQuery(options);
  const gathering = useGatheringRevenuesQuery({ ...options, start: '2000-01-01', end: formatDate(weekEnd) });
  const entries = useMemo<EconomyEntry[]>(() => [
    ...(records.data ?? []).map(row => ({ id: `h-${row.id}`, date: row.date, title: row.memo || '사냥 기록', kind: 'hunting' as const, income: row.total_revenue, expense: row.material_cost, characterId: row.character_id })),
    ...(expenses.data ?? []).filter(row => row.category !== '메포').map(row => ({ id: `e-${row.id}`, date: row.date, title: row.title, kind: 'expense' as const, income: 0, expense: row.amount, category: row.category })),
    ...(gathering.data ?? []).map(row => ({ id: `g-${row.id}`, date: row.date, title: `${row.item_name} ${row.quantity}개`, kind: 'gathering' as const, income: row.total_amount, expense: 0, characterId: row.character_id })),
    ...(bosses.data ?? []).map((row, index) => ({ id: `b-${row.week_key}-${index}`, date: row.week_key, title: `${(row.cycle_type ?? row.state?.__bossMeta?.cycleType) === 'monthly' ? '월간' : '주간'} 보스 정산`, kind: 'boss' as const, income: summarizeBossRevenueRows([row]).totalRevenue, expense: 0, characterId: row.character_id ?? row.state?.__bossMeta?.characterId, period: row.cycle_type ?? row.state?.__bossMeta?.cycleType ?? 'weekly' as const })),
  ], [records.data, expenses.data, gathering.data, bosses.data]);
  const historyStart = new Date(weekStart); historyStart.setDate(historyStart.getDate() - 28);
  const historyEnd = new Date(weekStart); historyEnd.setDate(historyEnd.getDate() - 1);
  const history = summarizeEconomy(entries, formatDate(historyStart), formatDate(historyEnd));
  const historicalWeeks = new Set(history.entries.map(entry => {
    const date = new Date(`${entry.date}T12:00:00`);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return formatDate(date);
  }));
  const averageWeeklyNet = history.net / 4;
  const error = records.error || expenses.error || bosses.error || gathering.error;
  const loading = status === 'loading' || (!isLoggedIn && !localOwnerId) || records.isLoading || (isLoggedIn && (expenses.isLoading || bosses.isLoading || gathering.isLoading));
  return { entries, today, weekStart, weekEnd, isLoggedIn, options, loading, error,
    weekly: summarizeEconomy(entries, formatDate(weekStart), formatDate(weekEnd)),
    averageWeeklyNet, canEstimate: isLoggedIn && !loading && !error && historicalWeeks.size === 4 && averageWeeklyNet > 0,
    points: expenses.data?.filter(row => row.category === '메포') ?? [],
  };
}
