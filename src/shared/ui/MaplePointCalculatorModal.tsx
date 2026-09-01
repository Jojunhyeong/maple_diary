'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useExpenseMutations } from '@/shared/lib/queries/useExpensesQuery';
import { formatNumber } from '@/shared/lib/utils/formatters';
import type { Expense } from '@/shared/types';
import { createDefaultMaplePointCalculatorState } from '@/shared/lib/maple-point-calculator';
import type {
  MaplePointMultiplier,
  MaplePointRunId,
  MaplePointShopItemId,
} from '@/shared/lib/maple-point-calculator-types';

interface MaplePointRun {
  id: MaplePointRunId;
  title: string;
  basePoint: number;
  description: string;
}

interface MaplePointShopItem {
  id: MaplePointShopItemId;
  title: string;
  price: number;
  note: string;
  maxQuantity: number;
}

const RUN_OPTIONS: MaplePointRun[] = [
  {
    id: 'highmountain',
    title: '하이마운틴',
    basePoint: 7500,
    description: '기본 7,500 메포',
  },
  {
    id: 'angler-company',
    title: '앵글러 컴퍼니',
    basePoint: 10000,
    description: '기본 10,000 메포',
  },
  {
    id: 'nightmare-garden',
    title: '악몽 선경',
    basePoint: 12500,
    description: '기본 12,500 메포',
  },
];

const MULTIPLIER_OPTIONS: MaplePointMultiplier[] = [1, 2, 5, 8];
const VIP_SAUNA_POINT_PER_HOUR = 3000;
const VIP_SAUNA_WEEKLY_MAX = 48;
const SHOP_ITEMS: MaplePointShopItem[] = [
  {
    id: 'meka-berry-farm-ticket',
    title: '메카베리 농장 입장권',
    price: 10000,
    note: '1만 메이플포인트',
    maxQuantity: 2,
  },
  {
    id: 'soul-etra',
    title: '솔 에르다',
    price: 2000,
    note: '2천 메이플포인트',
    maxQuantity: 5,
  },
];

function formatPoint(value: number) {
  return `${formatNumber(value)} 메포`;
}

export function MaplePointCalculatorModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const { addExpense, error, resetError } = useExpenseMutations({ isLoggedIn });
  const defaultState = createDefaultMaplePointCalculatorState();
  const [mounted, setMounted] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<MaplePointRunId | null>(defaultState.selectedRunId);
  const [selectedMultiplier, setSelectedMultiplier] = useState<MaplePointMultiplier>(defaultState.selectedMultiplier);
  const [vipCharges, setVipCharges] = useState(defaultState.vipCharges);
  const [monsterParkCount, setMonsterParkCount] = useState(defaultState.monsterParkCount);
  const [shopQuantities, setShopQuantities] = useState<Record<MaplePointShopItem['id'], string>>({
    'meka-berry-farm-ticket': defaultState.shopQuantities['meka-berry-farm-ticket'],
    'soul-etra': defaultState.shopQuantities['soul-etra'],
  });
  const [saving, setSaving] = useState(false);

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

  const selectedRun = useMemo(
    () => RUN_OPTIONS.find((run) => run.id === selectedRunId),
    [selectedRunId],
  );

  const contentTotal = selectedRun ? selectedRun.basePoint * selectedMultiplier : 0;

  const vipChargeCount = useMemo(() => {
    const parsed = Number(vipCharges.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(Math.floor(parsed), VIP_SAUNA_WEEKLY_MAX);
  }, [vipCharges]);

  const vipTotal = vipChargeCount * VIP_SAUNA_POINT_PER_HOUR;
  const monsterParkCountValue = useMemo(() => {
    const parsed = Number(monsterParkCount.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(Math.floor(parsed), 5);
  }, [monsterParkCount]);
  const monsterParkTotal = monsterParkCountValue * 700;
  const shopTotals = useMemo(() => {
    return SHOP_ITEMS.map((item) => {
      const quantity = Number(shopQuantities[item.id]?.replace(/,/g, '') || '0');
      const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.min(Math.floor(quantity), item.maxQuantity) : 0;
      return {
        ...item,
        quantity: safeQuantity,
        total: safeQuantity * item.price,
      };
    });
  }, [shopQuantities]);
  const shopGrandTotal = shopTotals.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = contentTotal + vipTotal + monsterParkTotal + shopGrandTotal;

  const buildExpenseMemo = () => {
    const parts: string[] = [];
    if (selectedRun) {
      parts.push(`에픽 던전 · ${selectedRun.title} · ${selectedMultiplier}배 · ${formatPoint(contentTotal)}`);
    }

    if (vipChargeCount > 0) {
      parts.push(`VIP 사우나 · ${vipChargeCount}회 · ${formatPoint(vipTotal)}`);
    }

    if (monsterParkCountValue > 0) {
      parts.push(`몬스터 파크 · ${monsterParkCountValue}회 · ${formatPoint(monsterParkTotal)}`);
    }

    const selectedShopItems = shopTotals.filter((item) => item.quantity > 0);
    if (selectedShopItems.length > 0) {
      parts.push(
        `메포샵 · ${selectedShopItems
          .map((item) => `${item.title} x${item.quantity}`)
          .join(', ')} · ${formatPoint(shopGrandTotal)}`,
      );
    }

    return parts.join(' / ');
  };

  const handleSaveExpense = async () => {
    if (grandTotal <= 0 || saving) return;

    setSaving(true);
    try {
      resetError();
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      const expense: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'sync_status'> = {
        date,
        title: '메이플 포인트 지출',
        amount: grandTotal,
        category: '메포',
        memo: buildExpenseMemo(),
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
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[2px]">
      <div className="flex h-full w-full flex-col bg-[radial-gradient(circle_at_top,rgba(255,248,240,0.98),rgba(248,243,235,0.97)_42%,rgba(245,239,230,0.98)_100%)]">
        <div className="flex items-center justify-between border-b border-line/80 px-4 py-4">
          <div>
            <h2 className="text-base font-bold text-t1">메포 계산기</h2>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-sm font-medium text-t3">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <section className="rounded-[32px] border border-amber-500/20 bg-[linear-gradient(145deg,rgba(255,250,241,0.98),rgba(255,255,255,0.92)_58%,rgba(250,244,232,0.98))] p-5 shadow-[0_16px_34px_rgba(217,119,6,0.10)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-t1">에픽 던전</p>
                  <p className="mt-1 text-xs text-t3">이용한 경우에만 콘텐츠와 배율을 선택해 주세요.</p>
                  <p className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-amber-600">
                    {formatPoint(contentTotal)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f7efe1] px-4 py-3 text-right">
                  <p className="text-[11px] text-t3">조합</p>
                  <p className="mt-1 text-sm font-semibold text-t1">
                    {selectedRun ? `${selectedRun.title} · ${selectedMultiplier}배` : '선택 안 함'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.85fr]">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-t2">콘텐츠 선택</p>
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(null)}
                    aria-pressed={!selectedRun}
                    className={`w-full rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition-all duration-200 ${
                      !selectedRun
                        ? 'border-amber-500/60 bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.18)]'
                        : 'border-line/80 bg-white/92 text-t2 shadow-[0_8px_18px_rgba(0,0,0,0.04)] hover:border-amber-500/35'
                    }`}
                  >
                    선택 안 함 · 0 메포
                  </button>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {RUN_OPTIONS.map((run) => {
                      const selected = run.id === selectedRunId;
                      return (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setSelectedRunId(run.id)}
                          aria-pressed={selected}
                          className={`rounded-3xl border p-4 text-left transition-all duration-200 ${
                            selected
                              ? 'border-amber-500/60 bg-[linear-gradient(150deg,rgba(245,158,11,0.16),rgba(245,158,11,0.06)_60%,rgba(255,255,255,0.8))] shadow-[0_14px_28px_rgba(217,119,6,0.16)]'
                              : 'border-line/80 bg-white/92 shadow-[0_8px_18px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-amber-500/35 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-t1">{run.title}</p>
                              <p className="mt-1 text-xs text-t3">{run.description}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                selected ? 'bg-amber-500 text-white' : 'bg-surface text-t3'
                              }`}
                            >
                              {selected ? '선택됨' : '선택'}
                            </span>
                          </div>

                          <div className="mt-4 rounded-2xl border border-line bg-app/75 p-3">
                            <p className="text-[11px] text-t3">기본 소모</p>
                            <p className="mt-1 text-sm font-bold text-t1">{formatPoint(run.basePoint)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-t2">배율 선택</p>
                  <div className="grid grid-cols-4 gap-2">
                    {MULTIPLIER_OPTIONS.map((multiplier) => {
                      const selected = multiplier === selectedMultiplier;
                      return (
                        <button
                          key={multiplier}
                          type="button"
                          onClick={() => setSelectedMultiplier(multiplier)}
                          aria-pressed={selected}
                          disabled={!selectedRun}
                          className={`rounded-2xl border px-3 py-4 text-center transition-all duration-200 ${
                            !selectedRun
                              ? 'cursor-not-allowed border-line/60 bg-surface/60 text-t3 opacity-60'
                              : selected
                              ? 'border-amber-500/60 bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.22)]'
                              : 'border-line/80 bg-white/92 text-t1 shadow-[0_8px_18px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-amber-500/35'
                          }`}
                        >
                          <p className="text-lg font-extrabold">{multiplier}배</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-3xl border border-line/80 bg-white/92 p-4 shadow-[0_10px_22px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-t3">선택 조합</p>
                        <p className="mt-1 text-sm font-semibold text-t1">
                          {selectedRun ? `${selectedRun.title} · ${selectedMultiplier}배` : '선택 안 함'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-t3">총 소모</p>
                        <p className="mt-1 text-lg font-bold text-amber-600">{formatPoint(contentTotal)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">기본</p>
                        <p className="mt-1 text-sm font-bold text-t1">
                          {formatPoint(selectedRun?.basePoint ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">배율</p>
                        <p className="mt-1 text-sm font-bold text-t1">
                          {selectedRun ? `${selectedMultiplier}배` : '-'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">합계</p>
                        <p className="mt-1 text-sm font-bold text-t1">{formatPoint(contentTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="rounded-[28px] border border-line/80 bg-white/92 p-4 shadow-[0_10px_22px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-t1">메이플 포인트샵</p>
                    <p className="mt-1 text-xs text-t3">소모템만 간단하게 수량으로 계산하세요.</p>
                  </div>
                  <div className="rounded-2xl bg-[#f7efe1] px-4 py-3 text-right">
                    <p className="text-[11px] text-t3">총 소모</p>
                    <p className="mt-1 text-sm font-semibold text-t1">{formatPoint(shopGrandTotal)}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {SHOP_ITEMS.map((item) => {
                    const entry = shopTotals.find((row) => row.id === item.id);
                    const total = entry?.total ?? 0;
                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-line/80 bg-[#fbf7ef] p-4 shadow-[0_8px_18px_rgba(0,0,0,0.03)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-t1">{item.title}</p>
                            <p className="mt-1 text-[11px] text-t3">{item.note}</p>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-t3">
                            최대 {item.maxQuantity}개
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div className="rounded-2xl bg-white px-3 py-2.5 text-center">
                            <p className="text-[11px] text-t3">단가</p>
                            <p className="mt-1 text-sm font-bold text-t1">{formatPoint(item.price)}</p>
                          </div>
                          <Input
                            label="수량"
                            placeholder=""
                            value={shopQuantities[item.id]}
                            onChange={(e) => {
                              const next = e.target.value.replace(/[^0-9]/g, '');
                              setShopQuantities((current) => ({
                                ...current,
                                [item.id]: next === '' ? '' : String(Math.min(Number(next), item.maxQuantity)),
                              }));
                            }}
                            suffix="개"
                            inputMode="numeric"
                          />
                          <div className="rounded-2xl bg-white px-3 py-2.5 text-center sm:col-span-2">
                            <p className="text-[11px] text-t3">소모</p>
                            <p className="mt-1 text-sm font-bold text-t1">{formatPoint(total)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-line/80 bg-white/92 p-5 shadow-[0_10px_22px_rgba(0,0,0,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-t1">VIP 사우나</p>
                      <p className="mt-1 text-xs text-t3">1시간당 3,000 메포</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-amber-500/15 bg-[#fbf2e3] p-4">
                    <p className="text-[11px] text-t3">VIP 결과</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-[-0.03em] text-amber-600">{formatPoint(vipTotal)}</p>
                    <p className="mt-2 text-xs text-t3">
                      {VIP_SAUNA_POINT_PER_HOUR.toLocaleString('ko-KR')} 메포 × {vipChargeCount || 0}회
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.85fr]">
                    <div>
                      <Input
                        label="충전 횟수"
                        placeholder=""
                        value={vipCharges}
                        onChange={(e) => {
                          const next = e.target.value.replace(/[^0-9]/g, '');
                          setVipCharges(next === '' ? '' : String(Math.min(Number(next), VIP_SAUNA_WEEKLY_MAX)));
                        }}
                        suffix="회"
                        inputMode="numeric"
                      />
                      <p className="mt-2 text-[11px] text-t3">주간 최대 {VIP_SAUNA_WEEKLY_MAX}회까지 입력할 수 있어요.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1">
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">회수</p>
                        <p className="mt-1 text-sm font-bold text-t1">{vipChargeCount}회</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">단가</p>
                        <p className="mt-1 text-sm font-bold text-t1">{formatPoint(VIP_SAUNA_POINT_PER_HOUR)}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">상한</p>
                        <p className="mt-1 text-sm font-bold text-t1">{VIP_SAUNA_WEEKLY_MAX}회</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-line/80 bg-white/92 p-5 shadow-[0_10px_22px_rgba(0,0,0,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-t1">몬스터 파크</p>
                      <p className="mt-1 text-xs text-t3">1회당 700 메포</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-amber-500/15 bg-[#fbf2e3] p-4">
                    <p className="text-[11px] text-t3">몬스터 파크 총 소모</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-[-0.03em] text-amber-600">{formatPoint(monsterParkTotal)}</p>
                    <p className="mt-2 text-xs text-t3">1회당 700 메포 · 0회~5회</p>
                  </div>

                  <div className="mt-4">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[0, 1, 2, 3, 4, 5].map((count) => {
                        const selected = count === monsterParkCountValue;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setMonsterParkCount(String(count))}
                            className={`rounded-2xl border px-3 py-4 text-center transition-all duration-200 ${
                              selected
                                ? 'border-amber-500/60 bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.22)]'
                                : 'border-line/80 bg-white/92 text-t1 shadow-[0_8px_18px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-amber-500/35'
                            }`}
                          >
                            <p className="text-lg font-extrabold">{count}회</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">횟수</p>
                        <p className="mt-1 text-sm font-bold text-t1">{monsterParkCountValue}회</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">단가</p>
                        <p className="mt-1 text-sm font-bold text-t1">{formatPoint(700)}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                        <p className="text-[11px] text-t3">합계</p>
                        <p className="mt-1 text-sm font-bold text-t1">{formatPoint(monsterParkTotal)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-500/20 bg-[linear-gradient(145deg,rgba(255,250,241,0.98),rgba(255,255,255,0.92)_58%,rgba(250,244,232,0.98))] p-5 shadow-[0_12px_26px_rgba(217,119,6,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-t1">메포 지출 저장</p>
                  <p className="mt-1 text-xs text-t3">지금 선택한 계산값을 장부에 바로 기록할 수 있어요.</p>
                </div>
                <div className="rounded-2xl bg-[#f7efe1] px-4 py-3 text-right">
                  <p className="text-[11px] text-t3">총 메포</p>
                  <p className="mt-1 text-lg font-bold text-amber-600">{formatPoint(grandTotal)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.95fr]">
                <div className="rounded-3xl border border-line/80 bg-white/92 p-4">
                  <p className="text-[11px] text-t3">저장 메모</p>
                  <p className="mt-2 text-sm leading-6 text-t1">{buildExpenseMemo() || '저장할 항목이 아직 없어요.'}</p>
                </div>

                <div className="rounded-3xl border border-line/80 bg-white/92 p-4">
                  <p className="text-xs font-semibold text-t1">저장 기준</p>
                  <p className="mt-2 text-sm leading-6 text-t1">이 화면에서 계산한 값은 서버에 직접 저장돼요. 별도 로컬 저장은 사용하지 않아요.</p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                      <p className="text-[11px] text-t3">기준</p>
                      <p className="mt-1 text-sm font-bold text-t1">서버</p>
                    </div>
                    <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                      <p className="text-[11px] text-t3">저장</p>
                      <p className="mt-1 text-sm font-bold text-t1">즉시</p>
                    </div>
                    <div className="rounded-2xl bg-[#f7efe1] px-3 py-3">
                      <p className="text-[11px] text-t3">복원</p>
                      <p className="mt-1 text-sm font-bold text-t1">없음</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                fullWidth
                className="mt-4"
                onClick={handleSaveExpense}
                disabled={grandTotal <= 0 || saving || !isLoggedIn}
              >
                {saving ? '저장 중...' : '메포 지출 저장'}
              </Button>
              {!isLoggedIn && (
                <p className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-t2">
                  메포 지출 저장은 로그인 후 사용할 수 있어요.
                </p>
              )}
              {error && (
                <p className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-700">
                    {error.message}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
