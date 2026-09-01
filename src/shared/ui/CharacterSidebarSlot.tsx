'use client';

import { usePathname } from 'next/navigation';
import { CharacterSidebarCard } from '@/shared/ui/CharacterSidebarCard';

export function CharacterSidebarSlot() {
  const pathname = usePathname();
  const mainColumnWidth = pathname?.startsWith('/boss') || pathname?.startsWith('/goals') || pathname?.startsWith('/analysis')
    ? 760
    : pathname?.startsWith('/gathering')
      ? 760
      : 400;
  const sidebarLeft = `calc(50% - ${mainColumnWidth / 2 + 364}px)`;

  return (
    <aside
      className="fixed top-6 hidden max-h-[calc(100vh-3rem)] w-[340px] overflow-y-auto pb-6 xl:block"
      style={{ left: sidebarLeft }}
    >
      <CharacterSidebarCard />
    </aside>
  );
}
