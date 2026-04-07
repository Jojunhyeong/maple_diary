'use client';

import { useEffect, useMemo } from 'react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { Card } from '@/shared/ui/Card';
import { calculateWeeklyStats } from '@/shared/lib/utils/calculations';
import { formatMeso, formatTime } from '@/shared/lib/utils/formatters';
import type { WeekStats } from '@/shared/lib/utils/calculations';

export default function AnalysisPage() {
  const { localOwnerId } = useAuthStore();
  const { records, loadRecords } = useRecordStore();

  useEffect(() => {
    if (localOwnerId) loadRecords(localOwnerId);
  }, [localOwnerId, loadRecords]);

  const weeks = useMemo(() => calculateWeeklyStats(records, 4), [records]);
  const thisWeek = weeks[0];
  const lastWeek = weeks[1];

  if (records.length === 0) {
    return (
      <main className="flex flex-col gap-5 px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-t1">수익 분석</h1>
        <p className="text-sm text-t3 text-center py-16">분석할 기록이 없습니다</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold text-t1">수익 분석</h1>

      {/* 이번 주 통계 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-t1">이번 주 통계</p>
          <span className="text-xs text-t3">{thisWeek.count}회 사냥</span>
        </div>
        {thisWeek.count === 0 ? (
          <p className="text-sm text-t3 text-center py-4">이번 주 기록이 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatItem
              label="회당 순수익"
              value={formatMeso(thisWeek.avgNetRevenue)}
              compare={lastWeek.count > 0 ? thisWeek.avgNetRevenue - lastWeek.avgNetRevenue : null}
            />
            <StatItem
              label="평균 사냥 시간"
              value={formatTime(thisWeek.avgTimeMinutes)}
              compare={lastWeek.count > 0 ? thisWeek.avgTimeMinutes - lastWeek.avgTimeMinutes : null}
              unit="min"
            />
            <StatItem
              label="시간당 순수익"
              value={formatMeso(thisWeek.avgNetPerHour)}
              compare={lastWeek.count > 0 ? thisWeek.avgNetPerHour - lastWeek.avgNetPerHour : null}
            />
            <StatItem
              label="회당 조각"
              value={`${thisWeek.avgShards.toLocaleString()}개`}
              compare={lastWeek.count > 0 ? thisWeek.avgShards - lastWeek.avgShards : null}
              unit="shard"
            />
          </div>
        )}
      </Card>

      {/* 주간 비교 */}
      <Card>
        <p className="text-sm font-semibold text-t1 mb-4">주간 비교</p>
        <div className="flex flex-col gap-3">
          {weeks.map((w, i) => (
            <WeekRow key={w.startDate} week={w} isThis={i === 0} />
          ))}
        </div>
      </Card>

      {/* 이번 주 vs 저번 주 상세 비교 */}
      {thisWeek.count > 0 && lastWeek.count > 0 && (
        <Card>
          <p className="text-sm font-semibold text-t1 mb-4">이번 주 vs 저번 주</p>
          <CompareRow label="회당 순수익" this={thisWeek.avgNetRevenue} last={lastWeek.avgNetRevenue} format={formatMeso} />
          <CompareRow label="시간당 순수익" this={thisWeek.avgNetPerHour} last={lastWeek.avgNetPerHour} format={formatMeso} />
          <CompareRow label="회당 조각" this={thisWeek.avgShards} last={lastWeek.avgShards} format={(v) => `${v.toLocaleString()}개`} />
          <CompareRow label="총 순수익" this={thisWeek.totalNetRevenue} last={lastWeek.totalNetRevenue} format={formatMeso} />
        </Card>
      )}
    </main>
  );
}

function StatItem({ label, value, compare, unit }: {
  label: string;
  value: string;
  compare: number | null;
  unit?: string;
}) {
  const isPositive = compare !== null && compare > 0;
  const isNegative = compare !== null && compare < 0;
  const isTime = unit === 'min';

  // 시간은 짧을수록 좋음 (반전)
  const goodDirection = isTime ? isNegative : isPositive;
  const badDirection = isTime ? isPositive : isNegative;

  return (
    <div className="bg-surface rounded-xl p-3">
      <p className="text-xs text-t3 mb-1">{label}</p>
      <p className="text-sm font-bold text-t1">{value}</p>
      {compare !== null && compare !== 0 && (
        <p className={`text-[10px] mt-0.5 font-medium ${goodDirection ? 'text-green-500' : badDirection ? 'text-red-400' : 'text-t3'}`}>
          {isTime
            ? `${compare > 0 ? '+' : ''}${compare}분 저번 주 대비`
            : unit === 'shard'
            ? `${compare > 0 ? '+' : ''}${compare}개 저번 주 대비`
            : `${compare > 0 ? '+' : ''}${formatMeso(compare)} 저번 주 대비`}
        </p>
      )}
      {compare === 0 && (
        <p className="text-[10px] mt-0.5 text-t3">저번 주와 동일</p>
      )}
    </div>
  );
}

function WeekRow({ week, isThis }: { week: WeekStats; isThis: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${!isThis ? 'border-t border-line' : ''}`}>
      <div>
        <p className="text-sm font-medium text-t1">
          {week.weekLabel}
          {isThis && <span className="ml-2 text-[10px] bg-amber-500 text-white rounded px-1.5 py-0.5">현재</span>}
        </p>
        <p className="text-xs text-t3 mt-0.5">{week.startDate} ~ {week.endDate} · {week.count}회</p>
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
    <div className="flex items-center justify-between py-2 border-t border-line first:border-0">
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
