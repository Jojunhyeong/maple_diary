'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMigrateOnLogin } from '@/shared/lib/hooks/useMigrateOnLogin';
import { useRecordsQuery } from '@/shared/lib/queries/useRecordsQuery';
import { useExpensesQuery } from '@/shared/lib/queries/useExpensesQuery';
import { useGoalsQuery } from '@/shared/lib/queries/useGoalsQuery';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useDashboardStore } from '@/shared/lib/stores/useDashboardStore';
import { useActiveCharacterId } from '@/shared/lib/hooks/useActiveCharacterId';
import { useStoredCharacterProfile } from '@/shared/lib/hooks/useStoredCharacterProfile';
import { useBossRevenuePeriodSummaries } from '@/shared/lib/hooks/useBossRevenuePeriodSummaries';
import { Card } from '@/shared/ui/Card';
import { formatMeso, formatDate, formatDateKorean, formatTime } from '@/shared/lib/utils/formatters';
import { filterRecordsByCharacter } from '@/shared/lib/utils/characterFilter';
import type { Expense, RecordWithCalculations } from '@/shared/types';
import { useDashboardInitialData } from './dashboard-initial-data-provider';

function RevenueCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="min-w-0 p-3.5">
      <p className="text-[11px] text-t3 mb-1">{label}</p>
      <p className="text-base font-bold text-t1 truncate">{formatMeso(value)}</p>
    </Card>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-0 p-3.5">
      <p className="mb-1 text-[11px] text-t3">{label}</p>
      <p className="truncate text-base font-bold text-t1">{value}</p>
    </Card>
  );
}

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

interface DayGroup {
  date: string;
  records: RecordWithCalculations[];
  totalNetRevenue: number;
  totalTimeMinutes: number;
  netPerHour: number;
}

interface ExpenseGroup {
  date: string;
  expenses: Expense[];
  totalAmount: number;
}

function groupByDate(records: RecordWithCalculations[]): DayGroup[] {
  const map = new Map<string, RecordWithCalculations[]>();
  for (const r of records) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date)!.push(r);
  }
  return Array.from(map.entries()).map(([date, recs]) => {
    const totalNetRevenue = recs.reduce((s, r) => s + r.net_revenue, 0);
    const totalTimeMinutes = recs.reduce((s, r) => s + r.time_minutes, 0);
    const netPerHour = totalTimeMinutes > 0 ? Math.floor((totalNetRevenue / totalTimeMinutes) * 60) : 0;
    return { date, records: recs, totalNetRevenue, totalTimeMinutes, netPerHour };
  });
}

function groupExpensesByDate(expenses: Expense[]): ExpenseGroup[] {
  const map = new Map<string, Expense[]>();
  for (const expense of expenses) {
    if (!map.has(expense.date)) map.set(expense.date, []);
    map.get(expense.date)!.push(expense);
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    expenses: items.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)),
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
  }));
}

function DayRow({ group }: { group: DayGroup }) {
  const multi = group.records.length > 1;
  return (
    <Link
      href="/records"
      className="flex items-center justify-between rounded-xl border border-transparent px-2 py-3 transition-colors hover:border-line hover:bg-surface/50"
    >
      <div>
        <p className="text-sm font-medium text-t1">{formatDateKorean(group.date)}</p>
        <p className="mt-0.5 text-xs text-t3">
          {formatTime(group.totalTimeMinutes)}
          {multi && (
            <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
              {group.records.length}회
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-t1">{formatMeso(group.totalNetRevenue)}</p>
        <p className="text-[11px] text-t3">{formatMeso(group.netPerHour)}/h</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const initialized = useRef(false);
  useMigrateOnLogin();

  const { data: session } = useSession();
  const initialData = useDashboardInitialData();
  const isLoggedIn = !!session?.user?.id || initialData !== null;
  const { initializeLocal, localOwnerId } = useAuthStore();
  const { todayRevenue, recentRecords, sevenDayStats } =
    useDashboardStore();
  const currentDate = useMemo(() => new Date(), []);
  const { start: currentMonthStart, end: currentMonthEnd } = useMemo(() => getMonthBounds(currentDate), [currentDate]);
  const storedActiveCharacterId = useActiveCharacterId();
  const activeCharacterId = storedActiveCharacterId ?? initialData?.activeCharacterId ?? null;
  const { data: records = [], isLoading: recordsLoading } = useRecordsQuery({
    localOwnerId,
    userId: session?.user?.id,
    isLoggedIn,
    activeCharacterId,
    initialData: initialData?.records,
  });
  const { data: expenses = [] } = useExpensesQuery({
    userId: session?.user?.id,
    isLoggedIn,
    initialData: initialData?.expenses,
  });
  const { data: goals = [] } = useGoalsQuery({
    localOwnerId,
    userId: session?.user?.id,
    isLoggedIn,
    initialData: initialData?.goals,
  });
  const bossCharacterId = activeCharacterId ?? null;
  const {
    weeklySummary: currentBossWeeklySummary,
    monthlySummary: currentBossMonthlySummary,
  } = useBossRevenuePeriodSummaries(
    currentMonthStart,
    currentMonthEnd,
    isLoggedIn,
    bossCharacterId,
    initialData
      ? {
          weeklySummary: initialData.weeklyBossSummary,
          monthlySummary: initialData.monthlyBossSummary,
        }
      : null,
    session?.user?.id,
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const done = localStorage.getItem('maple_diary:onboarding_done');
    if (!done) {
      router.replace('/onboarding');
      return;
    }
    initializeLocal();
  }, [initializeLocal, router]);

  const visibleRecords = useMemo(
    () => filterRecordsByCharacter(records, activeCharacterId),
    [records, activeCharacterId],
  );
  const todayRevenueValue = useMemo(() => todayRevenue(visibleRecords), [todayRevenue, visibleRecords]);
  const recent = useMemo(() => recentRecords(visibleRecords, 9), [recentRecords, visibleRecords]);
  const recentGroups = useMemo(() => groupByDate(recent).slice(0, 3), [recent]);
  const chartData = useMemo(() => sevenDayStats(visibleRecords), [sevenDayStats, visibleRecords]);
  const currentMonthStartStr = useMemo(() => formatDate(currentMonthStart), [currentMonthStart]);
  const currentMonthEndStr = useMemo(() => formatDate(currentMonthEnd), [currentMonthEnd]);
  const currentMonthRecords = useMemo(
    () => visibleRecords.filter((r) => r.date >= currentMonthStartStr && r.date <= currentMonthEndStr),
    [visibleRecords, currentMonthStartStr, currentMonthEndStr],
  );
  const currentMonthExpenses = useMemo(
    () => expenses.filter((expense) => expense.date >= currentMonthStartStr && expense.date <= currentMonthEndStr),
    [expenses, currentMonthStartStr, currentMonthEndStr],
  );
  const currentHuntingIncome = useMemo(
    () => currentMonthRecords.reduce((sum, r) => sum + r.total_revenue, 0),
    [currentMonthRecords],
  );
  const currentHuntingExpense = useMemo(
    () => currentMonthRecords.reduce((sum, r) => sum + r.material_cost, 0),
    [currentMonthRecords],
  );
  const currentExpenseTotal = useMemo(
    () => currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [currentMonthExpenses],
  );
  const recentExpenses = useMemo(() => groupExpensesByDate(currentMonthExpenses).slice(0, 3), [currentMonthExpenses]);
  const currentBossIncome = currentBossWeeklySummary.totalRevenue + currentBossMonthlySummary.totalRevenue;
  const currentTotalIncome = currentHuntingIncome + currentBossIncome;
  const currentNetIncome = currentTotalIncome - currentHuntingExpense;
  const monthActiveDays = useMemo(() => new Set(currentMonthRecords.map((r) => r.date)).size, [currentMonthRecords]);

  const currentGoalTargetAmount = useMemo(() => {
    return goals.reduce((sum, goal) => {
      const targetAmount = goal.targets?.[0]?.target_amount ?? goal.meso_goal ?? 0;
      return sum + targetAmount;
    }, 0);
  }, [goals]);

  const goalProgressText = useMemo(() => {
    if (currentGoalTargetAmount <= 0) return '목표 미설정';
    const pct = Math.min((currentNetIncome / currentGoalTargetAmount) * 100, 999);
    return `${pct.toFixed(1)}%`;
  }, [currentGoalTargetAmount, currentNetIncome]);

  const profile = useStoredCharacterProfile();

  return (
    <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4">
      <Card className="overflow-hidden border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.2),rgba(245,158,11,0.06)_48%,transparent)] p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="maple-badge inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-amber-600">🍁 Maple Diary</p>
            <h1 className="maple-title mt-0.5 text-2xl font-bold text-t1">
              {profile?.character_name || '캐릭터'} 님
            </h1>
            <p className="mt-1 text-xs text-t2">오늘도 재획 화이팅</p>
          </div>
          <Link
            href="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-card/85 text-t2 shadow-[var(--shadow-sm)] transition-colors hover:text-t1"
          >
            ⚙️
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-card/80 p-3">
            <p className="text-[11px] text-t3">총 사냥</p>
            <p className="mt-1 text-lg font-bold text-t1">{visibleRecords.length}회</p>
          </div>
          <div className="rounded-xl bg-card/80 p-3">
            <p className="text-[11px] text-t3">최근 7일 평균</p>
            <p className="mt-1 text-lg font-bold text-t1">{formatMeso(Math.floor(chartData.average))}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <RevenueCard label="오늘" value={todayRevenueValue} />
        <InfoCard label="목표 진행" value={goalProgressText} />
        <InfoCard label="이번 달 활동일" value={`${monthActiveDays}일`} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-t1">최근 7일</p>
            <p className="text-[11px] text-t3">일자별 순수익 추이</p>
          </div>
          <p className="text-xs text-t3">평균 {formatMeso(Math.floor(chartData.average))}</p>
        </div>
        <MiniBarChart data={chartData.data} />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-t1">이번 달 지출</p>
            <p className="text-[11px] text-t3">구매/강화/소모 비용 요약</p>
          </div>
          <p className="text-xs font-semibold text-amber-600">{formatMeso(currentExpenseTotal)}</p>
        </div>
        {recentExpenses.length === 0 ? (
          <div className="rounded-xl bg-surface/60 px-4 py-6 text-center">
            <p className="text-sm text-t3">아직 지출이 없어요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentExpenses.map((group) => (
              <div key={group.date} className="rounded-xl border border-line bg-card/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-t1">{formatDateKorean(group.date)}</p>
                  <p className="text-xs font-semibold text-amber-600">-{formatMeso(group.totalAmount)}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.expenses.slice(0, 2).map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-t2">{expense.title}</span>
                      <span className="shrink-0 font-semibold text-t1">-{formatMeso(expense.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-t1">최근 사냥</p>
          <Link href="/records" className="text-xs font-semibold text-amber-500">
            전체보기
          </Link>
        </div>

        {recordsLoading && (
          <p className="text-sm text-t3 py-4 text-center">불러오는 중...</p>
        )}

        {!recordsLoading && recentGroups.length === 0 && (
          <div className="rounded-xl bg-surface/60 px-4 py-8 text-center">
            <p className="text-sm text-t3">아직 사냥이 없어요. 첫 사냥을 추가해보세요!</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {recentGroups.map((g) => (
            <DayRow key={g.date} group={g} />
          ))}
        </div>
      </Card>
    </main>
  );
}

function MiniBarChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl bg-surface/45 text-xs text-t3">
        최근 7일 사냥이 없습니다
      </div>
    );
  }

  const maxValue = Math.max(...data.map((item) => Math.abs(item.revenue)), 1);

  return (
    <div className="flex h-28 items-end gap-2" role="img" aria-label="최근 7일 일자별 순수익 막대그래프">
      {data.map((item) => {
        const height = Math.max(4, Math.round((Math.abs(item.revenue) / maxValue) * 84));
        return (
          <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className="flex min-h-0 w-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-7 rounded-t-md ${item.revenue < 0 ? 'bg-red-400' : 'bg-amber-500'}`}
                style={{ height }}
                title={`${item.date}: ${formatMeso(item.revenue)}`}
              />
            </div>
            <span className="text-[9px] text-t3">{item.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
