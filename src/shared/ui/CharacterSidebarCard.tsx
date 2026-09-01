import { CharacterManager } from '@/shared/ui/CharacterManager';
import { AccountMesoCard } from '@/shared/ui/AccountMesoCard';

export function CharacterSidebarCard() {
  return (
    <div className="flex flex-col gap-3">
      <AccountMesoCard />
      <CharacterManager variant="compact" />
    </div>
  );
}
