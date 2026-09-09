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
    <div className={clsx('grid grid-cols-2 rounded-[10px] border border-line bg-surface p-1', className)}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={clsx(
              'rounded-[7px] px-3 py-2 text-left transition-colors',
              active
                ? 'bg-brand-soft'
                : 'hover:bg-card/70',
            )}
          >
            <p className={clsx('text-sm font-semibold', active ? 'text-brand' : 'text-t2')}>
              {tab.label}
            </p>
            <p className={clsx('mt-0.5 text-[11px]', active ? 'text-brand/80' : 'text-t3')}>
              {tab.subtitle}
            </p>
          </button>
        );
      })}
    </div>
  );
}
