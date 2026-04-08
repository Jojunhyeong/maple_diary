'use client';

import { useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { Card } from '@/shared/ui/Card';
import { calculateWeeklyStats } from '@/shared/lib/utils/calculations';
import { formatDateKorean, formatMeso, formatTime } from '@/shared/lib/utils/formatters';
import type { RecordWithCalculations } from '@/shared/types';
import type { WeekStats } from '@/shared/lib/utils/calculations';

type WeekdayStats = {
  label: string;
  count: number;
  totalNetRevenue: number;
  avgNetPerHour: number;
};

type MonthlyReport = {
  monthLabel: string;
  currentTotal: number;
  previousTotal: number;
  diff: number;
  diffPct: number | null;
  activeDays: number;
  totalMinutes: number;
  avgPerActiveDay: number;
  avgPerHour: number;
  bestDay: { date: string; revenue: number } | null;
};

export default function AnalysisPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { records, loadRecords } = useRecordStore();

  useEffect(() => {
    if (localOwnerId) loadRecords(localOwnerId, isLoggedIn);
  }, [localOwnerId, loadRecords, isLoggedIn]);

  const weeks = useMemo(() => calculateWeeklyStats(records, 4), [records]);
  const thisWeek = weeks[0];
  const lastWeek = weeks[1];
  const weekdayStats = useMemo(() => buildWeekdayStats(records), [records]);
  const topRecords = useMemo(() => buildTopRecords(records, 3), [records]);
  const monthlyReport = useMemo(() => buildMonthlyReport(records), [records]);

  if (records.length === 0) {
    return (
      <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4">
        <h1 className="maple-title text-2xl font-bold text-t1">수익 분석</h1>
        <Card className="py-12 text-center">
          <p className="text-sm text-t3">분석할 기록이 없습니다</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4">
      <div>
        <h1 className="maple-title text-2xl font-bold text-t1">수익 분석</h1>
        <p className="mt-1 text-xs text-t3">메이플 재획 페이스를 주간 단위로 비교합니다</p>
      </div>

      <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05)_55%,transparent)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-t1">월간 리포트 · {monthlyReport.monthLabel}</p>
            <p className="text-[11px] text-t3">이번 달 누적 성과 요약</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-t1">{formatMeso(monthlyReport.currentTotal)}</p>
            <p className={`text-[11px] font-semibold ${
              monthlyReport.diff > 0 ? 'text-green-500' : monthlyReport.diff < 0 ? 'text-red-400' : 'text-t3'
            }`}>
              {monthlyReport.diff > 0 ? '+' : ''}{formatMeso(monthlyReport.diff)}
              {monthlyReport.diffPct !== null ? ` (${monthlyReport.diffPct > 0 ? '+' : ''}${monthlyReport.diffPct}%)` : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ReportItem label="지난달 총 순수익" value={formatMeso(monthlyReport.previousTotal)} />
          <ReportItem label="총 재획 시간" value={formatTime(monthlyReport.totalMinutes)} />
          <ReportItem label="활동 일수" value={`${monthlyReport.activeDays}일`} />
          <ReportItem label="활동일 평균 순수익" value={formatMeso(monthlyReport.avgPerActiveDay)} />
          <ReportItem label="시간당 평균 순수익" value={`${formatMeso(monthlyReport.avgPerHour)}/h`} />
        </div>

        <div className="mt-3 rounded-xl border border-line bg-card/80 px-3 py-2.5">
          <p className="text-[11px] text-t3">베스트 데이</p>
          {monthlyReport.bestDay ? (
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-t2">{formatDateKorean(monthlyReport.bestDay.date)}</p>
              <p className="text-sm font-bold text-amber-600">{formatMeso(monthlyReport.bestDay.revenue)}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-t3">이번 달 기록이 없습니다</p>
          )}
        </div>
      </Card>

      {/* 이번 주 통계 */}
      <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.18),rgba(245,158,11,0.05)_45%,transparent)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-t1">이번 주 통계</p>
          <span className="rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-t2">{thisWeek.activeDays}일 활동</span>
        </div>
        {thisWeek.count === 0 ? (
          <p className="text-sm text-t3 text-center py-4">이번 주 기록이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              label="날짜당 순수익"
              value={formatMeso(thisWeek.avgDailyNetRevenue)}
              compare={lastWeek.count > 0 ? thisWeek.avgDailyNetRevenue - lastWeek.avgDailyNetRevenue : null}
            />
            <StatItem
              label="시간당 순수익"
              value={formatMeso(thisWeek.avgNetPerHour)}
              compare={lastWeek.count > 0 ? thisWeek.avgNetPerHour - lastWeek.avgNetPerHour : null}
            />
          </div>
        )}
      </Card>

      {/* 주간 비교 */}
      <Card>
        <p className="text-sm font-semibold text-t1 mb-4">주간 비교</p>
        <div className="flex flex-col gap-2">
          {weeks.map((w, i) => (
            <WeekRow key={w.startDate} week={w} isThis={i === 0} />
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-t1">요일별 성과</p>
        <div className="grid grid-cols-2 gap-2">
          {weekdayStats.map((d) => (
            <div key={d.label} className="rounded-xl border border-line bg-surface/35 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-t2">{d.label}</p>
                <p className="text-[10px] text-t3">{d.count}회</p>
              </div>
              <p className="text-sm font-bold text-t1">{formatMeso(d.totalNetRevenue)}</p>
              <p className="mt-0.5 text-[10px] text-t3">{formatMeso(d.avgNetPerHour)}/h</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-t1">역대 최고 기록 TOP 3</p>
        <div className="flex flex-col gap-2">
          {topRecords.map((r, idx) => (
            <div key={r.id} className="rounded-xl border border-line bg-surface/35 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-600">#{idx + 1}</p>
                <p className="text-[11px] text-t3">{formatDateKorean(r.date)}</p>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                <span className="text-t3">순수익</span>
                <span className="text-right font-semibold text-t1">{formatMeso(r.net_revenue)}</span>
                <span className="text-t3">시간당 순수익</span>
                <span className="text-right text-t2">{formatMeso(r.net_per_hour)}/h</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 이번 주 vs 저번 주 상세 비교 */}
      {thisWeek.count > 0 && lastWeek.count > 0 && (
        <Card>
          <p className="text-sm font-semibold text-t1 mb-4">이번 주 vs 저번 주</p>
          <CompareRow label="날짜당 순수익" this={thisWeek.avgDailyNetRevenue} last={lastWeek.avgDailyNetRevenue} format={formatMeso} />
          <CompareRow label="시간당 순수익" this={thisWeek.avgNetPerHour} last={lastWeek.avgNetPerHour} format={formatMeso} />
        </Card>
      )}
    </main>
  );
}

function ReportItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card/75 p-2.5">
      <p className="text-[10px] text-t3">{label}</p>
      <p className="mt-1 text-sm font-semibold text-t1">{value}</p>
    </div>
  );
}

function StatItem({ label, value, compare }: {
  label: string;
  value: string;
  compare: number | null;
}) {
  const isPositive = compare !== null && compare > 0;
  const isNegative = compare !== null && compare < 0;
  const goodDirection = isPositive;
  const badDirection = isNegative;

  return (
    <div className="rounded-xl border border-line bg-card/85 p-3 shadow-[var(--shadow-sm)]">
      <p className="mb-1 text-xs text-t3">{label}</p>
      <p className="text-sm font-bold text-t1">{value}</p>
      {compare !== null && compare !== 0 && (
        <p className={`mt-1 text-[10px] font-medium ${goodDirection ? 'text-green-500' : badDirection ? 'text-red-400' : 'text-t3'}`}>
          {`${compare > 0 ? '+' : ''}${formatMeso(compare)} 저번 주 대비`}
        </p>
      )}
      {compare === 0 && (
        <p className="text-[10px] mt-0.5 text-t3">저번 주와 동일</p>
      )}
    </div>
  );
}

function buildWeekdayStats(records: RecordWithCalculations[]): WeekdayStats[] {
  const labels = ['월', '화', '수', '목', '금', '토', '일'];
  const bucket = Array.from({ length: 7 }, (_, idx) => ({
    label: labels[idx],
    count: 0,
    totalNetRevenue: 0,
    totalTimeMinutes: 0,
  }));

  records.forEach((r) => {
    const date = new Date(`${r.date}T00:00:00`);
    const day = date.getDay();
    const index = day === 0 ? 6 : day - 1;
    bucket[index].count += 1;
    bucket[index].totalNetRevenue += r.net_revenue;
    bucket[index].totalTimeMinutes += r.time_minutes;
  });

  return bucket.map((b) => ({
    label: b.label,
    count: b.count,
    totalNetRevenue: b.totalNetRevenue,
    avgNetPerHour:
      b.totalTimeMinutes > 0 ? Math.floor((b.totalNetRevenue / b.totalTimeMinutes) * 60) : 0,
  }));
}

function buildTopRecords(records: RecordWithCalculations[], count: number): RecordWithCalculations[] {
  return [...records].sort((a, b) => b.net_revenue - a.net_revenue).slice(0, count);
}

function buildMonthlyReport(records: RecordWithCalculations[]): MonthlyReport {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`;
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currentRecords = records.filter((r) => r.date.startsWith(currentMonth));
  const previousRecords = records.filter((r) => r.date.startsWith(prevMonth));

  const currentTotal = currentRecords.reduce((s, r) => s + r.net_revenue, 0);
  const previousTotal = previousRecords.reduce((s, r) => s + r.net_revenue, 0);
  const diff = currentTotal - previousTotal;
  const diffPct = previousTotal > 0 ? Math.round((diff / previousTotal) * 100) : null;
  const totalMinutes = currentRecords.reduce((s, r) => s + r.time_minutes, 0);

  const byDate = new Map<string, number>();
  currentRecords.forEach((r) => byDate.set(r.date, (byDate.get(r.date) || 0) + r.net_revenue));
  const activeDays = byDate.size;
  const avgPerActiveDay = activeDays > 0 ? Math.floor(currentTotal / activeDays) : 0;
  const avgPerHour = totalMinutes > 0 ? Math.floor((currentTotal / totalMinutes) * 60) : 0;

  const bestDay = Array.from(byDate.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => b.revenue - a.revenue)[0] ?? null;

  return {
    monthLabel: `${month}월`,
    currentTotal,
    previousTotal,
    diff,
    diffPct,
    activeDays,
    totalMinutes,
    avgPerActiveDay,
    avgPerHour,
    bestDay,
  };
}

function WeekRow({ week, isThis }: { week: WeekStats; isThis: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${isThis ? 'bg-amber-500/10' : 'bg-surface/35'}`}>
      <div>
        <p className="text-sm font-medium text-t1">
          {week.weekLabel}
          {isThis && <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">현재</span>}
        </p>
        <p className="mt-0.5 text-xs text-t3">{week.startDate} ~ {week.endDate} · {week.activeDays}일 활동</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-t1">{week.count > 0 ? formatMeso(week.totalNetRevenue) : '-'}</p>
        <p className="text-xs text-t3">{week.count > 0 ? `${formatMeso(week.avgNetPerHour)}/h` : '-'}</p>
      </div>
    </div>
  );
}

function CompareRow({ label, this: thisVal, last: lastVal, format }: {
  label: string;
  this: number;
  last: number;
  format: (v: number) => string;
}) {
  const diff = thisVal - lastVal;
  const pct = lastVal > 0 ? Math.round((diff / lastVal) * 100) : 0;
  const up = diff > 0;

  return (
    <div className="flex items-center justify-between border-t border-line py-2 first:border-0">
      <p className="text-sm text-t2">{label}</p>
      <div className="text-right">
        <p className="text-sm font-bold text-t1">{format(thisVal)}</p>
        {diff !== 0 && (
          <p className={`text-[10px] font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(pct)}% ({up ? '+' : ''}{format(diff)})
          </p>
        )}
      </div>
    </div>
  );
}
