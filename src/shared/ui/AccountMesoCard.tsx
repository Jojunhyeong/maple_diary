'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAccountMesoMutation, useAccountMesoQuery } from '@/shared/lib/queries/useAccountMesoQuery';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { formatMeso, toManDisplay } from '@/shared/lib/utils/formatters';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

export function AccountMesoCard() {
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
  const [formError, setFormError] = useState('');

  useEffect(() => {
    initializeLocal();
  }, [initializeLocal]);

  const closeEditor = () => {
    setAmountMan(toManDisplay(data?.amount ?? 0));
    setFormError('');
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
      await mutation.mutateAsync(amount);
      setIsEditing(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '보유 메소를 저장하지 못했어요.');
    }
  };

  const editorError = formError || mutation.error?.message || '';

  return (
    <Card className="border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(245,158,11,0.04)_65%,transparent)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-amber-600">💰 전체 보유 메소</p>
          {isEditing ? (
            <div className="mt-1 flex h-9 max-w-[190px] items-center rounded-xl border border-amber-500/50 bg-field px-3 shadow-[var(--shadow-sm)] focus-within:ring-4 focus-within:ring-amber-500/10">
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
              {data ? formatMeso(data.amount) : '불러오는 중...'}
            </p>
          )}
          <p className="mt-1 text-[10px] text-t3">모든 캐릭터를 합산한 계정 기준</p>
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
            수정
          </Button>
        )}
      </div>

      {(editorError || queryError) && (
        <p className="mt-2 text-xs text-red-500">{editorError || queryError?.message}</p>
      )}
    </Card>
  );
}
