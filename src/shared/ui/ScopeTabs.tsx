'use client';

import { clsx } from 'clsx';

export type ScopeTabValue = 'all' | 'character';

type ScopeTabsProps = {
  value: ScopeTabValue;
  onChange: (value: ScopeTabValue) => void;
  className?: string;
};

const tabs: Array<{ value: ScopeTabValue; label: string; subtitle: string }> = [
  { value: 'all', label: '전체', subtitle: '모든 캐릭터 합산' },
  { value: 'character', label: '캐릭터별', subtitle: '현재 캐릭터 기준' },
];

export function ScopeTabs({ value, onChange, className }: ScopeTabsProps) {
  return (
    <div className={clsx('grid grid-cols-2 rounded-2xl border border-line bg-card/80 p-1 shadow-[var(--shadow-sm)]', className)}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={clsx(
              'rounded-xl px-3 py-2 text-left transition-all',
              active
                ? 'bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(245,158,11,0.06))] shadow-[0_6px_16px_rgba(217,119,6,0.1)]'
                : 'hover:bg-surface/60',
            )}
          >
            <p className={clsx('text-sm font-semibold', active ? 'text-amber-600' : 'text-t2')}>
              {tab.label}
            </p>
            <p className={clsx('mt-0.5 text-[11px]', active ? 'text-amber-600/80' : 'text-t3')}>
              {tab.subtitle}
            </p>
          </button>
        );
      })}
    </div>
  );
}
