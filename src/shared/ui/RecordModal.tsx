'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';
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

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { settings, updateSettings } = useUserStore();
  const { addRecord } = useRecordStore();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShardPriceMan(toManDisplay(settings.shard_price));
  }, [settings.shard_price]);

  // 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setSojaeCnt('');
      setMesoMan('');
      setShardCount('');
      setMaterialCostMan('');
      setMemo('');
      setShardPriceEditing(false);
    }
  }, [isOpen]);

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
      close();
    } catch (err) {
      console.error(err);
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
        className="w-full max-w-md bg-app rounded-2xl max-h-[85dvh] flex flex-col"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line flex-shrink-0">
          <h2 className="text-base font-bold text-t1">오늘 기록</h2>
          <button onClick={close} className="text-t3 text-sm font-medium cursor-pointer">닫기</button>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex flex-col gap-5 px-4 py-5">
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
              <p className="text-xs text-t3 mt-1.5 ml-1">= {formatMeso(meso)}</p>
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
            <Card variant="highlight">
              <p className="text-sm font-semibold text-amber-400 mb-3">자동 계산</p>
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
            </Card>
          )}

          <Button size="lg" fullWidth onClick={handleSave} disabled={!canSave || saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
