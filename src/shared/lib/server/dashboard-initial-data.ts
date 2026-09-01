import { supabaseAdmin } from '@/shared/lib/supabase';
import {
  summarizeBossRevenueRows,
  type BossRevenueRow,
  type BossRevenueSummary,
} from '@/shared/lib/boss-checklist';
import { formatDate } from '@/shared/lib/utils/formatters';
import type { Expense, Goal, RecordWithCalculations } from '@/shared/types';

export type DashboardInitialData = {
  activeCharacterId: string | null;
  records: RecordWithCalculations[];
  expenses: Expense[];
  goals: Goal[];
  weeklyBossSummary: BossRevenueSummary;
  monthlyBossSummary: BossRevenueSummary;
};

function getRowCycleType(row: BossRevenueRow) {
  return row.cycle_type ?? row.state?.__bossMeta?.cycleType;
}

function getRowCharacterId(row: BossRevenueRow) {
  return row.character_id ?? row.state?.__bossMeta?.characterId ?? null;
}

export async function getDashboardInitialData(
  userId: string,
  activeCharacterId: string | null,
): Promise<DashboardInitialData> {
  const db = supabaseAdmin();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const weeklyQueryEnd = new Date(monthEnd);
  weeklyQueryEnd.setDate(weeklyQueryEnd.getDate() + 6);
  const monthEndKey = formatDate(monthEnd);

  const [recordsResult, expensesResult, goalsResult, bossResult] = await Promise.all([
    db
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    db
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    db
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    db
      .from('boss_revenues')
      .select('*')
      .eq('user_id', userId)
      .gte('week_key', formatDate(monthStart))
      .lte('week_key', formatDate(weeklyQueryEnd))
      .order('week_key', { ascending: false }),
  ]);

  const loadError =
    recordsResult.error ?? expensesResult.error ?? goalsResult.error ?? bossResult.error;
  if (loadError) {
    throw new Error(`dashboard initial data load failed: ${loadError.message}`);
  }

  const bossRows = ((bossResult.data ?? []) as BossRevenueRow[]).filter(
    (row) => !activeCharacterId || getRowCharacterId(row) === activeCharacterId,
  );
  const weeklyRows = bossRows.filter((row) => getRowCycleType(row) === 'weekly');
  const monthlyRows = bossRows.filter(
    (row) => getRowCycleType(row) === 'monthly' && row.week_key <= monthEndKey,
  );

  return {
    activeCharacterId,
    records: (recordsResult.data ?? []) as RecordWithCalculations[],
    expenses: (expensesResult.data ?? []) as Expense[],
    goals: (goalsResult.data ?? []) as Goal[],
    weeklyBossSummary: summarizeBossRevenueRows(weeklyRows, 'weekly', activeCharacterId),
    monthlyBossSummary: summarizeBossRevenueRows(monthlyRows, 'monthly', activeCharacterId),
  };
}
