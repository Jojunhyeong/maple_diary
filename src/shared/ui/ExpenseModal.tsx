'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useExpenseStore } from '@/shared/lib/stores/useExpenseStore';
import { useExpenseModalStore } from '@/shared/lib/stores/useExpenseModalStore';
import { formatDate, formatMeso, fromManInput, toManDisplay } from '@/shared/lib/utils/formatters';
import type { Expense } from '@/shared/types';

const CATEGORY_OPTIONS = ['아이템', '강화', '소모품', '이벤트', '기타'];

export function ExpenseModal() {
  const { isOpen, close, editingExpense } = useExpenseModalStore();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { addExpense, updateExpense } = useExpenseStore();

  const [date, setDate] = useState(formatDate(new Date()));
  const [title, setTitle] = useState('');
  const [amountMan, setAmountMan] = useState('');
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingExpense) {
        setDate(editingExpense.date);
        setTitle(editingExpense.title);
        setAmountMan(toManDisplay(editingExpense.amount));
        setCategory(editingExpense.category || CATEGORY_OPTIONS[0]);
        setMemo(editingExpense.memo || '');
      } else {
        setDate(formatDate(new Date()));
        setTitle('');
        setAmountMan('');
        setCategory(CATEGORY_OPTIONS[0]);
        setMemo('');
      }
      setSaving(false);
    }
  }, [isOpen, editingExpense]);

  const amount = useMemo(() => fromManInput(amountMan), [amountMan]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      close();
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedMemo = memo.trim();
    if (!localOwnerId || !trimmedTitle || amount <= 0) return;

    setSaving(true);
    try {
      const payload = {
        date,
        title: trimmedTitle,
        amount,
        category: category.trim() || undefined,
        memo: trimmedMemo || undefined,
      };

      if (editingExpense) {
        await updateExpense(
          {
            ...editingExpense,
            ...payload,
            local_owner_id: editingExpense.local_owner_id ?? localOwnerId,
            created_at: editingExpense.created_at,
          } as Expense,
          localOwnerId,
          isLoggedIn,
        );
      } else {
        await addExpense(payload, localOwnerId, isLoggedIn);
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="flex h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-app min-h-0"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <h2 className="text-base font-bold text-t1">{editingExpense ? '지출 수정' : '지출 추가'}</h2>
            <p className="mt-1 text-xs text-t3">아이템 구매나 강화비를 바로 적어두세요.</p>
          </div>
          <button type="button" onClick={close} className="cursor-pointer text-sm font-medium text-t3">
            닫기
          </button>
        </div>

        <div className="min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          <Input label="날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="지출 항목" placeholder="예: 에스텔라 이어링 구매" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="금액"
            placeholder="예: 20000"
            value={amountMan}
            onChange={(e) => setAmountMan(e.target.value.replace(/\D/g, ''))}
            suffix="만"
            inputMode="numeric"
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold tracking-[-0.01em] text-t2">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-line-str bg-field px-4 py-3 text-base text-t1 shadow-[var(--shadow-sm)] focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Input label="메모 (선택)" placeholder="예: 할인 쿠폰 사용" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-t2">
            예상 지출: <span className="font-semibold text-t1">{formatMeso(amount)}</span>
          </div>
        </div>

        <div className="border-t border-line bg-app px-4 py-3.5">
          <Button type="button" size="lg" fullWidth onClick={handleSave} disabled={!localOwnerId || !title.trim() || amount <= 0 || saving}>
            {editingExpense ? '수정 저장' : '지출 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
