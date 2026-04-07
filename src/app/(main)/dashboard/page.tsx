'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useDashboardStore } from '@/shared/lib/stores/useDashboardStore';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { formatMeso, formatDateKorean, formatTime } from '@/shared/lib/utils/formatters';
import type { RecordWithCalculations } from '@/shared/types';

function RevenueCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex-1 min-w-0">
      <p className="text-xs text-t3 mb-1.5">{label}</p>
      <p className="text-lg font-bold text-t1 truncate">{formatMeso(value)}</p>
    </Card>
  );
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
    <Link href="/records" className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <div>
        <p className="text-sm font-medium text-t1">{formatDateKorean(group.date)}</p>
        <p className="text-xs text-t3 mt-0.5">
          {formatTime(group.totalTimeMinutes)}
          {multi && <span className="ml-1.5 text-amber-500">{group.records.length}회</span>}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-t1">{formatMeso(group.totalNetRevenue)}</p>
        <p className="text-xs text-t3">{formatMeso(group.netPerHour)}/h</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { open: openRecordModal } = useRecordModalStore();
  const initialized = useRef(false);

  const { initializeLocal, localOwnerId } = useAuthStore();
  const { records, loadRecords, loading } = useRecordStore();
  const { todayRevenue, weeklyRevenue, monthlyRevenue, recentRecords, sevenDayStats } =
    useDashboardStore();

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
    if (localOwnerId) loadRecords(localOwnerId);
  }, [localOwnerId, loadRecords]);

  const today = useMemo(() => todayRevenue(records), [todayRevenue, records]);
  const weekly = useMemo(() => weeklyRevenue(records), [weeklyRevenue, records]);
  const monthly = useMemo(() => monthlyRevenue(records), [monthlyRevenue, records]);
  const recent = useMemo(() => recentRecords(records, 9), [recentRecords, records]);
  const recentGroups = useMemo(() => groupByDate(recent).slice(0, 3), [recent]);
  const chartData = useMemo(() => sevenDayStats(records), [sevenDayStats, records]);

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('maple_diary:user_profile') || 'null');
    } catch {
      return null;
    }
  }, []);

  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-t3">안녕하세요</p>
          <h1 className="text-xl font-bold text-t1 mt-0.5">
            {profile?.character_name || '캐릭터'} 님
          </h1>
        </div>
        <Link href="/settings" className="w-10 h-10 flex items-center justify-center rounded-xl bg-card text-t2 hover:text-t1 text-lg">
          ⚙️
        </Link>
      </div>

      <div className="flex gap-3">
        <RevenueCard label="오늘" value={today} />
        <RevenueCard label="이번 주" value={weekly} />
        <RevenueCard label="이번 달" value={monthly} />
      </div>

      {chartData.data.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-t1">최근 7일</p>
            <p className="text-xs text-t3">평균 {formatMeso(chartData.average)}</p>
          </div>
          <MiniBarChart data={chartData.data} />
        </Card>
      )}

      <Button size="lg" fullWidth onClick={openRecordModal}>
        + 오늘 기록 추가
      </Button>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-t1">최근 기록</p>
          <Link href="/records" className="text-xs text-amber-400 font-medium">
            전체보기
          </Link>
        </div>

        {loading && (
          <p className="text-sm text-t3 py-4 text-center">불러오는 중...</p>
        )}

        {!loading && recentGroups.length === 0 && (
          <p className="text-sm text-t3 py-6 text-center">
            아직 기록이 없어요. 첫 기록을 추가해보세요!
          </p>
        )}

        {recentGroups.map((g) => (
          <DayRow key={g.date} group={g} />
        ))}
      </Card>
    </main>
  );
}

function MiniBarChart({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d) => {
        const heightPct = Math.max((d.revenue / max) * 100, 6);
        const dateLabel = d.date.slice(5);
        return (
          <div key={d.date} className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-full bg-amber-500 rounded"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[9px] text-t3">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
