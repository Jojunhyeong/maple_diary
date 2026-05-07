'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { useAuthStore } from '@/shared/lib/stores/useAuthStore';
import { useExpenseStore } from '@/shared/lib/stores/useExpenseStore';
import { useExpenseModalStore } from '@/shared/lib/stores/useExpenseModalStore';
import { formatDateKorean, formatMeso } from '@/shared/lib/utils/formatters';
import type { Expense } from '@/shared/types';

interface ExpenseGroup {
  date: string;
  expenses: Expense[];
  totalAmount: number;
}

function getCurrentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthValue] = month.split('-').map(Number);
  const next = new Date(year, monthValue - 1 + offset, 1);
  return getCurrentMonth(next);
}

function formatMonthLabel(month: string) {
  const [year, monthValue] = month.split('-');
  return `${year}년 ${Number(monthValue)}월`;
}

function groupExpensesByDate(expenses: Expense[]): ExpenseGroup[] {
  const map = new Map<string, Expense[]>();

  for (const expense of expenses) {
    const list = map.get(expense.date) ?? [];
    list.push(expense);
    map.set(expense.date, list);
  }

  return [...map.entries()]
    .map(([date, items]) => ({
      date,
      expenses: [...items].sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      ),
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function ExpensesPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { localOwnerId } = useAuthStore();
  const { expenses, loadExpenses, deleteExpense, loading, error, clearError } =
    useExpenseStore();
  const { open, openForEdit } = useExpenseModalStore();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth(new Date()));

  useEffect(() => {
    if (!localOwnerId) return;
    loadExpenses(localOwnerId, isLoggedIn);
  }, [localOwnerId, loadExpenses, isLoggedIn]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => clearError(), 2200);
    return () => window.clearTimeout(timer);
  }, [error, clearError]);

  const visibleExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(selectedMonth)),
    [expenses, selectedMonth],
  );

  const groupedExpenses = useMemo(() => groupExpensesByDate(visibleExpenses), [visibleExpenses]);
  const monthTotal = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses],
  );
  const monthCount = visibleExpenses.length;
  const averageExpense = monthCount > 0 ? Math.floor(monthTotal / monthCount) : 0;
  const currentMonthLabel = formatMonthLabel(selectedMonth);

  const handleDelete = async (expenseId: string) => {
    await deleteExpense(expenseId, isLoggedIn);
  };

  return (
    <main className="maple-fade-up flex flex-col gap-4 px-4 pt-6 pb-4">
      <div>
        <h1 className="maple-title text-2xl font-bold text-t1">지출 장부</h1>
        <p className="mt-1 text-xs text-t3">아이템 구입 지출을 정리해보세요</p>
      </div>

      <Button type="button" size="lg" fullWidth onClick={open}>
        + 지출 추가
      </Button>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="cursor-pointer rounded-full px-2 py-1 text-lg text-t2 transition-colors hover:bg-surface hover:text-t1"
            aria-label="이전 달"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-t1">{currentMonthLabel}</p>
            <p className="mt-0.5 text-xs text-t3">{groupedExpenses.length}일치 지출 기록</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="cursor-pointer rounded-full px-2 py-1 text-lg text-t2 transition-colors hover:bg-surface hover:text-t1"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>

      </Card>

      <Card variant="highlight">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] text-t3">총 지출</p>
            <p className="mt-1 text-base font-bold text-t1">{formatMeso(monthTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] text-t3">건수</p>
            <p className="mt-1 text-base font-bold text-t1">{monthCount}건</p>
          </div>
          <div>
            <p className="text-[11px] text-t3">평균</p>
            <p className="mt-1 text-base font-bold text-t1">{formatMeso(averageExpense)}</p>
          </div>
        </div>
      </Card>

      {loading && <p className="py-8 text-center text-sm text-t3">지출을 불러오는 중이에요.</p>}

      {!loading && groupedExpenses.length === 0 && (
        <Card className="py-10 text-center">
          <p className="text-sm text-t3">이 달에는 아직 지출이 없어요</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {groupedExpenses.map((group) => (
          <ExpenseDayGroupCard
            key={group.date}
            group={group}
            onEdit={openForEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </main>
  );
}

function ExpenseDayGroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: ExpenseGroup;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.expenses.length > 1;

  return (
    <Card className="p-3.5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-1 py-1.5 text-left transition-colors hover:bg-surface/40"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-t1">{formatDateKorean(group.date)}</p>
          <p className="text-xs text-t3">{group.expenses.length}건</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-sm font-bold text-t1">-{formatMeso(group.totalAmount)}</p>
            <p className="text-xs text-t3">{formatMeso(Math.floor(group.totalAmount / Math.max(group.expenses.length, 1)))} / 건</p>
          </div>
          {hasMultiple && <span className="text-xs text-t3">{expanded ? '▲' : '▼'}</span>}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {group.expenses.map((expense) => (
            <div key={expense.id} className="rounded-xl border border-line bg-card/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-t1">{expense.title}</p>
                  <p className="mt-0.5 text-xs text-t3">{expense.category || '기타'}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-t1">-{formatMeso(expense.amount)}</p>
              </div>
              {expense.memo && <p className="mt-2 text-xs leading-5 text-t2">{expense.memo}</p>}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-t3">등록일 {formatDateKorean(expense.date)}</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(expense)}>
                    수정
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => onDelete(expense.id)}>
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
