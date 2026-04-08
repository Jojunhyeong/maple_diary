'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: <HomeIcon /> },
  { href: '/records', label: '기록', icon: <ListIcon /> },
  { href: '/analysis', label: '분석', icon: <ChartIcon /> },
  { href: '/goals', label: '목표', icon: <TargetIcon /> },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="maple-panel flex w-full rounded-2xl border border-nav-line bg-nav shadow-[var(--shadow-md)] backdrop-blur-xl">
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href || (pathname?.startsWith(href + '/') ?? false);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200',
              active ? 'text-amber-500' : 'text-t3 hover:text-t2',
            )}
          >
            {active && (
              <span className="absolute inset-x-3 top-1 h-7 rounded-lg bg-[linear-gradient(135deg,rgba(217,119,6,0.28),rgba(239,68,68,0.14))] shadow-[0_0_18px_rgba(217,119,6,0.32)]" />
            )}
            <span className="relative z-10">{icon}</span>
            <span className={clsx('relative z-10 text-[10px] font-semibold', active ? 'text-amber-500' : 'text-t3')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      {children}
    </span>
  );
}

function HomeIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 3.7l8 6.8-1.4 1.7L12 6.9 5.4 12.2 4 10.5z" fill="currentColor" stroke="none" />
        <path d="M6.2 10.8V20h11.6v-9.2" />
        <path d="M10.2 20v-4.7h3.6V20" />
      </svg>
    </NavIcon>
  );
}

function ListIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.85">
        <rect x="4.2" y="5.2" width="15.6" height="13.6" rx="2.2" />
        <path d="M8 9h8.2M8 12.1h8.2M8 15.2h6" />
        <circle cx="6.4" cy="9" r=".8" fill="currentColor" stroke="none" />
        <circle cx="6.4" cy="12.1" r=".8" fill="currentColor" stroke="none" />
        <circle cx="6.4" cy="15.2" r=".8" fill="currentColor" stroke="none" />
      </svg>
    </NavIcon>
  );
}

function ChartIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.85">
        <path d="M4 19.2h16" />
        <path d="M7 16.5v-4.1M12 16.5V8M17 16.5V10.2" />
        <path d="M6 7.5l3.7-2.3 3.3 2.1 5-3.2" />
      </svg>
    </NavIcon>
  );
}

function TargetIcon() {
  return (
    <NavIcon>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.85">
        <path d="M12 4.5c3.7 0 6.8 3 6.8 6.7S15.7 17.9 12 17.9 5.2 14.9 5.2 11.2 8.3 4.5 12 4.5z" />
        <path d="M12 7.6c2 0 3.7 1.6 3.7 3.6S14 14.8 12 14.8 8.3 13.2 8.3 11.2 10 7.6 12 7.6z" />
        <path d="M19.4 4.6l-2.8 2.8" />
      </svg>
    </NavIcon>
  );
}
