'use client';

import { usePathname } from 'next/navigation';
import { CharacterSidebarCard } from '@/shared/ui/CharacterSidebarCard';

export function CharacterSidebarSlot() {
  const pathname = usePathname();
  const isBossPage = pathname?.startsWith('/boss');

  return (
    <aside
      className={`fixed top-[18vh] hidden w-[340px] xl:block ${
        isBossPage ? 'left-[calc(50%-840px)] top-6' : 'left-[calc(50%-564px)]'
      }`}
    >
      <CharacterSidebarCard />
    </aside>
  );
}
