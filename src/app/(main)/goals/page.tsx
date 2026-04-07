'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useGoalStore } from '@/shared/lib/stores/useGoalStore';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { formatMeso, fromManInput, toManDisplay } from '@/shared/lib/utils/formatters';

export default function GoalsPage() {
  const { localOwnerId } = useAuthStore();
  const { records, loadRecords } = useRecordStore();
  const { currentGoal, loadGoal, saveGoal } = useGoalStore();

  const [editing, setEditing] = useState(false);
  const [mesoGoalMan, setMesoGoalMan] = useState('');  // 만 단위
  const [shardGoal, setShardGoal] = useState('');       // 개 단위
  const [saving, setSaving] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (localOwnerId) {
      loadRecords(localOwnerId);
      loadGoal(localOwnerId, currentMonth);
    }
  }, [localOwnerId, loadRecords, loadGoal, currentMonth]);

  const monthRecords = useMemo(() => {
    const firstDay = new Date();
    firstDay.setDate(1);
    const firstStr = firstDay.toISOString().split('T')[0];
    return records.filter((r) => r.date >= firstStr);
  }, [records]);

  const totalMeso = monthRecords.reduce((s, r) => s + r.net_revenue, 0);
  const totalShards = monthRecords.reduce((s, r) => s + r.shard_count, 0);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const today = new Date().getDate();

  const handleSave = async () => {
    if (!localOwnerId) return;
    setSaving(true);
    try {
      await saveGoal(
        {
          local_owner_id: localOwnerId,
          month: currentMonth,
          meso_goal: fromManInput(mesoGoalMan) || undefined,
          shard_goal: parseInt(shardGoal) || undefined,
        },
        localOwnerId,
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
    <main className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-t1">목표</h1>
        <Button variant="ghost" size="sm" onClick={openEdit}>
          {currentGoal ? '수정' : '+ 목표 설정'}
        </Button>
      </div>

      <p className="text-sm text-t3">{currentMonth} 기준</p>

      {!currentGoal && !editing && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-4xl">🎯</p>
          <p className="text-t3">이번 달 목표를 설정해보세요</p>
          <Button onClick={openEdit}>목표 설정하기</Button>
        </div>
      )}

      {editing && (
        <Card>
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
          </div>
        </Card>
      )}

      {currentGoal && !editing && (
        <>
          {currentGoal.meso_goal && (
            <GoalProgressCard
              label="메소 목표"
              current={totalMeso}
              goal={currentGoal.meso_goal}
              format={formatMeso}
              today={today}
              daysInMonth={daysInMonth}
            />
          )}
          {currentGoal.shard_goal && (
            <GoalProgressCard
              label="조각 목표"
              current={totalShards}
              goal={currentGoal.shard_goal}
              format={(v) => `${v.toLocaleString()}개`}
              today={today}
              daysInMonth={daysInMonth}
            />
          )}
        </>
      )}
    </main>
  );
}

function GoalProgressCard({
  label, current, goal, format, today, daysInMonth,
}: {
  label: string;
  current: number;
  goal: number;
  format: (v: number) => string;
  today: number;
  daysInMonth: number;
}) {
  const pct = Math.min((current / goal) * 100, 100);
  const remaining = Math.max(goal - current, 0);
  const dailyAvg = today > 0 ? current / today : 0;
  const onTrack = dailyAvg * daysInMonth >= goal;

  let expectedDate: string | null = null;
  if (remaining > 0 && dailyAvg > 0) {
    const d = new Date();
    d.setDate(d.getDate() + Math.ceil(remaining / dailyAvg));
    expectedDate = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-t2">{label}</p>
        <span className={`text-xs ${onTrack ? 'text-green-400' : 'text-amber-400'}`}>
          {onTrack ? '✓ 달성 예정' : '⚡ 분발 필요'}
        </span>
      </div>

      <div className="flex justify-between text-xs text-t3 mb-1">
        <span>{format(current)}</span>
        <span>{format(goal)}</span>
      </div>

      <div className="w-full bg-surface rounded-full h-2 mb-3">
        <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex justify-between text-xs text-t3">
        <span>{pct.toFixed(1)}% 달성</span>
        {remaining > 0 ? (
          <span>남은 목표: {format(remaining)}</span>
        ) : (
          <span className="text-amber-400 font-semibold">🎉 달성!</span>
        )}
      </div>

      {expectedDate && remaining > 0 && (
        <p className="text-xs text-t3 mt-2">
          현재 페이스 기준 달성 예상: {expectedDate}
        </p>
      )}
    </Card>
  );
}
