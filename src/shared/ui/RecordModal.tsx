'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useRecordStore } from '@/shared/lib/stores/useRecordStore';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useUserStore } from '@/shared/lib/stores/useUserStore';
import { useRecordModalStore } from '@/shared/lib/stores/useRecordModalStore';
import { enrichRecordWithCalculations } from '@/shared/lib/utils/calculations';
import { formatMeso, formatDate, fromManInput, toManDisplay } from '@/shared/lib/utils/formatters';

const MINUTES_PER_SOJAE = 30;

export function RecordModal() {
  const { isOpen, close } = useRecordModalStore();

  const [sojaeCnt, setSojaeCnt] = useState('');
  const [mesoMan, setMesoMan] = useState('');
  const [shardCount, setShardCount] = useState('');
  const [materialCostMan, setMaterialCostMan] = useState('');
  const [memo, setMemo] = useState('');
  const [shardPriceMan, setShardPriceMan] = useState('');
  const [shardPriceEditing, setShardPriceEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { settings, updateSettings } = useUserStore();
  const { records, addRecord } = useRecordStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setShardPriceMan(toManDisplay(settings.shard_price));
  }, [settings.shard_price]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setSojaeCnt('');
      setMesoMan('');
      setShardCount('');
      setMaterialCostMan('');
      setMemo('');
      setShardPriceEditing(false);
      setToastMessage(null);
    }
  }, [isOpen]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastType(type);
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2200);
  };

  // 바깥 클릭으로 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      close();
    }
  };

  const timeMinutes = (parseInt(sojaeCnt) || 0) * MINUTES_PER_SOJAE;
  const meso = fromManInput(mesoMan);
  const materialCostPerSojae = fromManInput(materialCostMan);
  const materialCost = materialCostPerSojae * (parseInt(sojaeCnt) || 0);
  const shardPrice = fromManInput(shardPriceMan) || settings.shard_price;

  const preview = useMemo(() => {
    if (!parseInt(sojaeCnt) && !meso) return null;
    return enrichRecordWithCalculations(
      {
        id: '', date: '', created_at: '', updated_at: '', sync_status: 'local',
        time_minutes: timeMinutes,
        meso,
        shard_count: parseInt(shardCount) || 0,
        material_cost: materialCost,
      },
      shardPrice,
    );
  }, [sojaeCnt, meso, shardCount, materialCost, shardPrice, timeMinutes]);

  const latestRecord = useMemo(() => records[0] ?? null, [records]);
  const latestSojaeCnt = useMemo(() => {
    if (!latestRecord) return 0;
    return Math.max(1, Math.round(latestRecord.time_minutes / MINUTES_PER_SOJAE));
  }, [latestRecord]);

  const applyLatestPreset = () => {
    if (!latestRecord) return;
    const derivedSojae = Math.max(1, Math.round(latestRecord.time_minutes / MINUTES_PER_SOJAE));
    const perSojae = Math.floor(latestRecord.material_cost / derivedSojae);

    setSojaeCnt(String(derivedSojae));
    setMesoMan(toManDisplay(latestRecord.meso));
    setShardCount(latestRecord.shard_count > 0 ? String(latestRecord.shard_count) : '');
    setMaterialCostMan(perSojae > 0 ? toManDisplay(perSojae) : '');
    showToast('최근 입력값을 불러왔어요', 'info');
  };

  const handleShardPriceSave = async () => {
    const val = fromManInput(shardPriceMan);
    if (val > 0) await updateSettings({ shard_price: val });
    setShardPriceEditing(false);
  };

  const handleSave = async () => {
    if (!localOwnerId || !timeMinutes || !meso) return;
    setSaving(true);
    try {
      if (shardPrice !== settings.shard_price) {
        await updateSettings({ shard_price: shardPrice });
      }
      await addRecord(
        {
          date: formatDate(new Date()),
          time_minutes: timeMinutes,
          meso,
          shard_count: parseInt(shardCount) || 0,
          material_cost: materialCost,
          memo: memo.trim() || undefined,
          sync_status: 'local',
        },
        localOwnerId,
        shardPrice,
        isLoggedIn,
      );
      showToast('기록이 저장됐어요', 'success');
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => close(), 420);
    } catch (err) {
      console.error(err);
      showToast('저장 중 오류가 발생했어요', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!localOwnerId && parseInt(sojaeCnt) > 0 && meso > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="h-[85dvh] w-full max-w-md overflow-hidden bg-app rounded-2xl min-h-0 flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line flex-shrink-0">
          <h2 className="text-base font-bold text-t1">오늘 기록</h2>
          <button onClick={close} className="text-t3 text-sm font-medium cursor-pointer">닫기</button>
        </div>

        {toastMessage && (
          <div className="px-4 pt-3">
            <div
              className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-[var(--shadow-sm)] ${
                toastType === 'success'
                  ? 'border border-green-600/30 bg-green-50 text-green-800'
                  : toastType === 'error'
                  ? 'border border-red-600/30 bg-red-50 text-red-700'
                  : 'border border-amber-600/30 bg-amber-50 text-amber-800'
              }`}
            >
              {toastMessage}
            </div>
          </div>
        )}

        {/* 스크롤 영역 */}
        <div className="min-h-0 overflow-y-auto overscroll-contain flex flex-1 flex-col gap-5 px-4 py-5">
          {latestRecord && (
            <div className="rounded-xl border border-amber-500/25 bg-[linear-gradient(130deg,rgba(245,158,11,0.12),rgba(245,158,11,0.02)_65%,transparent)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-t2">
                  빠른 입력: {latestSojaeCnt}소재비 · {formatMeso(latestRecord.meso)} · {latestRecord.shard_count}개
                </p>
                <button
                  type="button"
                  onClick={applyLatestPreset}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/20"
                >
                  최근값 적용
                </button>
              </div>
            </div>
          )}

          {/* 소재비 횟수 */}
          <div>
            <Input
              label="소재비"
              placeholder="예: 4"
              value={sojaeCnt}
              onChange={(e) => setSojaeCnt(e.target.value.replace(/\D/g, ''))}
              suffix="소재비"
              inputMode="numeric"
              autoFocus
            />
            {parseInt(sojaeCnt) > 0 && (
              <p className="text-xs text-t3 mt-1.5 ml-1">
                = {parseInt(sojaeCnt) * MINUTES_PER_SOJAE}분 사냥
              </p>
            )}
          </div>

          {/* 획득 메소 */}
          <div>
            <Input
              label="획득 메소"
              placeholder="예: 20000"
              value={mesoMan}
              onChange={(e) => setMesoMan(e.target.value.replace(/\D/g, ''))}
              suffix="만"
              inputMode="numeric"
            />
            {meso > 0 && (
              <p className="text-xs text-t3 mt-1.5 ml-1">= {formatMeso(meso)} ({parseInt(mesoMan || '0').toLocaleString('ko-KR')}만)</p>
            )}
          </div>

          {/* 획득 조각 */}
          <Input
            label="획득 조각"
            placeholder="0"
            value={shardCount}
            onChange={(e) => setShardCount(e.target.value.replace(/\D/g, ''))}
            suffix="개"
            inputMode="numeric"
          />

          {/* 소재비 1개당 금액 */}
          <div>
            <Input
              label="소재비 1개당 금액"
              placeholder="예: 500"
              value={materialCostMan}
              onChange={(e) => setMaterialCostMan(e.target.value.replace(/\D/g, ''))}
              suffix="만"
              inputMode="numeric"
            />
            {materialCostPerSojae > 0 && parseInt(sojaeCnt) > 0 && (
              <p className="text-xs text-t3 mt-1.5 ml-1">
                총 소재 지출: {formatMeso(materialCost)}
                <span className="text-t3 ml-1">({sojaeCnt}소재비 × {formatMeso(materialCostPerSojae)})</span>
              </p>
            )}
            {materialCostPerSojae > 0 && !parseInt(sojaeCnt) && (
              <p className="text-xs text-t3 mt-1.5 ml-1">= {formatMeso(materialCostPerSojae)} / 소재비</p>
            )}
          </div>

          {/* 솔에르다 조각 시세 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-t2">솔에르다 조각 시세</label>
              {!shardPriceEditing ? (
                <button onClick={() => setShardPriceEditing(true)} className="text-xs text-amber-400 font-medium cursor-pointer">
                  수정
                </button>
              ) : (
                <button onClick={handleShardPriceSave} className="text-xs text-green-400 font-medium cursor-pointer">
                  저장
                </button>
              )}
            </div>
            {shardPriceEditing ? (
              <div>
                <Input
                  value={shardPriceMan}
                  onChange={(e) => setShardPriceMan(e.target.value.replace(/\D/g, ''))}
                  suffix="만"
                  inputMode="numeric"
                  autoFocus
                  onBlur={handleShardPriceSave}
                />
                <p className="text-xs text-t3 mt-1.5 ml-1">
                  {fromManInput(shardPriceMan) > 0 ? `= ${formatMeso(fromManInput(shardPriceMan))}` : ''}
                </p>
              </div>
            ) : (
              <div
                className="w-full rounded-xl bg-card border border-line px-4 py-3 cursor-pointer"
                onClick={() => setShardPriceEditing(true)}
              >
                <span className="text-t1 font-medium">{shardPriceMan}만</span>
                <span className="text-t3 text-sm ml-2">({formatMeso(shardPrice)})</span>
              </div>
            )}
          </div>

          {/* 메모 */}
          <Input
            label="메모 (선택)"
            placeholder="오늘 특이사항..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />

          {/* 자동 계산 미리보기 */}
          {preview && (
            <div className="rounded-2xl border border-amber-500/35 bg-[linear-gradient(130deg,rgba(245,158,11,0.16),rgba(245,158,11,0.05)_55%,transparent)] p-4 shadow-[0_10px_24px_rgba(217,119,6,0.14)]">
              <p className="mb-3 text-sm font-semibold text-amber-600">자동 계산</p>
              <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                <span className="text-t3">조각 환산</span>
                <span className="text-t1 text-right">{formatMeso(preview.shard_value)}</span>
                <span className="text-t3">총 수익</span>
                <span className="text-t1 text-right">{formatMeso(preview.total_revenue)}</span>
                <span className="text-t2 font-medium">순수익</span>
                <span className="text-t1 text-right font-bold">{formatMeso(preview.net_revenue)}</span>
                {timeMinutes > 0 && (
                  <>
                    <span className="text-t3">시간당</span>
                    <span className="text-t1 text-right">{formatMeso(preview.net_per_hour)}/h</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line bg-app px-4 py-3.5">
          <Button size="lg" fullWidth onClick={handleSave} disabled={!canSave || saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
