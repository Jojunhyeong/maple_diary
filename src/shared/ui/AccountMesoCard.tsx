'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAccountMesoMutation, useAccountMesoQuery } from '@/shared/lib/queries/useAccountMesoQuery';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { formatMeso, formatDateKorean, toManDisplay } from '@/shared/lib/utils/formatters';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { MapleActivityIcon } from './MapleActivityIcon';

const HISTORY_LABELS = {
  initial_balance: '초기 잔액 설정',
  manual_adjustment: '잔액 조정',
  hunting: '사냥 기록',
  expense: '지출 기록',
  gathering: '채집 기록',
  boss: '보스 기록',
} as const;

export function AccountMesoCard({
  label = '현재 메소 잔액',
  showHistory = false,
  weekStart,
}: {
  label?: string;
  showHistory?: boolean;
  weekStart?: Date;
}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId, initializeLocal } = useAuthStore();
  const { data, error: queryError } = useAccountMesoQuery({
    localOwnerId,
    userId: session?.user?.id,
    isLoggedIn,
  });
  const mutation = useAccountMesoMutation({
    localOwnerId,
    userId: session?.user?.id,
    isLoggedIn,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [amountMan, setAmountMan] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    initializeLocal();
  }, [initializeLocal]);

  const closeEditor = () => {
    setAmountMan(toManDisplay(data?.amount ?? 0));
    setFormError('');
    setAdjustmentNote('');
    mutation.reset();
    setIsEditing(false);
  };

  const handleSave = async () => {
    setFormError('');
    const normalized = amountMan.replace(/,/g, '').trim();
    if (!/^\d+$/.test(normalized)) {
      setFormError('만 단위 숫자를 입력해 주세요.');
      return;
    }

    const amount = Number(normalized) * 10_000;
    if (!Number.isSafeInteger(amount)) {
      setFormError('입력한 메소 금액이 너무 큽니다.');
      return;
    }

    try {
      await mutation.mutateAsync({ amount, note: adjustmentNote });
      setIsEditing(false);
      setAdjustmentNote('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '보유 메소를 저장하지 못했어요.');
    }
  };

  const editorError = formError || mutation.error?.message || '';

  const manualHistory = (data?.history ?? []).filter((entry) =>
    entry.entryType === 'initial_balance' || entry.entryType === 'manual_adjustment',
  );
  const weeklyChange = weekStart
    ? (data?.history ?? []).reduce((sum, entry) =>
        Date.parse(entry.createdAt) >= weekStart.getTime() ? sum + entry.delta : sum, 0)
    : null;

  return (
    <Card className="account-meso-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand"><span className="diary-meso-label"><MapleActivityIcon kind="meso" /> {label}</span></p>
          {isEditing ? (
            <div className="mt-1 flex h-9 max-w-[190px] items-center rounded-[9px] border border-brand/50 bg-field px-3 focus-within:ring-2 focus-within:ring-brand/15">
              <input
                value={amountMan}
                onChange={(event) => {
                  setAmountMan(event.target.value.replace(/[^0-9,]/g, ''));
                  setFormError('');
                  mutation.reset();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleSave();
                  if (event.key === 'Escape' && !mutation.isPending) closeEditor();
                }}
                inputMode="numeric"
                aria-label="전체 보유 메소, 만 단위"
                placeholder="예: 15000"
                className="min-w-0 flex-1 bg-transparent text-lg font-black tracking-[-0.04em] text-t1 outline-none placeholder:text-sm placeholder:font-normal placeholder:text-t3/70"
                autoFocus
              />
              <span className="ml-2 shrink-0 text-xs font-semibold text-t3">만</span>
            </div>
          ) : (
            <p className="mt-1 truncate text-xl font-black tracking-[-0.04em] text-t1">
              {queryError ? '확인 불가' : data ? data.updatedAt ? formatMeso(data.amount) : '미입력' : '불러오는 중...'}
            </p>
          )}
          <p className="mt-1 text-[10px] leading-5 text-t3">
            <strong className="font-semibold text-t2">기록 기준 잔액</strong><span className="mx-1.5" aria-hidden="true">·</span>메이플스토리와 직접 동기화되지 않아요.
          </p>
          {isEditing && data?.updatedAt && (
            <input
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              maxLength={200}
              placeholder="조정 사유 (선택)"
              aria-label="잔액 조정 사유"
              className="mt-2 w-full max-w-[260px] rounded-lg border border-line bg-field px-3 py-2 text-xs text-t1 outline-none focus:border-brand/60"
            />
          )}
        </div>

        {isEditing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={closeEditor} disabled={mutation.isPending} className="px-2.5">
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={mutation.isPending || (!isLoggedIn && !localOwnerId)}
              className="px-3"
            >
              {mutation.isPending ? '저장 중' : '저장'}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAmountMan(toManDisplay(data?.amount ?? 0));
              setFormError('');
              mutation.reset();
              setIsEditing(true);
            }}
          >
            {data?.updatedAt ? '잔액 조정' : '초기 잔액 입력'}
          </Button>
        )}
      </div>

      {!isEditing && weeklyChange !== null && data?.updatedAt && (
        <div className="diary-balance-change"><span>최근 변화</span><strong className={weeklyChange < 0 ? 'diary-negative' : 'diary-positive'}>{weeklyChange > 0 ? '+' : weeklyChange < 0 ? '−' : ''}{formatMeso(Math.abs(weeklyChange))}</strong><small>이번 주</small></div>
      )}

      {(editorError || queryError) && (
        <p className="mt-2 text-xs text-negative">{editorError || queryError?.message}</p>
      )}
      {showHistory && manualHistory.length > 0 && (
        <details className="diary-balance-history">
          <summary>잔액 조정 이력 {manualHistory.length}건</summary>
          <div>
            {manualHistory.slice(0, 5).map((entry) => (
              <div key={entry.id}>
                <span><strong>{HISTORY_LABELS[entry.entryType]}</strong><small>{formatDateKorean(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ''}</small></span>
                <span className={entry.delta < 0 ? 'diary-negative' : 'diary-positive'}>{entry.delta > 0 ? '+' : ''}{formatMeso(entry.delta)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
