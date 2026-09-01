'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useExpenseMutations } from '@/shared/lib/queries/useExpensesQuery';
import { formatPointAmount } from '@/shared/lib/maple-point-expenses';
import { formatDate } from '@/shared/lib/utils/formatters';
import type { Expense } from '@/shared/types';

export function MaplePointManualExpenseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { addExpense, error, resetError } = useExpenseMutations({ isLoggedIn });
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState(formatDate(new Date()));
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDate(formatDate(new Date()));
    setTitle('');
    setAmount('');
    setMemo('');
    resetError();
    setSaving(false);
  }, [isOpen, resetError]);

  const parsedAmount = useMemo(() => {
    const next = Number(amount.replace(/,/g, ''));
    return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
  }, [amount]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedMemo = memo.trim();
    if (!isLoggedIn || !trimmedTitle || parsedAmount <= 0 || saving) return;

    setSaving(true);
    resetError();
    try {
      const expense: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'sync_status'> = {
        date,
        title: trimmedTitle,
        amount: parsedAmount,
        category: '메포',
        memo: trimmedMemo || '메포 수동 지출',
      };

      await addExpense(expense);
      onClose();
    } catch {
      // mutation error is rendered below
    } finally {
      setSaving(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4" onClick={handleBackdropClick}>
      <div
        ref={panelRef}
        className="flex h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-app min-h-0"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <h2 className="text-base font-bold text-t1">메포 수동 지출 추가</h2>
            <p className="mt-1 text-xs text-t3">메포샵 외에 직접 산 항목과 가격을 기록해요.</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-sm font-medium text-t3">
            닫기
          </button>
        </div>

        <div className="min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          <Input label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="항목" placeholder="예: 원더 베리 구매" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="가격"
            placeholder="예: 20000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            suffix="P"
            inputMode="numeric"
          />
          <Input label="메모 (선택)" placeholder="예: 다신 안사" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-t2">
            예상 지출: <span className="font-semibold text-t1">{formatPointAmount(parsedAmount)}</span>
          </div>
        </div>

        <div className="border-t border-line bg-app px-4 py-3.5">
          <Button type="button" size="lg" fullWidth onClick={handleSave} disabled={!isLoggedIn || !title.trim() || parsedAmount <= 0 || saving}>
            {saving ? '저장 중...' : '메포 지출 저장'}
          </Button>
          {!isLoggedIn && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-t2">
              메포 지출 저장은 로그인 후 사용할 수 있어요.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-sm text-rose-700">
              {error.message}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
