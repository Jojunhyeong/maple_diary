'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { formatNumber } from '@/shared/lib/utils/formatters';

type MaplePointRun = {
  id: 'highmountain' | 'angler-company' | 'nightmare-garden';
  title: string;
  basePoint: number;
  description: string;
};

type MaplePointMultiplier = 1 | 2 | 5 | 8;

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

function formatPoint(value: number) {
  return `${formatNumber(value)} 메포`;
}

export function MaplePointCalculatorCard() {
  const [selectedRunId, setSelectedRunId] = useState<MaplePointRun['id']>('highmountain');
  const [selectedMultiplier, setSelectedMultiplier] = useState<MaplePointMultiplier>(1);

  const selectedRun = useMemo(
    () => RUN_OPTIONS.find((run) => run.id === selectedRunId) ?? RUN_OPTIONS[0],
    [selectedRunId],
  );

  const totalPoint = selectedRun.basePoint * selectedMultiplier;

  return (
    <Card variant="highlight" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-t1">메포 지출 계산</p>
          <p className="mt-1 text-xs text-t3">하이마운틴, 앵글러 컴퍼니, 악몽 선경 중 하나와 배율을 고르면 총 소모 메포가 보여요.</p>
        </div>
        <div className="rounded-2xl bg-app/70 px-4 py-3 text-right">
          <p className="text-[11px] text-t3">에픽 던젼</p>
          <p className="mt-1 text-lg font-bold text-amber-600">{formatPoint(totalPoint)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-t2">콘텐츠 선택</p>
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
                      ? 'border-amber-500/60 bg-[linear-gradient(150deg,rgba(245,158,11,0.16),rgba(245,158,11,0.06)_60%,rgba(255,255,255,0.7))] shadow-[0_14px_28px_rgba(217,119,6,0.18)]'
                      : 'border-line bg-card/90 shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:border-amber-500/35 hover:bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-t1">{run.title}</p>
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
                  className={`rounded-2xl border px-3 py-4 text-center transition-all duration-200 ${
                    selected
                      ? 'border-amber-500/60 bg-amber-500 text-white shadow-[0_12px_24px_rgba(217,119,6,0.22)]'
                      : 'border-line bg-card/90 text-t1 shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:border-amber-500/35'
                  }`}
                >
                  <p className="text-lg font-extrabold">{multiplier}배</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-line bg-card/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-t3">선택 조합</p>
                <p className="mt-1 text-sm font-semibold text-t1">
                  {selectedRun.title} · {selectedMultiplier}배
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-t3">총 소모</p>
                <p className="mt-1 text-lg font-bold text-amber-600">{formatPoint(totalPoint)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-surface/70 px-3 py-3">
                <p className="text-[11px] text-t3">기본</p>
                <p className="mt-1 text-sm font-bold text-t1">{formatPoint(selectedRun.basePoint)}</p>
              </div>
              <div className="rounded-2xl bg-surface/70 px-3 py-3">
                <p className="text-[11px] text-t3">배율</p>
                <p className="mt-1 text-sm font-bold text-t1">{selectedMultiplier}배</p>
              </div>
              <div className="rounded-2xl bg-surface/70 px-3 py-3">
                <p className="text-[11px] text-t3">합계</p>
                <p className="mt-1 text-sm font-bold text-t1">{formatPoint(totalPoint)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
