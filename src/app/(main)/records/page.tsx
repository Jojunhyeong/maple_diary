'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { formatMeso, formatDateKorean, formatTime } from '@/shared/lib/utils/formatters';
import type { RecordWithCalculations } from '@/shared/types';

type Filter = 'week' | 'month' | 'pick' | 'all';

interface DayGroup {
  date: string;
  records: RecordWithCalculations[];
  totalNetRevenue: number;
  totalTimeMinutes: number;
  netPerHour: number;
}

const PAGE_SIZE = 10; // 날짜 단위 페이징

function toYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    const netPerHour = totalTimeMinutes > 0 ? (totalNetRevenue / totalTimeMinutes) * 60 : 0;
    return { date, records: recs, totalNetRevenue, totalTimeMinutes, netPerHour };
  });
}

export default function RecordsPage() {
  const { localOwnerId } = useAuthStore();
  const { records, loadRecords, deleteRecord, loading } = useRecordStore();
  const [filter, setFilter] = useState<Filter>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => toYearMonth(new Date()));
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (localOwnerId) loadRecords(localOwnerId);
  }, [localOwnerId, loadRecords]);

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(toYearMonth(d));
    setPage(0);
  };

  const filtered = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (filter === 'week') {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay() + 1);
      const monStr = mon.toISOString().split('T')[0];
      return records.filter((r) => r.date >= monStr && r.date <= todayStr);
    }
    if (filter === 'month') {
      const firstStr = `${toYearMonth(today)}-01`;
      return records.filter((r) => r.date >= firstStr && r.date <= todayStr);
    }
    if (filter === 'pick') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const firstStr = `${selectedMonth}-01`;
      const lastDate = new Date(y, m, 0).getDate();
      const lastStr = `${selectedMonth}-${String(lastDate).padStart(2, '0')}`;
      return records.filter((r) => r.date >= firstStr && r.date <= lastStr);
    }
    return records;
  }, [records, filter, selectedMonth]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const paginatedGroups = groups.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = groups.length > paginatedGroups.length;

  const totalRevenue = filtered.reduce((s, r) => s + r.net_revenue, 0);

  return (
    <main className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold text-t1">기록 목록</h1>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(['week', 'month', 'pick', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-amber-500 text-white'
                : 'bg-card text-t2 border border-line'
            }`}
          >
            {f === 'week' ? '이번 주' : f === 'month' ? '이번 달' : f === 'pick' ? '월 선택' : '전체'}
          </button>
        ))}
      </div>

      {/* 월 선택기 */}
      {filter === 'pick' && (
        <div className="flex items-center justify-between bg-card rounded-xl px-4 py-2.5 border border-line">
          <button onClick={() => changeMonth(-1)} className="text-t2 px-2 py-1 text-lg">‹</button>
          <span className="text-sm font-semibold text-t1">{selectedMonth.replace('-', '년 ')}월</span>
          <button
            onClick={() => changeMonth(1)}
            disabled={selectedMonth >= toYearMonth(new Date())}
            className="text-t2 px-2 py-1 text-lg disabled:opacity-30"
          >›</button>
        </div>
      )}

      {/* 요약 */}
      {filtered.length > 0 && (
        <Card variant="highlight">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-t3">일수</span>
            <span className="text-t1 text-right">{groups.length}일</span>
            <span className="text-t3">총 순수익</span>
            <span className="text-t1 text-right font-bold">{formatMeso(totalRevenue)}</span>
          </div>
        </Card>
      )}

      {loading && <p className="text-sm text-t3 text-center py-8">불러오는 중...</p>}
      {!loading && groups.length === 0 && <p className="text-sm text-t3 text-center py-8">기록이 없습니다</p>}

      <div className="flex flex-col gap-3">
        {paginatedGroups.map((group) => (
          <DayGroupCard
            key={group.date}
            group={group}
            onDelete={(id) => setConfirmDelete(id)}
          />
        ))}
      </div>

      {hasMore && (
        <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
          더 보기
        </Button>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <Card className="w-full max-w-sm">
            <p className="text-t1 font-semibold mb-2">기록 삭제</p>
            <p className="text-t3 text-sm mb-6">이 기록을 삭제하시겠습니까?</p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>취소</Button>
              <Button variant="danger" fullWidth onClick={async () => {
                await deleteRecord(confirmDelete);
                setConfirmDelete(null);
              }}>삭제</Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

function DayGroupCard({ group, onDelete }: { group: DayGroup; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const multi = group.records.length > 1;

  return (
    <Card>
      {/* 날짜 행 (항상 표시) */}
      <button className="w-full flex items-center justify-between" onClick={() => setExpanded((v) => !v)}>
        <div className="text-left">
          <p className="text-sm font-medium text-t1">{formatDateKorean(group.date)}</p>
          <p className="text-xs text-t3">
            {formatTime(group.totalTimeMinutes)}
            {multi && <span className="ml-1.5 text-amber-500">기록 {group.records.length}회</span>}
          </p>
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <p className="text-sm font-bold text-t1">{formatMeso(group.totalNetRevenue)}</p>
            <p className="text-xs text-t3">{formatMeso(group.netPerHour)}/h</p>
          </div>
          {multi && <span className="text-t3 text-xs">{expanded ? '▲' : '▼'}</span>}
        </div>
      </button>

      {/* 단일 기록 상세 */}
      {expanded && !multi && (
        <SingleRecordDetail record={group.records[0]} onDelete={() => onDelete(group.records[0].id)} />
      )}

      {/* 다중 기록 상세 */}
      {expanded && multi && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-3">
          {group.records.map((r, i) => (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-t2">{i + 1}회차 · {formatTime(r.time_minutes)}</p>
                <button onClick={() => onDelete(r.id)} className="text-xs text-red-400 font-medium">삭제</button>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs pl-1">
                <span className="text-t3">메소</span>
                <span className="text-t2 text-right">{formatMeso(r.meso)}</span>
                <span className="text-t3">조각 {r.shard_count}개</span>
                <span className="text-t2 text-right">{formatMeso(r.shard_value)}</span>
                <span className="text-t3">소재비</span>
                <span className="text-t2 text-right">-{formatMeso(r.material_cost)}</span>
                <span className="text-t3">순수익</span>
                <span className="text-t1 text-right font-medium">{formatMeso(r.net_revenue)}</span>
                {r.memo && (
                  <>
                    <span className="text-t3">메모</span>
                    <span className="text-t2 text-right">{r.memo}</span>
                  </>
                )}
              </div>
              {i < group.records.length - 1 && <div className="border-b border-line mt-1" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SingleRecordDetail({ record, onDelete }: { record: RecordWithCalculations; onDelete: () => void }) {
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
        <span className="text-t3">메소</span>
        <span className="text-t2 text-right">{formatMeso(record.meso)}</span>
        <span className="text-t3">조각 {record.shard_count}개</span>
        <span className="text-t2 text-right">{formatMeso(record.shard_value)}</span>
        <span className="text-t3">소재비</span>
        <span className="text-t2 text-right">-{formatMeso(record.material_cost)}</span>
        {record.memo && (
          <>
            <span className="text-t3">메모</span>
            <span className="text-t2 text-right">{record.memo}</span>
          </>
        )}
      </div>
      <Button variant="danger" size="sm" onClick={onDelete}>삭제</Button>
    </div>
  );
}
