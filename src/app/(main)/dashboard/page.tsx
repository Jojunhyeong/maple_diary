'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';
import { useMigrateOnLogin } from '@/shared/lib/hooks/useMigrateOnLogin';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useGoalStore } from '@/shared/lib/stores/useGoalStore';
import { useDashboardStore } from '@/shared/lib/stores/useDashboardStore';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { formatMeso, formatDateKorean, formatTime } from '@/shared/lib/utils/formatters';
import type { RecordWithCalculations } from '@/shared/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

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

function getCurrentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface DayGroup {
  date: string;
  records: RecordWithCalculations[];
  totalNetRevenue: number;
  totalTimeMinutes: number;
  netPerHour: number;
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
  const { open: openRecordModal } = useRecordModalStore();
  const initialized = useRef(false);
  useMigrateOnLogin();

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { initializeLocal, localOwnerId } = useAuthStore();
  const { currentGoal, loadGoal } = useGoalStore();
  const { records, loadRecords, loading } = useRecordStore();
  const { todayRevenue, recentRecords, sevenDayStats } =
    useDashboardStore();
  const currentMonth = useMemo(() => getCurrentMonth(new Date()), []);

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

  useEffect(() => {
    if (!localOwnerId) return;
    loadRecords(localOwnerId, isLoggedIn);
    loadGoal(localOwnerId, currentMonth, isLoggedIn);
  }, [localOwnerId, loadRecords, loadGoal, currentMonth, isLoggedIn]);

  const today = useMemo(() => todayRevenue(records), [todayRevenue, records]);
  const recent = useMemo(() => recentRecords(records, 9), [recentRecords, records]);
  const recentGroups = useMemo(() => groupByDate(recent).slice(0, 3), [recent]);
  const chartData = useMemo(() => sevenDayStats(records), [sevenDayStats, records]);
  const monthNetRevenue = useMemo(() => {
    return records
      .filter((r) => r.date.startsWith(currentMonth))
      .reduce((sum, r) => sum + r.net_revenue, 0);
  }, [records, currentMonth]);
  const monthActiveDays = useMemo(() => {
    return new Set(records.filter((r) => r.date.startsWith(currentMonth)).map((r) => r.date)).size;
  }, [records, currentMonth]);

  const goalProgressText = useMemo(() => {
    if (!currentGoal?.meso_goal || currentGoal.meso_goal <= 0) return '목표 미설정';
    const pct = Math.min((monthNetRevenue / currentGoal.meso_goal) * 100, 999);
    return `${pct.toFixed(1)}%`;
  }, [currentGoal?.meso_goal, monthNetRevenue]);

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('maple_diary:user_profile') || 'null');
    } catch {
      return null;
    }
  }, []);

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
            <p className="text-[11px] text-t3">총 기록</p>
            <p className="mt-1 text-lg font-bold text-t1">{records.length}회</p>
          </div>
          <div className="rounded-xl bg-card/80 p-3">
            <p className="text-[11px] text-t3">최근 7일 평균</p>
            <p className="mt-1 text-lg font-bold text-t1">{formatMeso(Math.floor(chartData.average))}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <RevenueCard label="오늘" value={today} />
        <InfoCard label="이달 목표 진행" value={goalProgressText} />
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

      <Button size="lg" fullWidth onClick={openRecordModal}>
        + 오늘 기록 추가
      </Button>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-t1">최근 기록</p>
          <Link href="/records" className="text-xs font-semibold text-amber-500">
            전체보기
          </Link>
        </div>

        {loading && (
          <p className="text-sm text-t3 py-4 text-center">불러오는 중...</p>
        )}

        {!loading && recentGroups.length === 0 && (
          <div className="rounded-xl bg-surface/60 px-4 py-8 text-center">
            <p className="text-sm text-t3">아직 기록이 없어요. 첫 기록을 추가해보세요!</p>
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
        최근 7일 기록이 없습니다
      </div>
    );
  }

  const labels = data.map((d) => d.date.slice(5));
  const datasetData = data.map((d) => d.revenue);

  const chartData: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: datasetData,
        backgroundColor: '#f59e0b',
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const maxValue = Math.max(...datasetData, 1);
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => formatMeso(Number(ctx.raw ?? 0)),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#a1a1aa',
          font: { size: 9 },
        },
      },
      y: {
        display: false,
        beginAtZero: true,
        suggestedMax: maxValue * 1.1,
      },
    },
  };

  return (
    <div className="h-28">
      <Bar data={chartData} options={options} />
    </div>
  );
}
