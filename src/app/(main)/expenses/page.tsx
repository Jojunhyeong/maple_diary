'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import {
  useExpenseMutations,
  useExpensesQuery,
} from '@/shared/lib/queries/useExpensesQuery';
import {
  useNexonConnectionMutations,
  useNexonConnectionQuery,
} from '@/shared/lib/queries/useNexonConnectionQuery';
import { useExpenseModalStore } from '@/shared/lib/stores/useExpenseModalStore';
import { MaplePointCalculatorModal } from '@/shared/ui/MaplePointCalculatorModal';
import { MaplePointManualExpenseModal } from '@/shared/ui/MaplePointManualExpenseModal';
import { formatPointAmount } from '@/shared/lib/maple-point-expenses';
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
  const { data: expenses = [], isLoading: loading } = useExpensesQuery({
    userId: session?.user?.id,
    isLoggedIn,
  });
  const { deleteExpense, togglePcRoomDiscount, isTogglingPcRoomDiscount } = useExpenseMutations({ isLoggedIn });
  const { data: nexonConnection, isLoading: isNexonStatusLoading } = useNexonConnectionQuery({
    userId: session?.user?.id,
    isLoggedIn,
  });
  const { syncEnhancements, isEnhancementSyncing } = useNexonConnectionMutations({ isLoggedIn });
  const isNexonConnected = !!nexonConnection?.connected;
  const { open, openForEdit } = useExpenseModalStore();
  const [isMaplePointOpen, setIsMaplePointOpen] = useState(false);
  const [isMaplePointManualOpen, setIsMaplePointManualOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'meso' | 'maple-point'>('meso');
  const [enhancementSyncMessage, setEnhancementSyncMessage] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth(new Date()));

  const visibleExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (!expense.date.startsWith(selectedMonth)) return false;
        if (activeTab === 'maple-point') return expense.category === '메포';
        return expense.category !== '메포';
      }),
    [activeTab, expenses, selectedMonth],
  );

  const groupedExpenses = useMemo(() => groupExpensesByDate(visibleExpenses), [visibleExpenses]);
  const monthTotal = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses],
  );
  const monthCount = visibleExpenses.length;
  const averageExpense = monthCount > 0 ? Math.floor(monthTotal / monthCount) : 0;
  const currentMonthLabel = formatMonthLabel(selectedMonth);
  const isMaplePointTab = activeTab === 'maple-point';
  const summaryAmountLabel = isMaplePointTab ? formatPointAmount(monthTotal) : formatMeso(monthTotal);
  const averageAmountLabel = isMaplePointTab ? formatPointAmount(averageExpense) : formatMeso(averageExpense);

  const handleDelete = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
    } catch (error) {
      setEnhancementSyncMessage(error instanceof Error ? error.message : '지출을 삭제하지 못했어요.');
    }
  };

  const handleTabChange = (tab: 'meso' | 'maple-point') => {
    setActiveTab(tab);
  };

  const handlePcRoomDiscount = async (expense: Expense) => {
    setEnhancementSyncMessage('');
    try {
      await togglePcRoomDiscount({
        expenseId: expense.id,
        applied: !expense.pc_room_discount_applied,
      });
      setEnhancementSyncMessage(
        expense.pc_room_discount_applied
          ? 'PC방 할인을 해제하고 지출 및 현재 잔액을 다시 계산했어요.'
          : 'PC방 할인 5%를 적용하고 지출 및 현재 잔액을 다시 계산했어요.',
      );
    } catch (error) {
      setEnhancementSyncMessage(error instanceof Error ? error.message : 'PC방 할인을 변경하지 못했어요.');
    }
  };

  const handleEnhancementSync = async () => {
    setEnhancementSyncMessage('');
    try {
      const payload = await syncEnhancements();

      const importedAttempts = payload.importedAttempts ?? 0;
      const starforceAttempts = payload.starforceAttempts ?? 0;
      const potentialAttempts = payload.potentialAttempts ?? 0;
      const totalAmount = payload.totalAmount ?? 0;
      const skippedCount = payload.skippedCount ?? 0;
      if (importedAttempts === 0 && skippedCount === 0) {
        setEnhancementSyncMessage('새로운 스타포스·잠재능력 재설정 내역이 없어요.');
      } else {
        const importedMessage =
          importedAttempts > 0
            ? `스타포스 ${starforceAttempts}회, 잠재능력 재설정 ${potentialAttempts}회 · ${formatMeso(totalAmount)}을 반영했어요.`
            : '계산 가능한 신규 강화비가 없어요.';
        const skippedMessage =
          skippedCount > 0 ? ` 정확히 계산할 수 없는 ${skippedCount}회는 제외했어요.` : '';
        setEnhancementSyncMessage(`${importedMessage}${skippedMessage}`);
      }
    } catch (error) {
      setEnhancementSyncMessage(error instanceof Error ? error.message : '강화비를 동기화하지 못했어요.');
    }
  };

  return (
    <main className="diary-expenses-page maple-fade-up flex flex-col gap-4">
      <div className="diary-record-toolbar">
        <div><h2>지출 장부</h2><p>메소와 메이플포인트 지출을 정리해 보세요.</p></div>
        <div className="diary-record-actions">
          {isMaplePointTab && <button type="button" className="diary-text-button" onClick={() => setIsMaplePointOpen(true)}>콘텐츠 관리</button>}
          <Button type="button" size="sm" onClick={isMaplePointTab ? () => setIsMaplePointManualOpen(true) : open}>＋ 지출 추가</Button>
        </div>
      </div>

      <div className="expenses-tabs grid grid-cols-2 gap-1 bg-surface p-1">
        <button
          type="button"
          onClick={() => handleTabChange('meso')}
          className={`rounded-[7px] px-3 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'meso' ? 'bg-brand-soft text-brand' : 'text-t3'
          }`}
        >
          메소
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('maple-point')}
          className={`rounded-[7px] px-3 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'maple-point' ? 'bg-brand-soft text-brand' : 'text-t3'
          }`}
        >
          메포
        </button>
      </div>

      {!isMaplePointTab && (
        <>
          <section className="starforce-integration">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-t1">강화비 자동 기록</p>
                  {isNexonConnected && (
                    <span className="rounded-[6px] bg-positive/10 px-2 py-0.5 text-[10px] font-semibold text-positive">
                      연결됨
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-t3">
                  스타포스와 잠재능력 재설정 이력에서 계산 가능한 신규 지출을 가져와요.
                </p>
              </div>

              {isNexonStatusLoading ? (
                <span className="shrink-0 text-xs text-t3">확인 중...</span>
              ) : isNexonConnected ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleEnhancementSync()}
                  disabled={isEnhancementSyncing}
                  className="shrink-0"
                >
                  {isEnhancementSyncing ? '동기화 중...' : '지금 동기화'}
                </Button>
              ) : (
                <Link
                  href="/settings"
                  className="shrink-0 rounded-[8px] border border-brand/25 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand"
                >
                  넥슨 연결
                </Link>
              )}
            </div>
            {enhancementSyncMessage && (
              <p className="mt-2 border-t border-line/70 pt-2 text-xs leading-5 text-t2">
                {enhancementSyncMessage}
              </p>
            )}
          </section>
        </>
      )}

    
        

        <section className="expenses-month-control">
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
        </section>
     

      <section className="expenses-summary">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] text-t3">{isMaplePointTab ? '총 메포' : '총 지출'}</p>
            <p className="mt-1 text-base font-bold text-t1">{summaryAmountLabel}</p>
          </div>
          <div>
            <p className="text-[11px] text-t3">건수</p>
            <p className="mt-1 text-base font-bold text-t1">{monthCount}건</p>
          </div>
          <div>
            <p className="text-[11px] text-t3">평균</p>
            <p className="mt-1 text-base font-bold text-t1">{averageAmountLabel}</p>
          </div>
        </div>
      </section>

      <MaplePointCalculatorModal isOpen={isMaplePointOpen} onClose={() => setIsMaplePointOpen(false)} />
      <MaplePointManualExpenseModal
        isOpen={isMaplePointManualOpen}
        onClose={() => setIsMaplePointManualOpen(false)}
      />

      {loading && <p className="py-8 text-center text-sm text-t3">지출을 불러오는 중이에요.</p>}

      {!loading && groupedExpenses.length === 0 && (
        <div className="expenses-empty"><strong>이 달에는 아직 지출이 없어요.</strong><p>첫 지출을 추가하면 월별 합계와 평균을 확인할 수 있어요.</p></div>
      )}

      <div className="flex flex-col gap-3">
        {groupedExpenses.map((group) => (
          <ExpenseDayGroupCard
            key={group.date}
            group={group}
            onEdit={openForEdit}
            onDelete={handleDelete}
            onTogglePcRoomDiscount={(expense) => void handlePcRoomDiscount(expense)}
            isTogglingPcRoomDiscount={isTogglingPcRoomDiscount}
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
  onTogglePcRoomDiscount,
  isTogglingPcRoomDiscount,
}: {
  group: ExpenseGroup;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
  onTogglePcRoomDiscount: (expense: Expense) => void;
  isTogglingPcRoomDiscount: boolean;
}) {
  const hasMultiple = group.expenses.length > 1;
  const [expanded, setExpanded] = useState(!hasMultiple);

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
                  <p className="mt-0.5 text-xs text-t3">{expense.category || '기타'}{expense.memo?.startsWith('넥슨 API 계산 ·') && <span className="ml-2 rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-700">⚡ 넥슨 연동 · 계산 지출</span>}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-t1">-{formatMeso(expense.amount)}</p>
              </div>
              {expense.memo && <p className="mt-2 text-xs leading-5 text-t2">{expense.memo}</p>}
              {expense.nexon_history_type === 'starforce' && (
                <button
                  type="button"
                  onClick={() => onTogglePcRoomDiscount(expense)}
                  disabled={isTogglingPcRoomDiscount || !expense.pc_room_discount_eligible}
                  aria-pressed={!!expense.pc_room_discount_applied}
                  className={`mt-2 rounded-[8px] border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    expense.pc_room_discount_applied
                      ? 'border-brand/30 bg-brand-soft text-brand'
                      : 'border-line bg-card text-t2 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {!expense.pc_room_discount_eligible
                    ? 'PC방 할인 대상 없음 · 18성 이상'
                    : expense.pc_room_discount_applied
                      ? 'PC방 할인 5% 적용됨 ✓'
                      : 'PC방 할인 적용'}
                </button>
              )}
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
