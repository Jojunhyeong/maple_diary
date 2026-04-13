'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useGoalStore } from '@/shared/lib/stores/useGoalStore';
import { useActiveCharacterId } from '@/shared/lib/hooks/useActiveCharacterId';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { formatDate, formatMeso, fromManInput, toManDisplay } from '@/shared/lib/utils/formatters';
import { useBossRevenueSummary } from '@/shared/lib/hooks/useBossRevenueSummary';

function getCurrentMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function GoalsPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId, initializeLocal } = useAuthStore();
  const { records, loadRecords } = useRecordStore();
  const { currentGoal, loadGoal, saveGoal, error: goalError, clearError } = useGoalStore();
  const activeCharacterId = useActiveCharacterId();

  const [editing, setEditing] = useState(false);
  const [mesoGoalMan, setMesoGoalMan] = useState('');  // 만 단위
  const [shardGoal, setShardGoal] = useState('');       // 개 단위
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const currentMonth = getCurrentMonth(new Date());

  useEffect(() => {
    initializeLocal();
  }, [initializeLocal]);

  useEffect(() => {
    if (localOwnerId) {
      loadRecords(localOwnerId, isLoggedIn, activeCharacterId);
      loadGoal(localOwnerId, currentMonth, isLoggedIn);
    }
  }, [localOwnerId, loadRecords, loadGoal, currentMonth, isLoggedIn, activeCharacterId]);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );
  const monthEnd = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0),
    [today],
  );

  const goalStartDate = useMemo(() => {
    if (!currentGoal?.created_at) return monthStart;
    const created = new Date(currentGoal.created_at);
    if (Number.isNaN(created.getTime())) return monthStart;
    created.setHours(0, 0, 0, 0);
    if (created < monthStart) return monthStart;
    if (created > monthEnd) return monthEnd;
    return created;
  }, [currentGoal?.created_at, monthStart, monthEnd]);

  const goalStartStr = useMemo(() => formatDate(goalStartDate), [goalStartDate]);
  const todayStr = useMemo(() => formatDate(today), [today]);
  const bossWeeklySummary = useBossRevenueSummary(monthStart, today, isLoggedIn, 'weekly');
  const bossMonthlySummary = useBossRevenueSummary(monthStart, today, isLoggedIn, 'monthly');

  const scopedRecords = useMemo(() => {
    return records.filter((r) => r.date >= goalStartStr && r.date <= todayStr);
  }, [records, goalStartStr, todayStr]);

  const totalMeso = scopedRecords.reduce((s, r) => s + r.net_revenue, 0);
  const totalShards = scopedRecords.reduce((s, r) => s + r.shard_count, 0);
  const huntingMeso = totalMeso;
  const bossMeso = bossWeeklySummary.totalRevenue + bossMonthlySummary.totalRevenue;
  const totalCombinedMeso = huntingMeso + bossMeso;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.max(1, Math.floor((today.getTime() - goalStartDate.getTime()) / msPerDay) + 1);
  const totalGoalDays = Math.max(1, Math.floor((monthEnd.getTime() - goalStartDate.getTime()) / msPerDay) + 1);

  const handleSave = async () => {
    clearError();
    setFormError('');

    if (!localOwnerId) {
      setFormError('사용자 초기화 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const mesoGoal = fromManInput(mesoGoalMan) || undefined;
    const shard = parseInt(shardGoal) || undefined;
    if (!mesoGoal && !shard) {
      setFormError('메소 목표 또는 조각 목표를 하나 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await saveGoal(
        {
          local_owner_id: localOwnerId,
          month: currentMonth,
          meso_goal: mesoGoal,
          shard_goal: shard,
        },
        localOwnerId,
        isLoggedIn,
      );
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setMesoGoalMan(currentGoal?.meso_goal ? toManDisplay(currentGoal.meso_goal) : '');
    setShardGoal(currentGoal?.shard_goal ? String(currentGoal.shard_goal) : '');
    setEditing(true);
  };

  const mesoGoalPreview = fromManInput(mesoGoalMan);

  return (
    <main className="maple-fade-up flex flex-col gap-5 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="maple-title text-2xl font-bold text-t1">목표</h1>
          <p className="mt-1 text-xs text-t3">🍁 사냥(월~일) + 보스(목~수 / 월간 검마) 합산 목표</p>
        </div>
        <Button variant="ghost" size="sm" onClick={openEdit}>
          {currentGoal ? '수정' : '+ 목표 설정'}
        </Button>
      </div>

      {!currentGoal && !editing && (
        <Card className="border-amber-500/20 bg-[linear-gradient(130deg,rgba(245,158,11,0.18),rgba(245,158,11,0.04)_55%,transparent)] py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-4xl">🎯</p>
            <p className="text-sm text-t2">이번 달 목표를 설정해보세요</p>
            <Button onClick={openEdit}>목표 설정하기</Button>
          </div>
        </Card>
      )}

      {editing && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-t2 mb-4">목표 설정</p>
          <div className="flex flex-col gap-4">
            <div>
              <Input
                label="메소 목표"
                placeholder="예: 100000"
                value={mesoGoalMan}
                onChange={(e) => setMesoGoalMan(e.target.value.replace(/\D/g, ''))}
                suffix="만"
                inputMode="numeric"
              />
              {mesoGoalPreview > 0 && (
                <p className="text-xs text-t3 mt-1.5 ml-1">= {formatMeso(mesoGoalPreview)}</p>
              )}
            </div>
            <Input
              label="조각 목표 (선택)"
              placeholder="예: 1000"
              value={shardGoal}
              onChange={(e) => setShardGoal(e.target.value.replace(/\D/g, ''))}
              suffix="개"
              inputMode="numeric"
            />
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setEditing(false)}>
                취소
              </Button>
              <Button fullWidth onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
            {(formError || goalError) && (
              <p className="text-xs text-red-500">{formError || goalError}</p>
            )}
          </div>
        </Card>
      )}

      {currentGoal && !editing && (
        <>
          {currentGoal.meso_goal && (
            <GoalProgressCard
              label="메소 목표"
              current={totalCombinedMeso}
              goal={currentGoal.meso_goal}
              format={formatMeso}
              daysElapsed={daysElapsed}
              totalGoalDays={totalGoalDays}
              goalStartStr={goalStartStr}
              subtitle="사냥 + 주간 보스 + 월간 보스"
              breakdown={{
                hunting: huntingMeso,
                boss: bossMeso,
              }}
            />
          )}
          {currentGoal.shard_goal && (
            <GoalProgressCard
              label="조각 목표"
              current={totalShards}
              goal={currentGoal.shard_goal}
              format={(v) => `${v.toLocaleString()}개`}
              daysElapsed={daysElapsed}
              totalGoalDays={totalGoalDays}
              goalStartStr={goalStartStr}
            />
          )}
        </>
      )}
    </main>
  );
}

function GoalProgressCard({
  label, current, goal, format, daysElapsed, totalGoalDays, goalStartStr, subtitle, breakdown,
}: {
  label: string;
  current: number;
  goal: number;
  format: (v: number) => string;
  daysElapsed: number;
  totalGoalDays: number;
  goalStartStr: string;
  subtitle?: string;
  breakdown?: {
    hunting: number;
    boss: number;
  };
}) {
  const pct = Math.min((current / goal) * 100, 100);
  const remaining = Math.max(goal - current, 0);
  const dailyAvg = daysElapsed > 0 ? current / daysElapsed : 0;
  const onTrack = dailyAvg * totalGoalDays >= goal;
  const huntingPortion = breakdown && current > 0 ? (breakdown.hunting / current) * pct : 0;
  const bossPortion = breakdown && current > 0 ? (breakdown.boss / current) * pct : 0;

  let expectedDate: string | null = null;
  if (remaining > 0 && dailyAvg > 0) {
    const d = new Date();
    d.setDate(d.getDate() + Math.ceil(remaining / dailyAvg));
    expectedDate = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-t2">{label}</p>
          {subtitle && <p className="text-[11px] text-t3">{subtitle}</p>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${onTrack ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'}`}>
          {onTrack ? '✓ 달성 예정' : '⚡ 분발 필요'}
        </span>
      </div>

      <div className="mb-3 h-3 w-full rounded-full bg-surface p-0.5">
        <div className="flex h-full w-full overflow-hidden rounded-full">
          {breakdown ? (
            <>
              <div
                className="h-full bg-[linear-gradient(135deg,#fb923c,#f97316)] transition-all"
                style={{ width: `${huntingPortion}%` }}
              />
              <div
                className="h-full bg-[linear-gradient(135deg,#34d399,#22c55e)] transition-all"
                style={{ width: `${bossPortion}%` }}
              />
            </>
          ) : (
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          )}
        </div>
      </div>

      <div className="mb-1 text-right text-xs font-semibold text-t2">
        {pct.toFixed(1)}%
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-t3">
        <span>{breakdown ? `사냥 ${format(breakdown.hunting)} · 보스 ${format(breakdown.boss)}` : `${format(current)} / ${format(goal)}`}</span>
        {remaining > 0 ? <span>남은 {format(remaining)}</span> : <span className="font-semibold text-amber-400">🎉 달성!</span>}
      </div>

      {expectedDate && remaining > 0 && (
        <p className="mt-2 text-xs text-t3">
          목표 설정일({goalStartStr}) 기준 달성 예상: {expectedDate}
        </p>
      )}
    </Card>
  );
}
