'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '🏠' },
  { href: '/records', label: '기록', icon: '📋' },
  { href: '/analysis', label: '분석', icon: '📊' },
  { href: '/goals', label: '목표', icon: '🎯' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav border-t border-nav-line">
      <div className="flex max-w-md mx-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (pathname?.startsWith(href + '/') ?? false);
          return (
            <Link key={href} href={href} className={clsx('flex flex-1 flex-col items-center justify-center py-3 gap-0.5 min-h-14 transition-colors', active ? 'text-amber-500' : 'text-t3')}>
              <span className="text-xl leading-none">{icon}</span>
              <span className={clsx('text-[10px] font-medium', active ? 'text-amber-500' : 'text-t3')}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
