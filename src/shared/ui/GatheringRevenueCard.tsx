'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { formatMeso } from '@/shared/lib/utils/formatters';

type GatheringCategoryKey = 'seed' | 'flower' | 'mineral';

type GatheringRow = {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
};

const CATEGORY_META: Record<
  GatheringCategoryKey,
  { label: string; hint: string; placeholder: string }
> = {
  seed: {
    label: '씨앗',
    hint: '쥬니퍼베리 씨앗, 라벤더 씨앗 같은 전리품',
    placeholder: '예: 쥬니퍼베리 씨앗',
  },
  flower: {
    label: '꽃',
    hint: '쥬니퍼베리 꽃, 로즈마리 꽃 같은 전리품',
    placeholder: '예: 쥬니퍼베리 꽃',
  },
  mineral: {
    label: '광물',
    hint: '오팔의 원석, 힘의 크리스탈 원석 같은 전리품',
    placeholder: '예: 오팔의 원석',
  },
};

function createRow(): GatheringRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: '',
    unitPrice: '',
  };
}

function parseCount(value: string) {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function GatheringRevenueCard() {
  const [rowsByCategory, setRowsByCategory] = useState<Record<GatheringCategoryKey, GatheringRow[]>>({
    seed: [createRow()],
    flower: [createRow()],
    mineral: [createRow()],
  });

  const categoryTotals = useMemo(() => {
    const entries = Object.entries(rowsByCategory) as Array<[GatheringCategoryKey, GatheringRow[]]>;

    return entries.map(([category, rows]) => {
      const items = rows.map((row) => {
        const quantity = parseCount(row.quantity);
        const unitPrice = parseCount(row.unitPrice);
        return {
          ...row,
          quantity,
          unitPrice,
          total: quantity * unitPrice,
        };
      });

      return {
        category,
        items,
        total: items.reduce((sum, item) => sum + item.total, 0),
      };
    });
  }, [rowsByCategory]);

  const grandTotal = categoryTotals.reduce((sum, item) => sum + item.total, 0);

  const updateRow = (category: GatheringCategoryKey, rowId: string, patch: Partial<GatheringRow>) => {
    setRowsByCategory((current) => ({
      ...current,
      [category]: current[category].map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  };

  const addRow = (category: GatheringCategoryKey) => {
    setRowsByCategory((current) => ({
      ...current,
      [category]: [...current[category], createRow()],
    }));
  };

  const removeRow = (category: GatheringCategoryKey, rowId: string) => {
    setRowsByCategory((current) => {
      const next = current[category].filter((row) => row.id !== rowId);
      return {
        ...current,
        [category]: next.length > 0 ? next : [createRow()],
      };
    });
  };

  return (
    <Card className="border-amber-500/20 bg-[linear-gradient(135deg,rgba(255,250,241,0.96),rgba(255,255,255,0.92)_56%,rgba(250,244,232,0.97))]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-t1">채집/채광 전리품</p>
          <p className="mt-1 text-[11px] text-t3">씨앗, 꽃, 광물별로 단가와 수량을 적으면 총 수익을 바로 계산해요.</p>
        </div>
        <div className="rounded-2xl bg-[#f7efe1] px-4 py-3 text-right">
          <p className="text-[11px] text-t3">총 수익</p>
          <p className="mt-1 text-lg font-bold text-amber-600">{formatMeso(grandTotal)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {categoryTotals.map((item) => (
          <div key={item.category} className="rounded-2xl border border-line bg-white/85 px-3 py-3">
            <p className="text-[11px] text-t3">{CATEGORY_META[item.category].label}</p>
            <p className="mt-1 text-sm font-bold text-t1">{formatMeso(item.total)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {categoryTotals.map((entry) => (
          <section key={entry.category} className="rounded-[24px] border border-line/80 bg-white/90 p-4 shadow-[0_10px_22px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-t1">{CATEGORY_META[entry.category].label}</p>
                <p className="mt-1 text-[11px] text-t3">{CATEGORY_META[entry.category].hint}</p>
              </div>
              <button
                type="button"
                onClick={() => addRow(entry.category)}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/15"
              >
                + 행 추가
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="hidden grid-cols-[1.5fr_72px_112px_auto] gap-2 px-1 text-[10px] text-t3 md:grid">
                <span>항목</span>
                <span>수량</span>
                <span>단가</span>
                <span>합계</span>
              </div>
              {entry.items.map((row) => (
                <div key={row.id} className="rounded-2xl border border-line bg-surface/50 p-3">
                  <div className="grid gap-2 md:grid-cols-[1.5fr_72px_112px_auto_auto] md:items-center">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(entry.category, row.id, { name: e.target.value })}
                      placeholder={CATEGORY_META[entry.category].placeholder}
                      className="h-11 min-w-0 rounded-xl border border-line-str bg-field px-3 text-sm text-t1 shadow-[var(--shadow-sm)] placeholder:text-t3/70 focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                    />
                    <input
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(entry.category, row.id, { quantity: e.target.value.replace(/[^0-9]/g, '') })
                      }
                      placeholder="0"
                      inputMode="numeric"
                      className="h-11 min-w-0 rounded-xl border border-line-str bg-field px-3 text-sm text-t1 shadow-[var(--shadow-sm)] placeholder:text-t3/70 focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                    />
                    <input
                      value={row.unitPrice}
                      onChange={(e) =>
                        updateRow(entry.category, row.id, { unitPrice: e.target.value.replace(/[^0-9]/g, '') })
                      }
                      placeholder="0"
                      inputMode="numeric"
                      className="h-11 min-w-0 rounded-xl border border-line-str bg-field px-3 text-sm text-t1 shadow-[var(--shadow-sm)] placeholder:text-t3/70 focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                    />
                    <div className="rounded-xl bg-white px-3 py-2 text-right">
                      <p className="text-[10px] text-t3">합계</p>
                      <p className="mt-1 text-sm font-bold text-t1">{formatMeso(row.total)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(entry.category, row.id)}
                      className="h-11 rounded-xl border border-red-500/20 bg-red-500/8 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/15"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
